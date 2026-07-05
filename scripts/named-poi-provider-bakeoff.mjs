#!/usr/bin/env node
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv();

const RUN_ID = env("FUEL_PATH_POI_BAKEOFF_RUN_ID") || new Date().toISOString().replace(/[:.]/g, "-");
const OUT_DIR = env("FUEL_PATH_POI_BAKEOFF_OUT_DIR") || "tmp";
const LIMIT = numberEnv("FUEL_PATH_POI_BAKEOFF_LIMIT", 5);
const CASE_LIMIT = numberEnv("FUEL_PATH_POI_BAKEOFF_CASE_LIMIT", 80);
const REQUEST_TIMEOUT_MS = numberEnv("FUEL_PATH_POI_BAKEOFF_TIMEOUT_MS", 10000);
const DELAY_MS = numberEnv("FUEL_PATH_POI_BAKEOFF_DELAY_MS", 150);
const GOOGLE_DETAILS_ENABLED = boolEnv("FUEL_PATH_POI_BAKEOFF_GOOGLE_DETAILS");
const ALLOW_BILLABLE = boolEnv("FUEL_PATH_POI_BAKEOFF_ALLOW_BILLABLE");
const PROVIDERS = parseProviders(env("FUEL_PATH_POI_BAKEOFF_PROVIDERS") || "google,here,tomtom");

const KEYS = {
  google: env("FUEL_PATH_GOOGLE_PLACES_API_KEY") || env("FUEL_PATH_GOOGLE_MAPS_API_KEY") || env("GOOGLE_MAPS_API_KEY"),
  here: env("FUEL_PATH_HERE_API_KEY") || env("HERE_API_KEY"),
  tomtom: env("FUEL_PATH_TOMTOM_API_KEY") || env("TOMTOM_API_KEY"),
};

const COST_MODEL = {
  google: {
    currency: "USD",
    pricingStatus: "estimate_required",
    source: "https://developers.google.com/maps/documentation/places/web-service/usage-and-billing",
    notes: [
      "Uses Google Places Autocomplete by default.",
      "Place Details is disabled by default because it can add extra billable calls.",
      "Set FUEL_PATH_GOOGLE_PLACES_AUTOCOMPLETE_PER_1000_USD and FUEL_PATH_GOOGLE_PLACE_DETAILS_PER_1000_USD to model current account pricing.",
    ],
    per1000: {
      autocomplete: numberEnv("FUEL_PATH_GOOGLE_PLACES_AUTOCOMPLETE_PER_1000_USD", NaN),
      details: numberEnv("FUEL_PATH_GOOGLE_PLACE_DETAILS_PER_1000_USD", NaN),
    },
  },
  here: {
    currency: "USD",
    pricingStatus: "estimate_required",
    source: "https://www.here.com/get-started/pricing",
    notes: [
      "HERE is transaction-based/pay-as-you-grow; exact account pricing should be confirmed in HERE console or contract.",
      "Set FUEL_PATH_HERE_SEARCH_PER_1000_USD to model current account pricing.",
    ],
    per1000: {
      search: numberEnv("FUEL_PATH_HERE_SEARCH_PER_1000_USD", NaN),
    },
  },
  tomtom: {
    currency: "USD",
    pricingStatus: "estimate_required",
    source: "https://docs.tomtom.com/pricing/",
    notes: [
      "TomTom documents free monthly requests and usage-based pricing; exact current Search API account pricing should be confirmed in TomTom console.",
      "Set FUEL_PATH_TOMTOM_SEARCH_PER_1000_USD to model current account pricing.",
    ],
    per1000: {
      search: numberEnv("FUEL_PATH_TOMTOM_SEARCH_PER_1000_USD", NaN),
    },
  },
};

const CASES = [
  poi("Sylvania Heights Public School", "NSW", -34.014, 151.104, ["sylvania heights public school"]),
  poi("Prince Hotel Kirrawee", "NSW", -34.034, 151.071, ["prince hotel", "kirrawee"]),
  poi("Audley Royal National Park", "NSW", -34.075, 151.057, ["audley", "royal national park"]),
  poi("Aussie World Sunshine Coast", "QLD", -26.746, 153.047, ["aussie world"]),
  poi("Bunnings Mentone", "VIC", -37.982, 145.07, ["bunnings", "mentone"]),
  poi("Westfield Chermside", "QLD", -27.384, 153.032, ["westfield", "chermside"]),
  poi("Sydney Airport", "NSW", -33.94, 151.175, ["sydney airport"]),
  poi("Royal Prince Alfred Hospital", "NSW", -33.889, 151.183, ["royal prince alfred"]),
  poi("Taronga Zoo", "NSW", -33.843, 151.241, ["taronga zoo"]),
  poi("Katoomba Station", "NSW", -33.712, 150.311, ["katoomba station"]),
  poi("Margaret River Visitor Centre", "WA", -33.951, 115.073, ["margaret river visitor centre"]),
  poi("Fremantle Hospital", "WA", -32.055, 115.753, ["fremantle hospital"]),
  poi("Kings Park Perth", "WA", -31.96, 115.832, ["kings park"]),
  poi("Perth Airport", "WA", -31.94, 115.967, ["perth airport"]),
  poi("Monash University Clayton", "VIC", -37.911, 145.134, ["monash university", "clayton"]),
  poi("Federation Square Melbourne", "VIC", -37.817, 144.969, ["federation square"]),
  poi("Melbourne High School", "VIC", -37.835, 144.985, ["melbourne high school"]),
  poi("Queen Victoria Market", "VIC", -37.807, 144.956, ["queen victoria market"]),
  poi("The Gabba Brisbane", "QLD", -27.486, 153.038, ["gabba"]),
  poi("South Bank Parklands Brisbane", "QLD", -27.479, 153.023, ["south bank parklands"]),
  poi("Noosa Heads Surf Life Saving Club", "QLD", -26.386, 153.091, ["noosa heads surf"]),
  poi("Cairns Hospital", "QLD", -16.912, 145.768, ["cairns hospital"]),
  poi("Rundle Mall Adelaide", "SA", -34.923, 138.603, ["rundle mall"]),
  poi("Flinders Medical Centre", "SA", -35.021, 138.568, ["flinders medical centre"]),
  aliasPoi("Mount Gambier Airport", "SA", -37.746, 140.785, ["mount gambier airport"], ["mount gambier regional airport"]),
  poi("Monarto Safari Park", "SA", -35.094, 139.142, ["monarto safari park"]),
  poi("Salamanca Market Hobart", "TAS", -42.886, 147.331, ["salamanca market"]),
  poi("Royal Hobart Hospital", "TAS", -42.881, 147.329, ["royal hobart hospital"]),
  poi("Launceston Airport", "TAS", -41.545, 147.214, ["launceston airport"]),
  poi("Cradle Mountain Visitor Centre", "TAS", -41.584, 145.934, ["cradle mountain visitor centre"]),
  poi("Parliament House Canberra", "ACT", -35.308, 149.125, ["parliament house"]),
  aliasPoi("Australian National University", "ACT", -35.277, 149.118, ["australian national university"], ["university avenue"]),
  poi("Canberra Hospital", "ACT", -35.345, 149.101, ["canberra hospital"]),
  poi("Access Canberra Dickson", "ACT", -35.25, 149.139, ["access canberra", "dickson"]),
  poi("Darwin Waterfront", "NT", -12.467, 130.846, ["darwin waterfront"]),
  poi("Royal Darwin Hospital", "NT", -12.356, 130.881, ["royal darwin hospital"]),
  poi("Casuarina Square", "NT", -12.373, 130.881, ["casuarina square"]),
  poi("Katherine Hospital", "NT", -14.463, 132.265, ["katherine hospital"]),
  poi("Service NSW Parramatta", "NSW", -33.814, 151.005, ["service nsw", "parramatta"]),
  poi("Service Victoria Bendigo", "VIC", -36.757, 144.279, ["service victoria", "bendigo"]),
  poi("Service Tasmania Hobart", "TAS", -42.882, 147.327, ["service tasmania", "hobart"]),
  poi("Access Canberra Belconnen", "ACT", -35.238, 149.067, ["access canberra", "belconnen"]),
  poi("Springwood NSW", "NSW", -33.7, 150.563, ["springwood"]),
  poi("Emu Plains NSW", "NSW", -33.751, 150.66, ["emu plains"]),
  poi("Hyde Park Sydney", "NSW", -33.873, 151.211, ["hyde park"]),
  poi("Service NSW Miranda", "NSW", -34.035, 151.1, ["service nsw", "miranda"]),
  poi("Service NSW Newcastle", "NSW", -32.928, 151.781, ["service nsw", "newcastle"]),
  poi("Wollongong Hospital", "NSW", -34.425, 150.883, ["wollongong hospital"]),
  poi("University of Wollongong", "NSW", -34.406, 150.879, ["university of wollongong"]),
  poi("Newcastle Interchange", "NSW", -32.924, 151.76, ["newcastle interchange"]),
  poi("John Hunter Hospital", "NSW", -32.922, 151.694, ["john hunter hospital"]),
  aliasPoi("Byron Bay Visitor Centre", "NSW", -28.644, 153.612, ["byron bay visitor centre"], ["byron visitor centre"]),
  poi("Coffs Harbour Airport", "NSW", -30.32, 153.116, ["coffs harbour airport"]),
  poi("Port Macquarie Base Hospital", "NSW", -31.456, 152.876, ["port macquarie base hospital"]),
  aliasPoi("Tamworth Regional Entertainment Centre", "NSW", -31.083, 150.93, ["tamworth regional entertainment centre"], ["tamworth regional entertainment and conference centre", "trecc"]),
  poi("Dubbo Base Hospital", "NSW", -32.243, 148.619, ["dubbo base hospital"]),
  poi("Orange Health Service", "NSW", -33.316, 149.095, ["orange health service"]),
  poi("Bathurst Visitor Information Centre", "NSW", -33.419, 149.578, ["bathurst visitor information centre"]),
  poi("Wagga Wagga Base Hospital", "NSW", -35.12, 147.357, ["wagga wagga base hospital"]),
  poi("Albury Airport", "NSW", -36.068, 146.958, ["albury airport"]),
  poi("Blue Mountains Hospital", "NSW", -33.713, 150.331, ["blue mountains hospital"]),
  poi("Scenic World Katoomba", "NSW", -33.729, 150.301, ["scenic world"]),
  poi("Blacktown Hospital", "NSW", -33.775, 150.917, ["blacktown hospital"]),
  poi("Westmead Hospital", "NSW", -33.804, 150.989, ["westmead hospital"]),
  poi("Macquarie University", "NSW", -33.775, 151.112, ["macquarie university"]),
  poi("Chatswood Chase Sydney", "NSW", -33.795, 151.185, ["chatswood chase"]),
  poi("Bondi Junction Station", "NSW", -33.891, 151.248, ["bondi junction"]),
  poi("Manly Wharf", "NSW", -33.8, 151.284, ["manly wharf"]),
  poi("Cronulla Beach", "NSW", -34.057, 151.153, ["cronulla beach"]),
  poi("Royal North Shore Hospital", "NSW", -33.82, 151.189, ["royal north shore hospital"]),
  poi("Service NSW Wetherill Park", "NSW", -33.849, 150.897, ["service nsw", "wetherill park"]),
  poi("Sydney Olympic Park", "NSW", -33.849, 151.068, ["sydney olympic park"]),
  poi("Geelong Station", "VIC", -38.145, 144.36, ["geelong station"]),
  poi("Ballarat Base Hospital", "VIC", -37.557, 143.847, ["ballarat base hospital"]),
  poi("Bendigo Marketplace", "VIC", -36.762, 144.28, ["bendigo marketplace"]),
  poi("Bendigo Hospital", "VIC", -36.749, 144.282, ["bendigo hospital"]),
  poi("Frankston Hospital", "VIC", -38.151, 145.13, ["frankston hospital"]),
  aliasPoi("Dandenong Plaza", "VIC", -37.988, 145.217, ["dandenong plaza"], ["dandenong square"]),
  poi("Chadstone Shopping Centre", "VIC", -37.886, 145.083, ["chadstone"]),
  poi("Southern Cross Station", "VIC", -37.818, 144.952, ["southern cross station"]),
  poi("Royal Melbourne Hospital", "VIC", -37.799, 144.956, ["royal melbourne hospital"]),
  poi("University of Melbourne", "VIC", -37.798, 144.961, ["university of melbourne"]),
  poi("Deakin University Burwood", "VIC", -37.848, 145.114, ["deakin university", "burwood"]),
  poi("Werribee Open Range Zoo", "VIC", -37.917, 144.67, ["werribee open range zoo"]),
  aliasPoi("Great Ocean Road Chocolaterie", "VIC", -38.314, 144.101, ["great ocean road chocolaterie"], ["the chocolateries great ocean road"]),
  poi("Twelve Apostles Visitor Centre", "VIC", -38.665, 143.104, ["twelve apostles"]),
  poi("Phillip Island Penguin Parade", "VIC", -38.505, 145.151, ["penguin parade"]),
  poi("Mornington Peninsula Hot Springs", "VIC", -38.407, 144.854, ["peninsula hot springs"]),
  poi("Traralgon Railway Station", "VIC", -38.196, 146.54, ["traralgon"]),
  aliasPoi("Shepparton Hospital", "VIC", -36.362, 145.403, ["shepparton hospital"], ["goulburn valley health"]),
  poi("Mildura Airport", "VIC", -34.229, 142.086, ["mildura airport"]),
  poi("Wangaratta Station", "VIC", -36.356, 146.318, ["wangaratta station"]),
  poi("Horsham Town Hall", "VIC", -36.714, 142.199, ["horsham town hall"]),
  aliasPoi("Warrnambool Base Hospital", "VIC", -38.383, 142.485, ["warrnambool base hospital"], ["southwest health care warrnambool"]),
  poi("Service Victoria Geelong", "VIC", -38.147, 144.361, ["service victoria", "geelong"]),
  poi("Service Victoria Ballarat", "VIC", -37.562, 143.85, ["service victoria", "ballarat"]),
  poi("Gold Coast University Hospital", "QLD", -27.96, 153.38, ["gold coast university hospital"]),
  poi("Robina Town Centre", "QLD", -28.077, 153.385, ["robina town centre"]),
  poi("Pacific Fair", "QLD", -28.036, 153.427, ["pacific fair"]),
  poi("Surfers Paradise Beach", "QLD", -28.003, 153.43, ["surfers paradise beach"]),
  poi("Brisbane Airport", "QLD", -27.394, 153.121, ["brisbane airport"]),
  poi("Roma Street Station", "QLD", -27.466, 153.019, ["roma street station"]),
  poi("Queensland Children's Hospital", "QLD", -27.484, 153.027, ["queensland children's hospital"]),
  poi("Royal Brisbane and Women's Hospital", "QLD", -27.447, 153.028, ["royal brisbane"]),
  poi("University of Queensland St Lucia", "QLD", -27.497, 153.013, ["university of queensland"]),
  poi("Mater Hospital Brisbane", "QLD", -27.484, 153.027, ["mater hospital"]),
  poi("Logan Hospital", "QLD", -27.67, 153.14, ["logan hospital"]),
  poi("Ipswich Hospital", "QLD", -27.619, 152.761, ["ipswich hospital"]),
  poi("Toowoomba Hospital", "QLD", -27.56, 151.952, ["toowoomba hospital"]),
  poi("Sunshine Plaza Maroochydore", "QLD", -26.657, 153.09, ["sunshine plaza"]),
  poi("Noosa Civic", "QLD", -26.414, 153.047, ["noosa civic"]),
  poi("Hervey Bay Hospital", "QLD", -25.3, 152.823, ["hervey bay hospital"]),
  poi("Bundaberg Hospital", "QLD", -24.868, 152.342, ["bundaberg hospital"]),
  poi("Rockhampton Airport", "QLD", -23.381, 150.475, ["rockhampton airport"]),
  poi("Mackay Base Hospital", "QLD", -21.155, 149.164, ["mackay base hospital"]),
  poi("Townsville University Hospital", "QLD", -19.321, 146.762, ["townsville university hospital"]),
  poi("James Cook University Townsville", "QLD", -19.329, 146.759, ["james cook university"]),
  poi("Cairns Central", "QLD", -16.925, 145.771, ["cairns central"]),
  poi("Port Douglas Marina", "QLD", -16.484, 145.461, ["port douglas marina"]),
  poi("Airlie Beach Lagoon", "QLD", -20.267, 148.717, ["airlie beach lagoon"]),
  poi("Australia Zoo Beerwah", "QLD", -26.835, 152.959, ["australia zoo"]),
  poi("Mooloolaba Beach", "QLD", -26.681, 153.12, ["mooloolaba beach"]),
  poi("Joondalup Health Campus", "WA", -31.742, 115.771, ["joondalup health campus"]),
  poi("Fiona Stanley Hospital", "WA", -32.07, 115.845, ["fiona stanley hospital"]),
  poi("Murdoch University", "WA", -32.067, 115.835, ["murdoch university"]),
  poi("Curtin University Bentley", "WA", -32.006, 115.894, ["curtin university"]),
  poi("Claremont Quarter", "WA", -31.981, 115.781, ["claremont quarter"]),
  poi("Midland Gate", "WA", -31.89, 116.011, ["midland gate"]),
  poi("Carousel Cannington", "WA", -32.018, 115.936, ["carousel"]),
  poi("Fremantle Markets", "WA", -32.057, 115.749, ["fremantle markets"]),
  poi("Rockingham General Hospital", "WA", -32.288, 115.747, ["rockingham general hospital"]),
  poi("Mandurah Forum", "WA", -32.537, 115.741, ["mandurah forum"]),
  poi("Bunbury Hospital", "WA", -33.365, 115.638, ["bunbury hospital"]),
  poi("Busselton Jetty", "WA", -33.644, 115.345, ["busselton jetty"]),
  poi("Albany Health Campus", "WA", -35.015, 117.884, ["albany health campus"]),
  aliasPoi("Kalgoorlie Airport", "WA", -30.79, 121.461, ["kalgoorlie airport"], ["kalgoorlie boulder airport"]),
  poi("Geraldton Hospital", "WA", -28.777, 114.61, ["geraldton hospital"]),
  aliasPoi("Broome Airport", "WA", -17.948, 122.235, ["broome airport"], ["broome international airport"]),
  poi("Karratha Health Campus", "WA", -20.737, 116.846, ["karratha health campus"]),
  aliasPoi("Port Hedland Airport", "WA", -20.377, 118.626, ["port hedland airport"], ["port hedland international airport"]),
  poi("Esperance Visitor Centre", "WA", -33.86, 121.891, ["esperance visitor centre"]),
  poi("Rottnest Island Visitor Centre", "WA", -31.996, 115.54, ["rottnest island"]),
  poi("Adelaide Oval", "SA", -34.915, 138.596, ["adelaide oval"]),
  poi("Adelaide Airport", "SA", -34.946, 138.53, ["adelaide airport"]),
  poi("Royal Adelaide Hospital", "SA", -34.921, 138.588, ["royal adelaide hospital"]),
  poi("University of Adelaide", "SA", -34.92, 138.604, ["university of adelaide"]),
  poi("Westfield Marion", "SA", -35.016, 138.544, ["westfield marion"]),
  poi("Tea Tree Plaza", "SA", -34.831, 138.691, ["tea tree plaza"]),
  poi("Elizabeth City Centre", "SA", -34.719, 138.668, ["elizabeth city centre"]),
  poi("Gawler Health Service", "SA", -34.599, 138.746, ["gawler health service"]),
  poi("Victor Harbor Visitor Centre", "SA", -35.556, 138.622, ["victor harbor visitor centre"]),
  poi("Murray Bridge Soldiers Memorial Hospital", "SA", -35.122, 139.27, ["murray bridge", "hospital"]),
  poi("Port Lincoln Airport", "SA", -34.606, 135.88, ["port lincoln airport"]),
  poi("Whyalla Hospital", "SA", -33.033, 137.584, ["whyalla hospital"]),
  poi("Mount Barker District Soldiers Memorial Hospital", "SA", -35.067, 138.858, ["mount barker", "hospital"]),
  aliasPoi("Barossa Visitor Centre", "SA", -34.527, 138.957, ["barossa visitor centre"], ["barossa visitor information centre"]),
  poi("Glenelg Beach", "SA", -34.981, 138.512, ["glenelg beach"]),
  poi("Adelaide Central Market", "SA", -34.929, 138.597, ["adelaide central market"]),
  aliasPoi("Hobart Airport", "TAS", -42.836, 147.51, ["hobart airport"], ["hobart international airport"]),
  poi("University of Tasmania Sandy Bay", "TAS", -42.902, 147.324, ["university of tasmania"]),
  poi("MONA Hobart", "TAS", -42.812, 147.262, ["mona"]),
  poi("Kingston Town Shopping Centre", "TAS", -42.976, 147.309, ["kingston town shopping centre"]),
  poi("Glenorchy Central", "TAS", -42.833, 147.276, ["glenorchy central"]),
  poi("Devonport Airport", "TAS", -41.169, 146.43, ["devonport airport"]),
  aliasPoi("Burnie Hospital", "TAS", -41.053, 145.904, ["burnie hospital"], ["north west regional hospital", "northwest regional hospital"]),
  poi("Mersey Community Hospital", "TAS", -41.225, 146.412, ["mersey community hospital"]),
  poi("St Helens District Hospital", "TAS", -41.32, 148.249, ["st helens", "hospital"]),
  poi("Queenstown Tasmania", "TAS", -42.08, 145.556, ["queenstown"]),
  poi("Port Arthur Historic Site", "TAS", -43.147, 147.851, ["port arthur historic site"]),
  poi("Freycinet National Park Visitor Centre", "TAS", -42.122, 148.285, ["freycinet", "visitor centre"]),
  poi("Canberra Airport", "ACT", -35.307, 149.195, ["canberra airport"]),
  poi("Canberra Centre", "ACT", -35.279, 149.133, ["canberra centre"]),
  poi("Belconnen Westfield", "ACT", -35.239, 149.063, ["westfield belconnen"]),
  aliasPoi("Gungahlin Marketplace", "ACT", -35.185, 149.136, ["gungahlin marketplace"], ["marketplace gungahlin", "the marketplace gungahlin"]),
  aliasPoi("Tuggeranong Hyperdome", "ACT", -35.414, 149.066, ["tuggeranong hyperdome"], ["south point tuggeranong", "south.point tuggeranong", "hyperdome"]),
  poi("National Gallery of Australia", "ACT", -35.3, 149.136, ["national gallery of australia"]),
  poi("National Museum of Australia", "ACT", -35.293, 149.121, ["national museum of australia"]),
  aliasPoi("Calvary Public Hospital Bruce", "ACT", -35.252, 149.089, ["calvary public hospital"], ["north canberra hospital"]),
  poi("University of Canberra", "ACT", -35.238, 149.084, ["university of canberra"]),
  poi("Questacon Canberra", "ACT", -35.298, 149.133, ["questacon"]),
  poi("Darwin Airport", "NT", -12.414, 130.877, ["darwin airport"]),
  poi("Charles Darwin University", "NT", -12.371, 130.869, ["charles darwin university"]),
  poi("Palmerston Regional Hospital", "NT", -12.483, 130.986, ["palmerston regional hospital"]),
  poi("Gateway Shopping Centre Palmerston", "NT", -12.477, 130.985, ["gateway shopping centre"]),
  poi("Mindil Beach Casino Resort", "NT", -12.448, 130.832, ["mindil beach casino"]),
  poi("Darwin Trailer Boat Club", "NT", -12.438, 130.833, ["darwin trailer boat club"]),
  poi("Litchfield National Park", "NT", -13.12, 130.79, ["litchfield national park"]),
  poi("Kakadu National Park Bowali Visitor Centre", "NT", -12.671, 132.833, ["bowali visitor centre"]),
  poi("Alice Springs Hospital", "NT", -23.702, 133.882, ["alice springs hospital"]),
  poi("Alice Springs Airport", "NT", -23.806, 133.902, ["alice springs airport"]),
  aliasPoi("Yulara Airport", "NT", -25.186, 130.976, ["yulara airport"], ["ayers rock airport"]),
  poi("Tennant Creek Hospital", "NT", -19.647, 134.191, ["tennant creek hospital"]),
  aliasPoi("Nhulunbuy Airport", "NT", -12.269, 136.818, ["nhulunbuy airport"], ["gove airport"]),
  poi("Palmerston Bus Interchange", "NT", -12.481, 130.986, ["palmerston bus interchange"]),
  poi("Ararat Hospital", "VIC", -37.284, 142.929, ["ararat hospital"]),
  poi("Sale Hospital", "VIC", -38.101, 147.07, ["sale hospital"]),
  poi("Echuca Regional Health", "VIC", -36.129, 144.751, ["echuca regional health"]),
  poi("Griffith Base Hospital", "NSW", -34.288, 146.05, ["griffith base hospital"]),
  aliasPoi("Queanbeyan Hospital", "NSW", -35.353, 149.235, ["queanbeyan hospital"], ["queanbeyan district hospital"]),
  poi("Goulburn Base Hospital", "NSW", -34.754, 149.717, ["goulburn base hospital"]),
];

const selectedCases = CASES.slice(0, Math.max(1, Math.min(CASE_LIMIT, CASES.length)));
const rows = [];
const counters = Object.fromEntries(PROVIDERS.map((provider) => [provider, createCounters()]));
const startedAt = new Date();

for (const provider of PROVIDERS) {
  if (!KEYS[provider]) {
    rows.push(...selectedCases.map((testCase, index) => skippedRow(provider, testCase, index + 1)));
    continue;
  }
  if (!ALLOW_BILLABLE) {
    rows.push(...selectedCases.map((testCase, index) => skippedRow(provider, testCase, index + 1, `${provider} key is configured but FUEL_PATH_POI_BAKEOFF_ALLOW_BILLABLE is not enabled`)));
    continue;
  }
  for (let index = 0; index < selectedCases.length; index += 1) {
    const testCase = selectedCases[index];
    if ((index + 1) === 1 || (index + 1) % 25 === 0 || (index + 1) === selectedCases.length) {
      console.error(`[${provider}] ${index + 1}/${selectedCases.length} ${testCase.query}`);
    }
    const result = await runProvider(provider, testCase, index + 1);
    rows.push(result);
    updateCounters(counters[provider], result);
    if (DELAY_MS) await sleep(DELAY_MS);
  }
}

const summary = summarise(rows, counters);
const payload = {
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  caseCount: selectedCases.length,
  providers: PROVIDERS,
  googleDetailsEnabled: GOOGLE_DETAILS_ENABLED,
  costModel: COST_MODEL,
  summary,
  rows,
};

await fsp.mkdir(path.join(ROOT, OUT_DIR), { recursive: true });
const jsonPath = path.join(OUT_DIR, `named-poi-provider-bakeoff-${RUN_ID}.json`);
const mdPath = path.join(OUT_DIR, `named-poi-provider-bakeoff-${RUN_ID}.md`);
await fsp.writeFile(path.join(ROOT, jsonPath), `${JSON.stringify(payload, null, 2)}\n`);
await fsp.writeFile(path.join(ROOT, mdPath), markdownReport(payload, jsonPath));
console.log(JSON.stringify({ runId: RUN_ID, jsonPath, mdPath, summary }, null, 2));

async function runProvider(provider, testCase, index) {
  const started = performance.now();
  try {
    const { suggestions, billableUnits } = await searchProvider(provider, testCase, index);
    const elapsedMs = performance.now() - started;
    const top = suggestions[0] || null;
    const matchDetails = suggestions.map((suggestion) => suggestionMatchDetails(testCase, suggestion));
    const expectedIndex = matchDetails.findIndex((details) => details.matched);
    const expectedMatch = expectedIndex >= 0 ? matchDetails[expectedIndex] : null;
    const topMatch = matchDetails[0] || { matched: false, matchKind: "miss", matchedTerm: "" };
    return {
      provider,
      index,
      query: testCase.query,
      state: testCase.state,
      status: "ok",
      elapsedMs: Number(elapsedMs.toFixed(1)),
      suggestionCount: suggestions.length,
      topLabel: top?.label || "",
      topProviderId: top?.providerPlaceId || "",
      topDistanceKm: top ? distanceKm(testCase.lat, testCase.lon, top.lat, top.lon) : null,
      topCorrect: expectedIndex === 0,
      expectedInTop5: expectedIndex >= 0,
      expectedRank: expectedIndex >= 0 ? expectedIndex + 1 : null,
      topMatchKind: topMatch.matchKind,
      expectedMatchKind: expectedMatch?.matchKind || "miss",
      acceptedOfficialAlias: expectedMatch?.matchKind === "official_alias",
      acceptedOfficialAliasTop: topMatch.matchKind === "official_alias",
      matchedTerm: expectedMatch?.matchedTerm || "",
      billableUnits,
      suggestions,
    };
  } catch (error) {
    const elapsedMs = performance.now() - started;
    return {
      provider,
      index,
      query: testCase.query,
      state: testCase.state,
      status: "error",
      elapsedMs: Number(elapsedMs.toFixed(1)),
      error: error?.message || String(error),
      suggestionCount: 0,
      topLabel: "",
      topDistanceKm: null,
      topCorrect: false,
      expectedInTop5: false,
      expectedRank: null,
      topMatchKind: "error",
      expectedMatchKind: "error",
      acceptedOfficialAlias: false,
      acceptedOfficialAliasTop: false,
      matchedTerm: "",
      billableUnits: {},
      suggestions: [],
    };
  }
}

async function searchProvider(provider, testCase, index) {
  if (provider === "google") return googleSearch(testCase, index);
  if (provider === "here") return hereSearch(testCase);
  if (provider === "tomtom") return tomtomSearch(testCase);
  throw new Error(`Unsupported provider ${provider}`);
}

async function googleSearch(testCase, index) {
  const payload = await fetchJson("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEYS.google,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types",
    },
    body: JSON.stringify({
      input: testCase.query,
      sessionToken: sessionToken(index),
      includedRegionCodes: ["au"],
      languageCode: "en-AU",
      locationBias: {
        circle: {
          center: { latitude: testCase.lat, longitude: testCase.lon },
          radius: 50000,
        },
      },
    }),
  });
  const predictions = (payload?.suggestions || [])
    .map((item) => item?.placePrediction)
    .filter(Boolean)
    .slice(0, LIMIT);
  const suggestions = [];
  const billableUnits = { autocomplete: 1, details: 0 };
  for (const prediction of predictions) {
    if (GOOGLE_DETAILS_ENABLED && prediction.placeId) {
      const details = await googleDetails(prediction.placeId);
      billableUnits.details += 1;
      suggestions.push({
        label: details.label || prediction.text?.text || testCase.query,
        name: details.name || prediction.text?.text || "",
        address: details.address || "",
        lat: details.lat,
        lon: details.lon,
        provider: "google",
        providerPlaceId: prediction.placeId,
        categories: prediction.types || [],
        rawRank: suggestions.length + 1,
      });
    } else {
      suggestions.push({
        label: prediction.text?.text || testCase.query,
        name: prediction.text?.text || "",
        address: "",
        lat: null,
        lon: null,
        provider: "google",
        providerPlaceId: prediction.placeId || "",
        categories: prediction.types || [],
        rawRank: suggestions.length + 1,
      });
    }
  }
  return { suggestions, billableUnits };
}

async function googleDetails(placeId) {
  const payload = await fetchJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": KEYS.google,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
    },
  });
  return {
    label: payload?.formattedAddress || payload?.displayName?.text || "",
    name: payload?.displayName?.text || "",
    address: payload?.formattedAddress || "",
    lat: payload?.location?.latitude ?? null,
    lon: payload?.location?.longitude ?? null,
  };
}

async function hereSearch(testCase) {
  const url = new URL("https://autosuggest.search.hereapi.com/v1/autosuggest");
  url.searchParams.set("q", testCase.query);
  url.searchParams.set("at", `${testCase.lat},${testCase.lon}`);
  url.searchParams.set("in", "countryCode:AUS");
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("lang", "en-AU");
  url.searchParams.set("apiKey", KEYS.here);
  const payload = await fetchJson(url.toString());
  const suggestions = (payload?.items || [])
    .filter((item) => item?.position?.lat !== undefined && item?.position?.lng !== undefined)
    .slice(0, LIMIT)
    .map((item, index) => ({
      label: item.title || item.address?.label || testCase.query,
      name: item.title || "",
      address: item.address?.label || "",
      lat: item.position.lat,
      lon: item.position.lng,
      provider: "here",
      providerPlaceId: item.id || "",
      categories: [item.resultType, item.categoryTitle].filter(Boolean),
      rawRank: index + 1,
    }));
  return { suggestions, billableUnits: { search: 1 } };
}

async function tomtomSearch(testCase) {
  const url = new URL(`https://api.tomtom.com/search/2/search/${encodeURIComponent(testCase.query)}.json`);
  url.searchParams.set("key", KEYS.tomtom);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("countrySet", "AU");
  url.searchParams.set("lat", String(testCase.lat));
  url.searchParams.set("lon", String(testCase.lon));
  url.searchParams.set("radius", "50000");
  url.searchParams.set("language", "en-AU");
  const payload = await fetchJson(url.toString());
  const suggestions = (payload?.results || [])
    .filter((item) => item?.position?.lat !== undefined && item?.position?.lon !== undefined)
    .slice(0, LIMIT)
    .map((item, index) => ({
      label: item.poi?.name || item.address?.freeformAddress || item.address?.municipality || testCase.query,
      name: item.poi?.name || "",
      address: item.address?.freeformAddress || "",
      lat: item.position.lat,
      lon: item.position.lon,
      provider: "tomtom",
      providerPlaceId: item.id || "",
      categories: [item.type, item.poi?.classification?.[0]?.code, item.poi?.categories?.join(",")].filter(Boolean),
      rawRank: index + 1,
    }));
  return { suggestions, billableUnits: { search: 1 } };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error?.message || payload?.message || text.slice(0, 160)}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function summarise(rows, counters) {
  const byProvider = {};
  for (const provider of PROVIDERS) {
    const providerRows = rows.filter((row) => row.provider === provider);
    const testedRows = providerRows.filter((row) => row.status !== "skipped");
    const latencies = testedRows.map((row) => row.elapsedMs).sort((a, b) => a - b);
    const billableUnits = aggregateBillableUnits(testedRows);
    byProvider[provider] = {
      configured: Boolean(KEYS[provider]),
      rows: providerRows.length,
      tested: testedRows.length,
      skipped: providerRows.filter((row) => row.status === "skipped").length,
      errors: testedRows.filter((row) => row.status === "error").length,
      topCorrect: testedRows.filter((row) => row.topCorrect).length,
      expectedInTop5: testedRows.filter((row) => row.expectedInTop5).length,
      acceptedOfficialAlias: testedRows.filter((row) => row.acceptedOfficialAlias).length,
      acceptedOfficialAliasTop: testedRows.filter((row) => row.acceptedOfficialAliasTop).length,
      topCorrectRate: rate(testedRows.filter((row) => row.topCorrect).length, testedRows.length),
      expectedInTop5Rate: rate(testedRows.filter((row) => row.expectedInTop5).length, testedRows.length),
      p50Ms: percentile(latencies, 50),
      p90Ms: percentile(latencies, 90),
      p95Ms: percentile(latencies, 95),
      billableUnits,
      estimatedCostUsd: estimateCost(provider, billableUnits),
      projectedCostUsd: projectCosts(provider),
      costModel: COST_MODEL[provider],
      counters: counters[provider],
    };
  }
  return { byProvider };
}

function aggregateBillableUnits(rows) {
  const result = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.billableUnits || {})) {
      result[key] = (result[key] || 0) + Number(value || 0);
    }
  }
  return result;
}

function estimateCost(provider, units) {
  if (!Object.keys(units || {}).length) return null;
  const per1000 = COST_MODEL[provider]?.per1000 || {};
  let total = 0;
  let complete = true;
  for (const [unit, count] of Object.entries(units)) {
    const price = per1000[unit];
    if (!Number.isFinite(price)) {
      complete = false;
      continue;
    }
    total += (count / 1000) * price;
  }
  return complete ? Number(total.toFixed(4)) : null;
}

function projectCosts(provider) {
  const per1000 = COST_MODEL[provider]?.per1000 || {};
  const primaryUnit = provider === "google" ? "autocomplete" : "search";
  const price = per1000[primaryUnit];
  const volumes = [1000, 10000, 100000, 1000000];
  return Object.fromEntries(volumes.map((volume) => [
    String(volume),
    Number.isFinite(price) ? Number(((volume / 1000) * price).toFixed(2)) : null,
  ]));
}

function markdownReport(payload, jsonPath) {
  const providerRows = Object.entries(payload.summary.byProvider)
    .map(([provider, item]) => `| ${provider} | ${item.configured ? "yes" : "no"} | ${item.tested} | ${item.topCorrectRate}% | ${item.expectedInTop5Rate}% | ${item.acceptedOfficialAlias} | ${item.acceptedOfficialAliasTop} | ${item.p90Ms ?? ""} | ${formatMoney(item.estimatedCostUsd)} | ${formatMoney(item.projectedCostUsd["100000"])} |`)
    .join("\n");
  const failures = payload.rows
    .filter((row) => row.status === "ok" && !row.expectedInTop5)
    .slice(0, 20)
    .map((row) => `| ${row.provider} | ${row.query} | ${row.topLabel || "(none)"} | ${row.suggestionCount} |`)
    .join("\n") || "| None |  |  |  |";
  return `# Named POI provider bake-off

Generated: ${payload.generatedAt}

## Scope

- Cases: ${payload.caseCount}
- Providers: ${payload.providers.join(", ")}
- Google Place Details enabled: ${payload.googleDetailsEnabled ? "yes" : "no"}
- JSON evidence: ${jsonPath}

## Provider summary

| Provider | Key configured | Tested | Top correct | Expected in top 5 | Accepted aliases | Top aliases | p90 ms | Run cost estimate | 100k query projection |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${providerRows}

## First missed expected results

| Provider | Query | Top result | Suggestions |
| --- | --- | --- | ---: |
${failures}

## Cost note

Cost estimates are only populated when per-1,000 request prices are supplied through environment variables. Use the provider console or contract to set:

- \`FUEL_PATH_GOOGLE_PLACES_AUTOCOMPLETE_PER_1000_USD\`
- \`FUEL_PATH_GOOGLE_PLACE_DETAILS_PER_1000_USD\`
- \`FUEL_PATH_HERE_SEARCH_PER_1000_USD\`
- \`FUEL_PATH_TOMTOM_SEARCH_PER_1000_USD\`
`;
}

function poi(query, state, lat, lon, expectedTerms) {
  return { query, state, lat, lon, expectedTerms, officialAliasTerms: [] };
}

function aliasPoi(query, state, lat, lon, expectedTerms, officialAliasTerms) {
  return { query, state, lat, lon, expectedTerms, officialAliasTerms };
}

function suggestionMatches(testCase, suggestion) {
  return suggestionMatchDetails(testCase, suggestion).matched;
}

function suggestionMatchDetails(testCase, suggestion) {
  if (!suggestion) return { matched: false, matchKind: "miss", matchedTerm: "" };
  const label = normalise([suggestion.label, suggestion.name, suggestion.address].filter(Boolean).join(" "));
  const primaryTerm = testCase.expectedTerms.find((term) => label.includes(normalise(term)));
  if (primaryTerm) {
    return { matched: true, matchKind: "expected_term", matchedTerm: primaryTerm };
  }
  const aliasTerm = (testCase.officialAliasTerms || []).find((term) => label.includes(normalise(term)));
  if (aliasTerm) {
    return { matched: true, matchKind: "official_alias", matchedTerm: aliasTerm };
  }
  return { matched: false, matchKind: "miss", matchedTerm: "" };
}

function distanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(Number(value)))) return null;
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Number((radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

function skippedRow(provider, testCase, index, reason = `${provider} API key not configured`) {
  return {
    provider,
    index,
    query: testCase.query,
    state: testCase.state,
    status: "skipped",
    reason,
    elapsedMs: null,
    suggestionCount: 0,
    topLabel: "",
    topProviderId: "",
    topDistanceKm: null,
    topCorrect: false,
    expectedInTop5: false,
    expectedRank: null,
    topMatchKind: "skipped",
    expectedMatchKind: "skipped",
    acceptedOfficialAlias: false,
    acceptedOfficialAliasTop: false,
    matchedTerm: "",
    billableUnits: {},
    suggestions: [],
  };
}

function createCounters() {
  return {};
}

function updateCounters(counter, row) {
  counter[row.status] = (counter[row.status] || 0) + 1;
}

function env(name) {
  return process.env[name] || "";
}

function loadLocalEnv(file = ".env.local") {
  const envPath = path.join(ROOT, file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
  }
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

function parseProviders(value) {
  const supported = new Set(["google", "here", "tomtom"]);
  const providers = String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => supported.has(item));
  return providers.length ? [...new Set(providers)] : ["google", "here", "tomtom"];
}

function sessionToken(index) {
  const compactRunId = RUN_ID.replace(/[^a-zA-Z0-9]/g, "").slice(-20);
  return `poi${compactRunId}${String(index).padStart(3, "0")}`.slice(0, 36);
}

function normalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function toRad(value) {
  return (Number(value) * Math.PI) / 180;
}

function rate(count, total) {
  return total ? Number(((count / total) * 100).toFixed(1)) : null;
}

function percentile(values, pct) {
  if (!values.length) return null;
  return Number(values[Math.min(values.length - 1, Math.ceil((pct / 100) * values.length) - 1)].toFixed(1));
}

function formatMoney(value) {
  return value === null || value === undefined ? "set price env" : `$${Number(value).toFixed(4)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
