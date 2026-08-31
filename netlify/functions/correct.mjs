import { createHash } from "node:crypto";
import { createQuestionBankLoader } from "./lib/question-bank.mjs";
import { createCorrectionService } from "./lib/correction-service.mjs";

const questionBankLoader = createQuestionBankLoader();
const service = createCorrectionService({ questionBankLoader });
export const handler = createHandler({ service });

export function createHandler({ env = process.env, fetchImpl = fetch, service: correctionService = service, now = Date.now, authorizer = authorize } = {}) {
  const preAuthRequests = new Map();
  const userRequests = new Map();
  const authorizations = new Map();
  const corrections = new Map();

  return async function correctionHandler(event) {
    if (event.httpMethod !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });

    const timestamp = now();
    const cacheLimit = positiveInteger(env.CORRECTION_CACHE_MAX_ENTRIES, 500);
    pruneRates(preAuthRequests, timestamp, cacheLimit);
    pruneRates(userRequests, timestamp, cacheLimit);
    pruneCache(authorizations, timestamp, cacheLimit);
    pruneCache(corrections, timestamp, cacheLimit);
    if (!consumeRateLimit(preAuthRequests, technicalClientId(event), positiveInteger(env.CORRECTION_PREAUTH_MAX_REQUESTS_PER_MINUTE, 30), timestamp)) {
      return reply(429, { error: "RATE_LIMITED" });
    }

    const deadline = timestamp + boundedPositiveInteger(env.CORRECTION_SERVER_TIMEOUT_MS, 17500, 19000);
    const authorizationKey = tokenCacheKey(event.headers || {});

    let user;
    try {
      user = authorizationKey && authorizations.get(authorizationKey)?.value;
      if (!user) {
        user = await authorizer({ headers: event.headers || {}, env, fetchImpl, deadline, now });
        if (authorizationKey) authorizations.set(authorizationKey, { expiresAt: now() + positiveInteger(env.CORRECTION_AUTH_CACHE_MS, 30000), value: user });
      }
    } catch (error) {
      const code = String(error?.message || "AUTH_UNAVAILABLE");
      if (code === "AUTH_REQUIRED") return reply(401, { error: code });
      if (code === "ACCESS_NOT_AUTHORIZED") return reply(403, { error: code });
      console.error("INTERVIEWPLUS_CORRECTION_ERROR", "AUTH_UNAVAILABLE");
      return reply(500, { error: "INTERNAL_ERROR" });
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return reply(400, { error: "INVALID_JSON" });
    }

    const idempotencyKey = correctionKey(user.id, payload, event.body || "");
    const cached = idempotencyKey && corrections.get(idempotencyKey);
    if (cached && cached.expiresAt > now()) return cached.response;
    if (cached) corrections.delete(idempotencyKey);

    if (!consumeRateLimit(userRequests, user.id, positiveInteger(env.CORRECTION_MAX_REQUESTS_PER_MINUTE, 10), now())) return reply(429, { error: "RATE_LIMITED" });

    const pending = runCorrection(correctionService, payload, deadline);
    if (idempotencyKey) corrections.set(idempotencyKey, { expiresAt: now() + 10 * 60_000, response: pending });
    const response = await pending;
    if (idempotencyKey && response.statusCode === 200) corrections.set(idempotencyKey, { expiresAt: now() + 10 * 60_000, response });
    else if (idempotencyKey) corrections.delete(idempotencyKey);
    return response;
  };
}

async function runCorrection(correctionService, payload, deadline) {
  try {
    return reply(200, await correctionService.correct(payload, { deadline }));
  } catch (error) {
    const code = String(error?.message || "CORRECTION_UNAVAILABLE");
    if (code === "OPENROUTER_UNAVAILABLE") return reply(502, { error: code });
    if (isValidationError(code)) return reply(400, { error: code });
    console.error("INTERVIEWPLUS_CORRECTION_ERROR", safeErrorCode(code));
    return reply(500, { error: "INTERNAL_ERROR" });
  }
}

async function authorize({ headers, env, fetchImpl, deadline, now }) {
  const authorization = String(headers.authorization || headers.Authorization || "");
  if (!authorization.startsWith("Bearer ") || authorization.length > 8200) throw new Error("AUTH_REQUIRED");
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!baseUrl || !serviceKey) throw new Error("AUTH_UNAVAILABLE");
  const signal = AbortSignal.timeout(deadlineTimeout(env.SUPABASE_AUTH_TIMEOUT_MS, 2500, deadline, now));
  const authResponse = await fetchImpl(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: authorization },
    signal,
  });
  if (!authResponse.ok) throw new Error("AUTH_REQUIRED");
  const user = await authResponse.json();
  if (!user?.id || !user?.email) throw new Error("AUTH_REQUIRED");
  const query = new URLSearchParams({ select: "email", email: `ilike.${String(user.email).toLowerCase()}`, active: "eq.true", limit: "1" });
  const accessResponse = await fetchImpl(`${baseUrl}/rest/v1/authorized_users?${query}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(deadlineTimeout(env.SUPABASE_AUTH_TIMEOUT_MS, 2500, deadline, now)),
  });
  if (!accessResponse.ok) throw new Error("AUTH_UNAVAILABLE");
  const rows = await accessResponse.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("ACCESS_NOT_AUTHORIZED");
  return { id: user.id };
}

function correctionKey(userId, payload, rawBody) {
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
  if (!sessionId || sessionId.length > 128) return "";
  return `${userId}:${sessionId}:${createHash("sha256").update(rawBody).digest("base64url")}`;
}

function consumeRateLimit(requests, userId, limit, timestamp) {
  const recent = requests.get(userId) || [];
  if (recent.length >= limit) return false;
  recent.push(timestamp);
  requests.set(userId, recent);
  return true;
}

function technicalClientId(event) {
  const headers = event.headers || {};
  const forwarded = String(headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || "").split(",")[0].trim();
  return String(event.requestContext?.identity?.sourceIp || forwarded || "unknown").slice(0, 128);
}

function tokenCacheKey(headers) {
  const authorization = String(headers.authorization || headers.Authorization || "");
  return authorization.startsWith("Bearer ") && authorization.length <= 8200
    ? createHash("sha256").update(authorization).digest("base64url")
    : "";
}

function pruneRates(map, timestamp, maxEntries) {
  for (const [key, values] of map) {
    const recent = values.filter((time) => timestamp - time < 60_000);
    if (recent.length) map.set(key, recent);
    else map.delete(key);
  }
  trimMap(map, maxEntries);
}

function pruneCache(map, timestamp, maxEntries) {
  for (const [key, entry] of map) if (entry.expiresAt <= timestamp) map.delete(key);
  trimMap(map, maxEntries);
}

function trimMap(map, maxEntries) {
  while (map.size >= maxEntries) map.delete(map.keys().next().value);
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function boundedPositiveInteger(value, fallback, maximum) {
  return Math.min(maximum, positiveInteger(value, fallback));
}

function deadlineTimeout(value, fallback, deadline, now) {
  const remaining = deadline - now();
  if (remaining <= 0) throw new Error("AUTH_UNAVAILABLE");
  return Math.max(1, Math.min(positiveInteger(value, fallback), remaining));
}

function safeErrorCode(code) {
  if (code.startsWith("PRIVATE_QUESTION_FILE_UNAVAILABLE:")) return "PRIVATE_QUESTION_FILE_UNAVAILABLE";
  if (code.startsWith("QUESTION_BANK_")) return "QUESTION_BANK_ERROR";
  return "CORRECTION_INTERNAL_ERROR";
}

function isValidationError(code) {
  return ["INVALID_CORRECTION_TYPE", "INVALID_CORRECTION_ITEMS", "INVALID_CORRECTION_ITEM", "TOO_MANY_ITEMS", "ANSWER_TOO_LONG", "CORRECTION_PAYLOAD_TOO_LARGE", "UNKNOWN_QUESTION", "INVALID_CASE_THEME", "INVALID_CASE_DIFFICULTY", "INVALID_CASE_SEED", "INVALID_CASE_ANSWERS", "TOO_MANY_CASE_ANSWERS", "INVALID_CASE_ANSWER", "INVALID_CASE_RECOMMENDATION"].includes(code);
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
