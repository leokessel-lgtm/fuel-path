function normaliseSearchContext(value = {}) {
  if (!value) return null;
  const lat = Number(value.nearLat);
  const lon = Number(value.nearLon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { nearLat: lat, nearLon: lon } : null;
}

function normaliseAddressText(value) {
  const aliases = { bvd: "boulevard", blvd: "boulevard", cct: "circuit", cnr: "corner", cr: "crescent", cres: "crescent", ct: "court", st: "street", rd: "road", ave: "avenue", dr: "drive", esp: "esplanade", hwy: "highway", mt: "mount", pkwy: "parkway", pwy: "parkway", pde: "parade", pl: "place", ln: "lane", sq: "square", tce: "terrace" };
  let text = String(value || "").toLowerCase();
  for (const [short, full] of Object.entries(aliases)) text = text.replace(new RegExp(`\\b${short}\\b`, "g"), full);
  return text.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

module.exports = { normaliseAddressText, normaliseSearchContext };
