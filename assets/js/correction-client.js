import { getRemoteSession } from "./backend.js";

export async function requestCorrection(payload, { fetchImpl = fetch, getSession = getRemoteSession, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const configuredTimeout = Number(timeoutMs);
  const budget = Number.isFinite(configuredTimeout) ? Math.min(60000, Math.max(1, configuredTimeout)) : 20000;
  const timeout = setTimeout(() => controller.abort(new Error("CORRECTION_TIMEOUT")), budget);
  try {
    const session = await withAbort(getSession(), controller.signal);
    const response = await fetchImpl("/api/correct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "CORRECTION_UNAVAILABLE");
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("CORRECTION_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function withAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new Error("CORRECTION_TIMEOUT"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(
      (value) => { signal.removeEventListener("abort", abort); resolve(value); },
      (error) => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}
