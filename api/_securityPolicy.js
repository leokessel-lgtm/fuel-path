function suppliedToken(req = {}, directHeader = "") {
  const headers = req.headers || {};
  const auth = headers.authorization || headers.Authorization || "";
  const bearer = String(auth).replace(/^Bearer\s+/i, "").trim();
  return bearer || String(headers[directHeader] || headers[headerTitleCase(directHeader)] || "").trim();
}

function tokenAuthorised(req, expected, directHeader) {
  return Boolean(expected) && suppliedToken(req, directHeader) === expected;
}

function tokenSecurity({ expected, storageDurable = false, directHeader }) {
  const tokenConfigured = Boolean(expected);
  const tokenRequired = tokenConfigured || Boolean(storageDurable);
  return {
    tokenConfigured,
    tokenRequired,
    writeEnabled: !tokenRequired || tokenConfigured,
    acceptedHeaders: ["Authorization: Bearer <token>", directHeader],
  };
}

function headerTitleCase(value) {
  return String(value || "").split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join("-");
}

module.exports = { suppliedToken, tokenAuthorised, tokenSecurity };
