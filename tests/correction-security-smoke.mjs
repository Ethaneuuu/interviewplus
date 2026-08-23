import { deepEqual, equal } from "node:assert/strict";
import { createHandler } from "../netlify/functions/correct.mjs";

const restrictedEnv = {
  CORRECTION_MAX_REQUESTS_PER_MINUTE: "2",
  CORRECTION_PREAUTH_MAX_REQUESTS_PER_MINUTE: "20",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};

function event(body, token) {
  return {
    httpMethod: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    requestContext: { identity: { sourceIp: "203.0.113.10" } },
    body: JSON.stringify(body),
  };
}

function authFetch({ authorized = true } = {}) {
  return async (url, options) => {
    if (url.endsWith("/auth/v1/user")) {
      if (options.headers.Authorization !== "Bearer valid-jwt") return new Response("invalid", { status: 401 });
      return Response.json({ id: "user-1", email: "user@example.com" });
    }
    if (url.includes("/rest/v1/authorized_users")) {
      equal(options.headers.Authorization, "Bearer service-role-test");
      return Response.json(authorized ? [{ email: "user@example.com" }] : []);
    }
    throw new Error(`UNEXPECTED_URL:${url}`);
  };
}

let corrections = 0;
const service = { correct: async () => ({ score: ++corrections }) };
const handler = createHandler({ env: restrictedEnv, fetchImpl: authFetch(), service });

let response = await handler(event({ type: "case", sessionId: "s1" }));
equal(response.statusCode, 401);
deepEqual(JSON.parse(response.body), { error: "AUTH_REQUIRED" });

response = await createHandler({
  env: { ...restrictedEnv, CORRECTION_AUTH_MODE: "local" },
  fetchImpl: authFetch(),
  service,
})(event({ type: "case", sessionId: "no-bypass" }));
equal(response.statusCode, 401, "Environment configuration must never bypass production authorization");

response = await handler(event({ type: "case", sessionId: "s1" }, "invalid-jwt"));
equal(response.statusCode, 401);
deepEqual(JSON.parse(response.body), { error: "AUTH_REQUIRED" });

response = await handler(event({ type: "case", sessionId: "s1" }, "valid-jwt"));
equal(response.statusCode, 200);
equal(JSON.parse(response.body).score, 1);

response = await createHandler({ env: restrictedEnv, fetchImpl: authFetch({ authorized: false }), service })(
  event({ type: "case", sessionId: "s2" }, "valid-jwt"),
);
equal(response.statusCode, 403);
deepEqual(JSON.parse(response.body), { error: "ACCESS_NOT_AUTHORIZED" });

const retry = await handler(event({ type: "case", sessionId: "s1" }, "valid-jwt"));
equal(JSON.parse(retry.body).score, 1, "An identical retry must reuse the committed correction");
equal(corrections, 1);

let attempts = 0;
const retryableHandler = createHandler({
  env: { ...restrictedEnv, CORRECTION_MAX_REQUESTS_PER_MINUTE: "10" },
  fetchImpl: authFetch(),
  service: { correct: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("OPENROUTER_UNAVAILABLE");
    return { score: 77 };
  } },
});
equal((await retryableHandler(event({ type: "questions", sessionId: "retryable" }, "valid-jwt"))).statusCode, 502);
equal((await retryableHandler(event({ type: "questions", sessionId: "retryable" }, "valid-jwt"))).statusCode, 200);
equal(attempts, 2, "Failed corrections must not poison the idempotency cache");

await handler(event({ type: "case", sessionId: "s2" }, "valid-jwt"));
response = await handler(event({ type: "case", sessionId: "s3" }, "valid-jwt"));
equal(response.statusCode, 429);
deepEqual(JSON.parse(response.body), { error: "RATE_LIMITED" });

let preauthCalls = 0;
const preauthHandler = createHandler({
  env: { ...restrictedEnv, CORRECTION_PREAUTH_MAX_REQUESTS_PER_MINUTE: "2" },
  fetchImpl: async () => { preauthCalls += 1; return new Response("invalid", { status: 401 }); },
  service,
});
for (let index = 0; index < 3; index += 1) {
  response = await preauthHandler(event({ type: "case", sessionId: `abuse-${index}` }, "invalid-jwt"));
}
equal(response.statusCode, 429);
equal(preauthCalls, 2, "Pre-auth limiting must stop requests before Supabase");

let injectedAuthorizations = 0;
let authClock = 0;
const injectedHandler = createHandler({
  env: { ...restrictedEnv, CORRECTION_MAX_REQUESTS_PER_MINUTE: "10", CORRECTION_AUTH_CACHE_MS: "30" },
  now: () => authClock,
  authorizer: async () => { injectedAuthorizations += 1; return { id: "test-user" }; },
  service,
});
response = await injectedHandler(event({ type: "case", sessionId: "injected-authorizer" }, "test-jwt"));
equal(response.statusCode, 200);
equal(injectedAuthorizations, 1);
await injectedHandler(event({ type: "case", sessionId: "cached-authorizer" }, "test-jwt"));
equal(injectedAuthorizations, 1, "A warm retry must not repeat Supabase authorization");
authClock = 31;
await injectedHandler(event({ type: "case", sessionId: "expired-authorizer" }, "test-jwt"));
equal(injectedAuthorizations, 2, "Authorization cache must expire and revalidate");

console.log(JSON.stringify({ ok: true, auth: "restricted", idempotence: "warm-instance", rateLimit: "warm-instance" }));
