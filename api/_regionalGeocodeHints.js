const REGIONAL_TOWNS = [
  // NSW.
  town("Griffith", "NSW", -34.2885, 146.0509, "2680"),
  town("Wagga Wagga", "NSW", -35.1082, 147.3598, "2650", ["wagga"]),
  town("Armidale", "NSW", -30.5147, 151.6658, "2350"),
  town("Dubbo", "NSW", -32.2569, 148.6011, "2830"),
  town("Tamworth", "NSW", -31.0927, 150.932, "2340"),
  town("Gosford", "NSW", -33.4269, 151.342, "2250"),
  town("Wauchope", "NSW", -31.4579, 152.733, "2446"),
  town("Lismore", "NSW", -28.8135, 153.2773, "2480"),
  town("Port Macquarie", "NSW", -31.4333, 152.9, "2444"),
  town("Broken Hill", "NSW", -31.9539, 141.4539, "2880"),
  town("Bathurst", "NSW", -33.4193, 149.5775, "2795"),
  town("Mudgee", "NSW", -32.5943, 149.5873, "2850"),
  town("Goulburn", "NSW", -34.7516, 149.7209, "2580"),
  town("Cowra", "NSW", -33.8356, 148.6966, "2794"),
  town("Orange", "NSW", -33.2839, 149.1004, "2800"),
  town("Moree", "NSW", -29.4658, 149.8339, "2400"),
  town("Bega", "NSW", -36.6745, 149.8411, "2550"),
  town("Cootamundra", "NSW", -34.6409, 148.0283, "2590"),
  town("Moruya", "NSW", -35.9125, 150.0814, "2537"),
  town("Narrabri", "NSW", -30.325, 149.7829, "2390"),
  town("Coffs Harbour", "NSW", -30.2963, 153.1135, "2450"),
  town("Byron Bay", "NSW", -28.6474, 153.602, "2481"),
  town("Parkes", "NSW", -33.1372, 148.1759, "2870"),
  town("Jenolan", "NSW", -33.8212, 150.0228, "2790"),
  town("Mungo", "NSW", -33.746, 143.133, "2715"),

  // ACT.
  town("Tharwa", "ACT", -35.512, 149.064, "2620"),
  town("Pialligo", "ACT", -35.303, 149.18, "2609"),
  town("Weston Creek", "ACT", -35.341, 149.052, "2611"),
  town("Nicholls", "ACT", -35.188, 149.096, "2913"),
  town("Denman Prospect", "ACT", -35.307, 149.022, "2611"),
  town("Weston", "ACT", -35.341, 149.052, "2611"),
  town("Florey", "ACT", -35.224, 149.053, "2615"),
  town("Conder", "ACT", -35.459, 149.094, "2906"),
  town("Gowrie", "ACT", -35.414, 149.113, "2904"),
  town("Mawson", "ACT", -35.364, 149.098, "2607"),
  town("Ainslie", "ACT", -35.262, 149.147, "2602"),
  town("Braddon", "ACT", -35.271, 149.135, "2612"),
  town("Lyneham", "ACT", -35.252, 149.126, "2602"),
  town("Greenway", "ACT", -35.416, 149.067, "2900"),
  town("Belconnen", "ACT", -35.238, 149.066, "2617"),
  town("Gordon", "ACT", -35.456, 149.083, "2906"),
  town("Wanniassa", "ACT", -35.398, 149.091, "2903"),
  town("Gungahlin", "ACT", -35.186, 149.136, "2912"),
  town("Kambah", "ACT", -35.388, 149.058, "2902"),
  town("Hume", "ACT", -35.384, 149.166, "2620"),
  town("Hall", "ACT", -35.171, 149.069, "2618"),
  town("Uriarra Village", "ACT", -35.247, 148.912, "2611", ["uriarra"]),
  town("Stromlo", "ACT", -35.318, 149.006, "2611"),
  town("Holt", "ACT", -35.225, 149.018, "2615"),
  town("Charnwood", "ACT", -35.205, 149.034, "2615"),
  town("Kaleen", "ACT", -35.219, 149.105, "2617"),

  // QLD.
  town("Townsville", "QLD", -19.259, 146.817, "4810"),
  town("Cairns", "QLD", -16.9186, 145.7781, "4870"),
  town("Rockhampton", "QLD", -23.3789, 150.5135, "4700"),
  town("Mackay", "QLD", -21.1411, 149.1858, "4740"),
  town("Toowoomba", "QLD", -27.5598, 151.9507, "4350"),
  town("Bundaberg", "QLD", -24.8661, 152.3489, "4670"),
  town("Maryborough", "QLD", -25.54, 152.704, "4650"),
  town("Gladstone", "QLD", -23.8427, 151.2555, "4680"),
  town("Gympie", "QLD", -26.19, 152.665, "4570"),
  town("Kingaroy", "QLD", -26.5396, 151.837, "4610"),
  town("Dalby", "QLD", -27.1817, 151.2621, "4405"),
  town("Charters Towers", "QLD", -20.0767, 146.2635, "4820"),
  town("Bowen", "QLD", -20.0137, 148.2475, "4805"),
  town("Atherton", "QLD", -17.268, 145.475, "4883"),
  town("Innisfail", "QLD", -17.522, 146.031, "4860"),
  town("Blackall", "QLD", -24.4234, 145.4634, "4472"),
  town("Clermont", "QLD", -22.824, 147.6403, "4721"),
  town("Longreach", "QLD", -23.44, 144.25, "4730"),
  town("Mount Isa", "QLD", -20.7256, 139.4927, "4825"),
  town("Roma", "QLD", -26.5734, 148.7875, "4455"),
  town("Mossman", "QLD", -16.462, 145.372, "4873"),
  town("Hervey Bay", "QLD", -25.288, 152.839, "4655"),

  // WA.
  town("Kalgoorlie", "WA", -30.747, 121.472, "6430"),
  town("Geraldton", "WA", -28.777, 114.614, "6530"),
  town("Broome", "WA", -17.961, 122.236, "6725"),
  town("Albany", "WA", -35.0275, 117.884, "6330"),
  town("Bunbury", "WA", -33.327, 115.641, "6230"),
  town("Carnarvon", "WA", -24.882, 113.657, "6701"),
  town("Collie", "WA", -33.361, 116.156, "6225"),
  town("Esperance", "WA", -33.861, 121.891, "6450"),
  town("Pemberton", "WA", -34.443, 116.036, "6260"),
  town("Northam", "WA", -31.654, 116.671, "6401"),
  town("Katanning", "WA", -33.689, 117.555, "6317"),
  town("Narrogin", "WA", -32.932, 117.177, "6312"),
  town("Kununurra", "WA", -15.778, 128.741, "6743"),
  town("Port Hedland", "WA", -20.31, 118.606, "6721"),
  town("Karratha", "WA", -20.736, 116.846, "6714"),
  town("Pinjarra", "WA", -32.629, 115.874, "6208"),
  town("Mandurah", "WA", -32.536, 115.742, "6210"),
  town("Denmark", "WA", -34.96, 117.353, "6333"),
  town("Manjimup", "WA", -34.241, 116.146, "6258"),
  town("Merredin", "WA", -31.482, 118.279, "6415"),
  town("Exmouth", "WA", -21.93, 114.126, "6707"),
  town("Hyden", "WA", -32.449, 118.861, "6359"),
  town("Karijini", "WA", -22.391, 118.284, "6751"),
  town("Margaret River", "WA", -33.953, 115.073, "6285"),

  // SA.
  town("Mount Gambier", "SA", -37.829, 140.782, "5290"),
  town("Port Pirie", "SA", -33.177, 138.008, "5540"),
  town("Whyalla", "SA", -33.033, 137.584, "5600"),
  town("Gawler", "SA", -34.6, 138.748, "5118"),
  town("Murray Bridge", "SA", -35.119, 139.273, "5253"),
  town("Victor Harbor", "SA", -35.55, 138.621, "5211"),
  town("Kadina", "SA", -33.964, 137.716, "5554"),
  town("Port Augusta", "SA", -32.495, 137.762, "5700"),
  town("Goolwa", "SA", -35.501, 138.784, "5214"),
  town("Barmera", "SA", -34.254, 140.462, "5345"),
  town("Loxton", "SA", -34.451, 140.569, "5333"),
  town("Clare", "SA", -33.833, 138.611, "5453"),
  town("Berri", "SA", -34.281, 140.599, "5343"),
  town("Ceduna", "SA", -32.126, 133.672, "5690"),
  town("Coober Pedy", "SA", -29.013, 134.754, "5723"),
  town("Mannum", "SA", -34.912, 139.314, "5238"),
  town("Port Lincoln", "SA", -34.72, 135.858, "5606"),
  town("Moonta", "SA", -34.068, 137.59, "5558"),
  town("Renmark", "SA", -34.177, 140.746, "5341"),
  town("Naracoorte", "SA", -36.957, 140.742, "5271"),
  town("Tanunda", "SA", -34.525, 138.959, "5352"),
  town("Wallaroo", "SA", -33.932, 137.625, "5556"),
  town("Wilpena Pound", "SA", -31.527, 138.62, "5434"),
];

const REGIONAL_POIS = [
  // NSW.
  poi("Taronga Western Plains Zoo Dubbo", "NSW", "Dubbo"),
  poi("The Big Banana Coffs Harbour", "NSW", "Coffs Harbour"),
  poi("Jenolan Caves NSW", "NSW", "Jenolan"),
  poi("Mungo National Park", "NSW", "Mungo"),
  poi("Mount Panorama Bathurst", "NSW", "Bathurst"),
  poi("Parkes Observatory", "NSW", "Parkes"),
  poi("Port Macquarie Base Hospital", "NSW", "Port Macquarie"),
  poi("Wagga Wagga Airport", "NSW", "Wagga Wagga"),
  poi("Tamworth Regional Entertainment Centre", "NSW", "Tamworth"),
  poi("Broken Hill Airport", "NSW", "Broken Hill"),
  poi("Byron Bay Lighthouse", "NSW", "Byron Bay"),
  poi("Goulburn Big Merino", "NSW", "Goulburn"),
  poi("Orange Health Service", "NSW", "Orange"),
  poi("Dubbo Regional Botanic Garden", "NSW", "Dubbo"),
  poi("Griffith Base Hospital", "NSW", "Griffith"),
  poi("Lismore Base Hospital", "NSW", "Lismore"),
  poi("Bega Cheese Heritage Centre", "NSW", "Bega"),
  poi("Moruya Airport", "NSW", "Moruya"),
  poi("Cowra Japanese Garden", "NSW", "Cowra"),
  poi("Armidale Airport", "NSW", "Armidale"),

  // ACT.
  poi("Tidbinbilla Nature Reserve", "ACT", "Tharwa"),
  poi("Namadgi National Park Visitor Centre", "ACT", "Tharwa"),
  poi("Canberra Deep Space Communication Complex", "ACT", "Tharwa"),
  poi("National Arboretum Canberra", "ACT", "Stromlo"),
  poi("Stromlo Forest Park", "ACT", "Stromlo"),
  poi("Canberra Reptile Zoo", "ACT", "Nicholls"),
  poi("Gold Creek Village", "ACT", "Nicholls"),
  poi("Lanyon Homestead", "ACT", "Tharwa"),
  poi("Canberra Brickworks", "ACT", "Yarralumla", -35.306, 149.098),
  poi("Canberra Walk In Aviary", "ACT", "Nicholls"),
  poi("Mugga Lane Resource Management Centre", "ACT", "Hume"),
  poi("Canberra Railway Museum", "ACT", "Kingston", -35.318, 149.149),
  poi("Kambah Village", "ACT", "Kambah", -35.388, 149.058),
  poi("Erindale Shopping Centre", "ACT", "Wanniassa"),
  poi("Calvary Public Hospital Bruce", "ACT", "Belconnen"),
  poi("University of Canberra Hospital", "ACT", "Belconnen"),
  poi("Canberra Nature Park Mount Taylor", "ACT", "Kambah"),
  poi("Tuggeranong Hyperdome", "ACT", "Greenway"),
  poi("EPIC Canberra", "ACT", "Lyneham"),
  poi("Australian Institute of Sport", "ACT", "Belconnen"),

  // QLD.
  poi("Australian Stockman's Hall of Fame Longreach", "QLD", "Longreach"),
  poi("Qantas Founders Museum Longreach", "QLD", "Longreach"),
  poi("Carnarvon Gorge Visitor Area", "QLD", "Roma", -25.054, 148.218),
  poi("Mossman Gorge Centre", "QLD", "Mossman"),
  poi("Paronella Park", "QLD", "Innisfail"),
  poi("Hervey Bay Airport", "QLD", "Hervey Bay"),
  poi("Bundaberg Rum Distillery", "QLD", "Bundaberg"),
  poi("Rockhampton Airport", "QLD", "Rockhampton"),
  poi("Mackay Base Hospital", "QLD", "Mackay"),
  poi("Toowoomba Wellcamp Airport", "QLD", "Toowoomba"),
  poi("Cairns Hospital", "QLD", "Cairns"),
  poi("Townsville University Hospital", "QLD", "Townsville"),
  poi("Mount Isa Mines Rodeo", "QLD", "Mount Isa"),
  poi("Roma Big Rig", "QLD", "Roma"),
  poi("Maryborough City Hall", "QLD", "Maryborough"),
  poi("Gympie Hospital", "QLD", "Gympie"),
  poi("Dalby Hospital", "QLD", "Dalby"),
  poi("Kingaroy Peanut Van", "QLD", "Kingaroy"),
  poi("Charters Towers Venus Gold Battery", "QLD", "Charters Towers"),
  poi("Bowen Big Mango", "QLD", "Bowen"),

  // WA.
  poi("Wave Rock Hyden", "WA", "Hyden"),
  poi("Horizontal Falls WA", "WA", "Broome", -16.381, 123.957),
  poi("Bungle Bungle Visitor Centre", "WA", "Kununurra", -17.464, 128.373),
  poi("Karijini Visitor Centre", "WA", "Karijini"),
  poi("Ningaloo Centre Exmouth", "WA", "Exmouth"),
  poi("Kalgoorlie Super Pit Lookout", "WA", "Kalgoorlie"),
  poi("Geraldton Airport", "WA", "Geraldton"),
  poi("Broome International Airport", "WA", "Broome"),
  poi("Albany Health Campus", "WA", "Albany"),
  poi("Bunbury Regional Hospital", "WA", "Bunbury"),
  poi("Esperance Airport", "WA", "Esperance"),
  poi("Carnarvon Space and Technology Museum", "WA", "Carnarvon"),
  poi("The Gap Albany", "WA", "Albany"),
  poi("Valley of the Giants Tree Top Walk", "WA", "Denmark"),
  poi("Pinnacles Desert Discovery Centre", "WA", "Cervantes", -30.603, 115.156),
  poi("Margaret River Visitor Centre", "WA", "Margaret River"),
  poi("Kununurra Airport", "WA", "Kununurra"),
  poi("Port Hedland International Airport", "WA", "Port Hedland"),
  poi("Karratha Health Campus", "WA", "Karratha"),
  poi("Denmark Visitor Centre", "WA", "Denmark"),

  // SA.
  poi("Naracoorte Caves National Park", "SA", "Naracoorte"),
  poi("Wilpena Pound Resort", "SA", "Wilpena Pound"),
  poi("Umpherston Sinkhole", "SA", "Mount Gambier"),
  poi("Blue Lake Mount Gambier", "SA", "Mount Gambier"),
  poi("Port Lincoln Airport", "SA", "Port Lincoln"),
  poi("Whyalla Hospital", "SA", "Whyalla"),
  poi("Murray Bridge Soldiers Memorial Hospital", "SA", "Murray Bridge"),
  poi("Victor Harbor Horse Drawn Tram", "SA", "Victor Harbor"),
  poi("Monarto Safari Park", "SA", "Murray Bridge"),
  poi("Clare Valley Wine Food Tourism Centre", "SA", "Clare"),
  poi("Coober Pedy Visitor Information Centre", "SA", "Coober Pedy"),
  poi("Ceduna Airport", "SA", "Ceduna"),
  poi("Port Augusta Hospital", "SA", "Port Augusta"),
  poi("Renmark Paringa Visitor Information Centre", "SA", "Renmark"),
  poi("Barossa Visitor Centre Tanunda", "SA", "Tanunda"),
  poi("Wallaroo Jetty", "SA", "Wallaroo"),
  poi("Gawler Health Service", "SA", "Gawler"),
  poi("Berri Hospital", "SA", "Berri"),
  poi("Port Pirie Regional Health Service", "SA", "Port Pirie"),
  poi("Moonta Mines Museum", "SA", "Moonta"),
];

function regionalLocalGeocode(query, limit = 5) {
  const needle = normalise(query);
  if (needle.length < 3) return [];
  const state = detectStateCode(query);
  const rows = [];

  const street = streetFallback(query, state);
  if (street) rows.push(street);

  for (const place of [...REGIONAL_POIS, ...REGIONAL_TOWNS]) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
    if (state && place.state !== state) continue;
    const match = matchPlace(needle, place);
    if (!match) continue;
    rows.push({
      score: match.score,
      item: regionalItem(place.label, place.lat, place.lon, place.kind, {
        confidence: match.confidence,
        matchType: match.matchType,
        state: place.state,
        postcode: place.postcode,
      }),
    });
  }

  return rows
    .sort((left, right) => left.score - right.score || left.item.label.length - right.item.label.length)
    .slice(0, limit)
    .map((row) => row.item);
}

function regionalGeocodeHintStatus() {
  return {
    regionalTownRecords: REGIONAL_TOWNS.length,
    regionalPoiRecords: REGIONAL_POIS.length,
    regionalProvider: "fuel_path_regional_gazetteer",
  };
}

function streetFallback(query, state) {
  const text = String(query || "").trim().replace(/\s+/g, " ");
  const pattern = /\b(?:\d+[a-z]?\s+)?([a-z][a-z\s'.-]+?\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|terrace|highway|mall|court|close|vista|circuit|way|lane|ln))\b\s+(.+?)(?:\s+\b(NSW|ACT|QLD|WA|SA)\b|\s*$)/i;
  const match = pattern.exec(text);
  if (!match) return null;
  const streetName = titleCase(expandStreetType(match[1]));
  const localityText = match[2];
  const resolvedState = state || (match[3] ? match[3].toUpperCase() : "");
  const town = findTown(localityText, resolvedState);
  if (!town) return null;
  return {
    score: 6,
    item: regionalItem(`${streetName}, ${town.name} ${town.state}${town.postcode ? ` ${town.postcode}` : ""}`, town.lat, town.lon, "street", {
      confidence: "low",
      matchType: "regional_street_locality",
      state: town.state,
      postcode: town.postcode,
      locality: town.name,
      accuracy: "town_centre_street_fallback",
    }),
  };
}

function findTown(value, state) {
  const needle = normalise(value);
  const candidates = state ? REGIONAL_TOWNS.filter((townRecord) => townRecord.state === state) : REGIONAL_TOWNS;
  return candidates.find((townRecord) =>
    townRecord.searchTexts.some((text) => text === needle || needle.includes(text) || text.includes(needle)),
  );
}

function matchPlace(needle, place) {
  for (const text of place.searchTexts) {
    if (needle === text) return { score: 0, confidence: "medium", matchType: "regional_exact" };
    if (text.startsWith(needle)) return { score: 8, confidence: "medium", matchType: "regional_prefix" };
    if (text.includes(needle)) return { score: 12, confidence: "medium", matchType: "regional_contains" };
    if (needle.includes(text) && text.length >= 5) return { score: 18, confidence: "low", matchType: "regional_area_fallback" };
  }
  return null;
}

function town(name, state, lat, lon, postcode = "", aliases = []) {
  const label = `${name} ${state}${postcode ? ` ${postcode}` : ""}`;
  return placeRecord({ label, name, state, lat, lon, postcode, kind: "regional_town", aliases });
}

function poi(label, state, townName, lat, lon, aliases = []) {
  const townRecord = findTown(townName, state);
  const resolvedLat = lat ?? townRecord?.lat;
  const resolvedLon = lon ?? townRecord?.lon;
  return placeRecord({
    label: townRecord && !new RegExp(`\\b${townRecord.name}\\b`, "i").test(label)
      ? `${label}, ${townRecord.name} ${state}${townRecord.postcode ? ` ${townRecord.postcode}` : ""}`
      : label,
    name: label,
    state,
    lat: resolvedLat,
    lon: resolvedLon,
    postcode: townRecord?.postcode || "",
    kind: "regional_poi",
    aliases,
  });
}

function placeRecord({ label, name, state, lat, lon, postcode = "", kind, aliases = [] }) {
  return {
    label,
    name,
    state,
    lat,
    lon,
    postcode,
    kind,
    aliases,
    searchTexts: [...new Set([label, name, ...aliases].map(normalise).filter(Boolean))],
  };
}

function regionalItem(label, lat, lon, kind, extra) {
  return {
    label,
    lat: Number(lat),
    lon: Number(lon),
    type: kind,
    provider: "fuel_path_regional_gazetteer",
    providerId: normalise(label),
    source: "regional_geocode_gazetteer",
    ...extra,
  };
}

function detectStateCode(value) {
  const text = String(value || "").toUpperCase();
  return ["NSW", "ACT", "QLD", "WA", "SA"].find((code) => new RegExp(`\\b${code}\\b`).test(text)) || "";
}

function expandStreetType(value) {
  return String(value || "")
    .replace(/\bst\b/gi, "Street")
    .replace(/\brd\b/gi, "Road")
    .replace(/\bave\b/gi, "Avenue")
    .replace(/\bdr\b/gi, "Drive")
    .replace(/\bpde\b/gi, "Parade")
    .replace(/\bpl\b/gi, "Place")
    .replace(/\bln\b/gi, "Lane");
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

module.exports = {
  regionalGeocodeHintStatus,
  regionalLocalGeocode,
};
