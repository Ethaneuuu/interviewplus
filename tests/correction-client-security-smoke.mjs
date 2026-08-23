import { equal, rejects } from "node:assert/strict";

globalThis.window = { INTERVIEWPLUS_CONFIG: { backendMode: "local", supabaseUrl: "", supabaseAnonKey: "" } };
const { requestCorrection } = await import("../assets/js/correction-client.js?security-smoke");

let authorization;
const result = await requestCorrection({ type: "case" }, {
  fetchImpl: async (_url, options) => {
    authorization = options.headers.Authorization;
    return Response.json({ score: 91 });
  },
  getSession: async () => ({ access_token: "user-token" }),
  timeoutMs: 50,
});
equal(result.score, 91);
equal(authorization, "Bearer user-token");

await rejects(
  () => requestCorrection({ type: "case" }, {
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })),
    getSession: async () => ({ access_token: "user-token" }),
    timeoutMs: 10,
  }),
  /CORRECTION_TIMEOUT/,
);

console.log(JSON.stringify({ ok: true, bearer: "attached", timeout: "bounded" }));
