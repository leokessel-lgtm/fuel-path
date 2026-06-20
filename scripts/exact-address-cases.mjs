export const STATE_ORDER = ["NSW", "ACT", "VIC", "QLD", "WA", "SA", "TAS", "NT"];

export const EXACT_ADDRESS_CASES = [
  c("nsw-suffix", "NSW", "suffix", "87A Corea Street, Sylvania NSW 2224", "87A Corea Street Sylvania NSW", "Sylvania", "2224", -34.0153146, 151.0997397, "87", "A", "Corea", "Street"),
  c("nsw-duplex", "NSW", "duplex", "66B Easton Avenue, Sylvania NSW 2224", "66B Easton Ave Sylvania", "Sylvania", "2224", -34.0114122, 151.0993847, "66", "B", "Easton", "Avenue"),
  c("act-unit", "ACT", "unit", "Unit 8, 21 Lanyon Drive, Tuggeranong ACT 2900", "8/21 Lanyon Drive Tuggeranong ACT", "Tuggeranong", "2900", -35.414, 149.065, "21", "", "Lanyon", "Drive", "Unit", "8"),
  c("act-townhouse", "ACT", "townhouse", "Townhouse 3, 44 Beltana Road, Pialligo ACT 2609", "Townhouse 3 44 Beltana Road Pialligo", "Pialligo", "2609", -35.302, 149.181, "44", "", "Beltana", "Road", "Townhouse", "3"),
  c("vic-unit", "VIC", "unit", "Unit 12, 80 Moorabool Street, Geelong VIC 3220", "12/80 Moorabool St Geelong VIC", "Geelong", "3220", -38.149, 144.361, "80", "", "Moorabool", "Street", "Unit", "12"),
  c("vic-townhouse", "VIC", "townhouse", "Townhouse 5, 19 Sturt Street, Ballarat VIC 3350", "Townhouse 5 19 Sturt St Ballarat", "Ballarat", "3350", -37.562, 143.85, "19", "", "Sturt", "Street", "Townhouse", "5"),
  c("qld-unit", "QLD", "unit", "Unit 4, 102 Abbott Street, Cairns QLD 4870", "4/102 Abbott Street Cairns QLD", "Cairns", "4870", -16.918, 145.778, "102", "", "Abbott", "Street", "Unit", "4"),
  c("qld-remote", "QLD", "remote", "34 Wonga Street, Longreach QLD 4730", "34 Wonga St Longreach QLD", "Longreach", "4730", -23.44, 144.25, "34", "", "Wonga", "Street"),
  c("wa-unit", "WA", "unit", "Unit 5, 34 South Coast Highway, Karratha WA 6714", "5/34 South Coast Highway Karratha", "Karratha", "6714", -20.736, 116.846, "34", "", "South Coast", "Highway", "Unit", "5"),
  c("wa-remote", "WA", "remote", "18 Robinson Street, Broome WA 6725", "18 Robinson St Broome WA", "Broome", "6725", -17.961, 122.236, "18", "", "Robinson", "Street"),
  c("sa-unit", "SA", "unit", "Unit 2, 77 Commercial Street, Mount Gambier SA 5290", "2/77 Commercial St Mount Gambier SA", "Mount Gambier", "5290", -37.829, 140.782, "77", "", "Commercial", "Street", "Unit", "2"),
  c("sa-remote", "SA", "remote", "9 Hutchison Street, Coober Pedy SA 5723", "9 Hutchison Street Coober Pedy SA", "Coober Pedy", "5723", -29.013, 134.754, "9", "", "Hutchison", "Street"),
  c("tas-unit", "TAS", "unit", "Unit 6, 55 Brisbane Street, Launceston TAS 7250", "6/55 Brisbane St Launceston TAS", "Launceston", "7250", -41.433, 147.144, "55", "", "Brisbane", "Street", "Unit", "6"),
  c("tas-remote", "TAS", "remote", "11 Orr Street, Queenstown TAS 7467", "11 Orr Street Queenstown TAS", "Queenstown", "7467", -42.0805, 145.5565, "11", "", "Orr", "Street"),
  c("nt-unit", "NT", "unit", "Unit 1, 10 Todd Street, Alice Springs NT 0870", "1/10 Todd Street Alice Springs NT", "Alice Springs", "0870", -23.698, 133.8807, "10", "", "Todd", "Street", "Unit", "1"),
  c("nt-remote", "NT", "remote", "22 Paterson Street, Tennant Creek NT 0860", "22 Paterson Street Tennant Creek NT", "Tennant Creek", "0860", -19.648, 134.191, "22", "", "Paterson", "Street"),
];

export function toGnafCorePsv(items = EXACT_ADDRESS_CASES) {
  const header = [
    "ADDRESS_DETAIL_PID",
    "ADDRESS_LABEL",
    "FLAT_TYPE",
    "FLAT_NUMBER",
    "NUMBER_FIRST",
    "NUMBER_FIRST_SUFFIX",
    "STREET_NAME",
    "STREET_TYPE",
    "LOCALITY_NAME",
    "STATE",
    "POSTCODE",
    "ALIAS_PRINCIPAL",
    "PRIMARY_SECONDARY",
    "GEOCODE_TYPE",
    "LONGITUDE",
    "LATITUDE",
  ];
  const rows = items.map((item) => [
    item.id.toUpperCase().replace(/[^A-Z0-9]+/g, ""),
    item.label,
    item.flatType || "",
    item.flatNumber || "",
    item.number,
    item.suffix || "",
    item.streetName,
    item.streetType,
    item.locality,
    item.state,
    item.postcode,
    "PRINCIPAL",
    item.flatNumber ? "SECONDARY" : "PRIMARY",
    item.accuracy || "PROPERTY CENTROID",
    String(item.lon),
    String(item.lat),
  ]);
  return [header, ...rows].map((row) => row.join("|")).join("\n");
}

function c(id, state, category, label, query, locality, postcode, lat, lon, number, suffix, streetName, streetType, flatType = "", flatNumber = "") {
  return { id, state, category, label, query, locality, postcode, lat, lon, number, suffix, streetName, streetType, flatType, flatNumber };
}
