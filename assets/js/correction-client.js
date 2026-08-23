import { getRemoteSession } from "./backend.js";

export async function requestCorrection(payload, { fetchImpl = fetch, getSession = getRemoteSession, timeoutMs = 20000 } = {}) {
  const session = await getSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("CORRECTION_TIMEOUT")), timeoutMs);
  try {
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
