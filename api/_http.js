const DEFAULT_USER_AGENT = "FuelPathHostedBackend/0.1";

function applyCors(req, res) {
  const origin = req?.headers?.origin || req?.headers?.Origin || "";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(String(origin))) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Fuel-Path-Alerts-Token, X-Fuel-Path-Prediction-Token");
  res.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function methodAllowed(req, res, methods = ["GET"]) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  if (methods.includes(req.method)) return true;
  sendJson(res, 405, { error: "Method not allowed" });
  return false;
}

function numberParam(value, fallback) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringParam(value, fallback = "") {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function boolParam(value, fallback = false) {
  const text = String(Array.isArray(value) ? value[0] : value ?? (fallback ? "1" : "0")).toLowerCase();
  return ["1", "true", "yes", "on"].includes(text);
}

function setParam(value) {
  return new Set(
    stringParam(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

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
  applyCors,
  boolParam,
  fetchJson,
  methodAllowed,
  numberParam,
  sendJson,
  setParam,
  stringParam,
};
