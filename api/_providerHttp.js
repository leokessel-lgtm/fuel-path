const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";

async function fetchJson(url, { data, headers = {}, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Provider returned non-JSON response: ${text.slice(0, 120)}`);
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || response.statusText;
      throw new Error(`Provider returned ${response.status}: ${message}`);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Provider request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchJson,
};
