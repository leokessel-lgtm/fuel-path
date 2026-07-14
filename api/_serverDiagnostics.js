function logServerError(surface, error) {
  const value = error && typeof error === "object" ? error : {};
  console.error("Fuel Path server request failed", {
    surface: cleanDiagnosticText(surface, 60),
    name: cleanDiagnosticText(value.name || "Error", 80),
    code: cleanDiagnosticText(value.code, 40),
    table: cleanDiagnosticText(value.table, 100),
    column: cleanDiagnosticText(value.column, 100),
    constraint: cleanDiagnosticText(value.constraint, 140),
    message: safeDiagnosticMessage(value.message || error),
  });
}

function safeDiagnosticMessage(value) {
  return cleanDiagnosticText(value, 300)
    .replace(/\b(?:postgres(?:ql)?|https?):\/\/\S+/gi, "[redacted-url]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/ExponentPushToken\[[^\]]+\]/gi, "ExponentPushToken[[redacted]]")
    .replace(/\b(password|token|secret|api[_-]?key)\s*[=:]\s*\S+/gi, "$1=[redacted]");
}

function cleanDiagnosticText(value, maxLength) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength);
}

module.exports = {
  logServerError,
  safeDiagnosticMessage,
};
