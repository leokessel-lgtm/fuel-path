const REGIONAL_TOWNS = [
  // NSW.
  town("Newcastle", "NSW", -32.9283, 151.7817, "2300"),
  town("Wollongong", "NSW", -34.4278, 150.8931, "2500"),
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
  town("Lord Howe Island", "NSW", -31.555, 159.085, "2898"),
  town("Lightning Ridge", "NSW", -29.429, 147.978, "2834"),
  town("Tibooburra", "NSW", -29.43, 142.01, "2880"),
  town("Tilpa", "NSW", -30.935, 144.417, "2840"),
  town("White Cliffs", "NSW", -30.851, 143.087, "2836"),
  town("Wilcannia", "NSW", -31.56, 143.378, "2836"),
  town("Menindee", "NSW", -32.393, 142.417, "2879"),
  town("Bourke", "NSW", -30.091, 145.938, "2840"),
  town("Walgett", "NSW", -30.024, 148.115, "2832"),
  town("Coonabarabran", "NSW", -31.273, 149.279, "2357"),

  // ACT.
  town("Cotter", "ACT", -35.321, 148.947, "2611"),
  town("Pierces Creek", "ACT", -35.337, 148.94, "2611"),
  town("Oaks Estate", "ACT", -35.342, 149.23, "2620"),
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
  town("Gold Coast", "QLD", -28.0167, 153.4, "4217"),
  town("Sunshine Coast", "QLD", -26.65, 153.0667, "4558"),
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
  town("Thursday Island", "QLD", -10.584, 142.219, "4875"),
  town("Magnetic Island", "QLD", -19.155, 146.849, "4819"),
  town("Birdsville", "QLD", -25.899, 139.352, "4482"),
  town("Winton", "QLD", -22.39, 143.038, "4735"),
  town("Weipa", "QLD", -12.63, 141.879, "4874"),
  town("Camooweal", "QLD", -19.922, 138.121, "4828"),
  town("Palm Island", "QLD", -18.735, 146.58, "4816"),
  town("Normanton", "QLD", -17.671, 141.077, "4890"),

  // VIC.
  town("Geelong", "VIC", -38.1499, 144.3617, "3220"),
  town("Ballarat", "VIC", -37.5622, 143.8503, "3350"),
  town("Bendigo", "VIC", -36.757, 144.2794, "3550"),
  town("Shepparton", "VIC", -36.3805, 145.3987, "3630"),
  town("Warrnambool", "VIC", -38.3833, 142.4833, "3280"),
  town("Mildura", "VIC", -34.208, 142.1246, "3500"),
  town("Wodonga", "VIC", -36.1218, 146.8881, "3690"),
  town("Traralgon", "VIC", -38.1953, 146.5415, "3844"),
  town("Bairnsdale", "VIC", -37.825, 147.63, "3875"),
  town("Sale", "VIC", -38.106, 147.067, "3850"),
  town("Horsham", "VIC", -36.7167, 142.2, "3400"),
  town("Swan Hill", "VIC", -35.3378, 143.5544, "3585"),
  town("Wilsons Promontory", "VIC", -39.03, 146.318, "3960", ["wilsons prom"]),

  // WA.
  town("Fremantle", "WA", -32.056, 115.744, "6160"),
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
  town("Rottnest Island", "WA", -32.006, 115.512, "6161"),
  town("Houtman Abrolhos", "WA", -28.719, 113.784, "6530"),
  town("Meekatharra", "WA", -26.595, 118.493, "6642"),
  town("Newman", "WA", -23.357, 119.735, "6753"),
  town("Fitzroy Crossing", "WA", -18.195, 125.568, "6765"),
  town("Eucla", "WA", -31.677, 128.885, "6443"),

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
  town("Kangaroo Island", "SA", -35.775, 137.214, "5223"),
  town("Kingscote", "SA", -35.655, 137.639, "5223"),
  town("Penneshaw", "SA", -35.718, 137.94, "5222"),
  town("Oodnadatta", "SA", -27.546, 135.445, "5734"),
  town("Marla", "SA", -27.305, 133.62, "5724"),
  town("Nullarbor Roadhouse", "SA", -31.449, 130.897, "5690", ["nullarbor"]),
  town("Innamincka", "SA", -27.746, 140.738, "5731"),
  town("Roxby Downs", "SA", -30.562, 136.895, "5725"),

  // TAS.
  town("Launceston", "TAS", -41.4332, 147.1441, "7250"),
  town("Devonport", "TAS", -41.178, 146.351, "7310"),
  town("Burnie", "TAS", -41.052, 145.906, "7320"),
  town("Kingston", "TAS", -42.976, 147.309, "7050"),
  town("Ulverstone", "TAS", -41.16, 146.17, "7315"),
  town("Queenstown", "TAS", -42.0805, 145.5565, "7467"),
  town("Sorell", "TAS", -42.782, 147.562, "7172"),
  town("New Norfolk", "TAS", -42.7826, 147.0595, "7140"),
  town("St Helens", "TAS", -41.32, 148.25, "7216"),
  town("Smithton", "TAS", -40.842, 145.124, "7330"),
  town("Bruny Island", "TAS", -43.365, 147.246, "7150"),
  town("Cradle Mountain", "TAS", -41.684, 145.951, "7306"),

  // NT.
  town("Alice Springs", "NT", -23.698, 133.8807, "0870"),
  town("Katherine", "NT", -14.465, 132.2635, "0850"),
  town("Palmerston", "NT", -12.486, 130.983, "0830"),
  town("Tennant Creek", "NT", -19.648, 134.191, "0860"),
  town("Nhulunbuy", "NT", -12.182, 136.782, "0880"),
  town("Jabiru", "NT", -12.671, 132.833, "0886"),
  town("Yulara", "NT", -25.243, 130.989, "0872"),
  town("Humpty Doo", "NT", -12.579, 131.101, "0836"),
  town("Howard Springs", "NT", -12.493, 131.044, "0835"),
  town("Uluru", "NT", -25.345, 131.036, "0872"),
  town("Kakadu Visitor Centre", "NT", -12.671, 132.833, "0886", ["kakadu"]),
  town("Litchfield National Park", "NT", -13.18, 130.789, "0845", ["litchfield"]),
  town("Batchelor", "NT", -13.049, 131.029, "0845"),
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
  poi("Newcastle Airport Williamtown", "NSW", "Newcastle", -32.795, 151.834),
  poi("Wollongong Hospital", "NSW", "Wollongong"),
  poi("Charles Sturt University Wagga Wagga", "NSW", "Wagga Wagga"),
  poi("Stockland Green Hills Maitland", "NSW", "Newcastle", -32.762, 151.591),
  poi("Narrabri District Hospital", "NSW", "Narrabri"),

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
  poi("Cotter Reserve ACT", "ACT", "Cotter"),
  poi("Tuggeranong Hyperdome", "ACT", "Greenway"),
  poi("EPIC Canberra", "ACT", "Lyneham"),
  poi("Australian Institute of Sport", "ACT", "Belconnen"),
  poi("Canberra Hospital", "ACT", "Mawson", -35.345, 149.101),
  poi("Westfield Belconnen", "ACT", "Belconnen"),
  poi("Marketplace Gungahlin", "ACT", "Gungahlin"),
  poi("Canberra Airport", "ACT", "Pialligo"),

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
  poi("Sunshine Coast University Hospital", "QLD", "Sunshine Coast"),
  poi("Gold Coast University Hospital", "QLD", "Gold Coast"),
  poi("Townsville Airport", "QLD", "Townsville"),
  poi("Cairns Airport", "QLD", "Cairns"),
  poi("Stockland Rockhampton", "QLD", "Rockhampton"),

  // VIC.
  poi("Melbourne Cricket Ground", "VIC", "Melbourne", -37.8199, 144.9834),
  poi("Flinders Street Station", "VIC", "Melbourne", -37.8183, 144.9671),
  poi("Geelong Waterfront", "VIC", "Geelong"),
  poi("Sovereign Hill Ballarat", "VIC", "Ballarat"),
  poi("Bendigo Art Gallery", "VIC", "Bendigo"),
  poi("Shepparton Art Museum", "VIC", "Shepparton"),
  poi("Flagstaff Hill Maritime Village", "VIC", "Warrnambool"),
  poi("Mildura Base Public Hospital", "VIC", "Mildura"),
  poi("The Cube Wodonga", "VIC", "Wodonga"),
  poi("Latrobe Regional Hospital", "VIC", "Traralgon"),
  poi("Bairnsdale Regional Health Service", "VIC", "Bairnsdale"),
  poi("Sale Botanic Gardens", "VIC", "Sale"),
  poi("Horsham Town Hall", "VIC", "Horsham"),
  poi("Swan Hill Pioneer Settlement", "VIC", "Swan Hill"),
  poi("Wilsons Promontory Visitor Centre", "VIC", "Wilsons Promontory"),
  poi("Avalon Airport Geelong", "VIC", "Geelong", -38.039, 144.469),
  poi("Bendigo Health", "VIC", "Bendigo"),
  poi("Federation University Mount Helen", "VIC", "Ballarat", -37.627, 143.891),
  poi("Westfield Geelong", "VIC", "Geelong"),

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
  poi("Busselton Margaret River Airport", "WA", "Margaret River", -33.688, 115.402),
  poi("Mandurah Forum", "WA", "Mandurah"),
  poi("Fiona Stanley Hospital", "WA", "Fremantle", -32.07, 115.844),
  poi("Northam Hospital", "WA", "Northam"),

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
  poi("Mount Gambier Airport", "SA", "Mount Gambier"),
  poi("University of South Australia Whyalla Campus", "SA", "Whyalla"),
  poi("Murray Bridge Marketplace", "SA", "Murray Bridge"),
  poi("Port Lincoln Hospital", "SA", "Port Lincoln"),

  // TAS.
  poi("Cataract Gorge Reserve", "TAS", "Launceston"),
  poi("Devonport Airport", "TAS", "Devonport"),
  poi("Makers Workshop Burnie", "TAS", "Burnie"),
  poi("Kingston Beach", "TAS", "Kingston"),
  poi("Leven Canyon Lookout", "TAS", "Ulverstone"),
  poi("West Coast Wilderness Railway Queenstown", "TAS", "Queenstown"),
  poi("Sorell Plaza", "TAS", "Sorell"),
  poi("Willow Court New Norfolk", "TAS", "New Norfolk"),
  poi("St Helens Visitor Information Centre", "TAS", "St Helens"),
  poi("Smithton District Hospital", "TAS", "Smithton"),
  poi("Bruny Island Ferry Terminal", "TAS", "Bruny Island"),
  poi("Cradle Mountain Visitor Centre", "TAS", "Cradle Mountain"),
  poi("Launceston General Hospital", "TAS", "Launceston"),
  poi("Burnie Airport Wynyard", "TAS", "Burnie", -40.998, 145.731),
  poi("Devonport Regional Gallery", "TAS", "Devonport"),
  poi("Kingston Town Shopping Centre", "TAS", "Kingston"),

  // NT.
  poi("Alice Springs Hospital", "NT", "Alice Springs"),
  poi("Katherine Hot Springs", "NT", "Katherine"),
  poi("Palmerston Regional Hospital", "NT", "Palmerston"),
  poi("Tennant Creek Hospital", "NT", "Tennant Creek"),
  poi("Gove Airport Nhulunbuy", "NT", "Nhulunbuy"),
  poi("Bowali Visitor Centre Jabiru", "NT", "Jabiru"),
  poi("Ayers Rock Airport Yulara", "NT", "Yulara"),
  poi("Humpty Doo Hotel", "NT", "Humpty Doo"),
  poi("Howard Springs Nature Park", "NT", "Howard Springs"),
  poi("Uluru-Kata Tjuta National Park", "NT", "Uluru"),
  poi("Kakadu Visitor Centre", "NT", "Kakadu Visitor Centre"),
  poi("Litchfield National Park", "NT", "Litchfield National Park"),
  poi("Alice Springs Airport", "NT", "Alice Springs"),
  poi("Katherine Hospital", "NT", "Katherine"),
  poi("Yeperenye Shopping Centre", "NT", "Alice Springs"),
  poi("Batchelor Butterfly Farm", "NT", "Batchelor"),
];

const STATE_CODES = ["NSW", "ACT", "QLD", "WA", "VIC", "SA", "TAS", "NT"];
const STATE_CODE_PATTERN = STATE_CODES.join("|");

function regionalLocalGeocode(query, limit = 5) {
  const needles = regionalSearchNeedles(query);
  const needle = needles[0] || "";
  if (needle.length < 3) return [];
  const state = detectStateCode(query);
  const rows = [];

  const street = streetFallback(query, state);
  if (street) rows.push(street);

  for (const place of [...REGIONAL_POIS, ...REGIONAL_TOWNS]) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
    if (state && place.state !== state) continue;
    const match = matchPlace(needles, place);
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
  const pattern = new RegExp(
    `\\b(?:\\d+[a-z]?\\s+)?([a-z][a-z\\s'.-]+?\\b(?:street|st|road|rd|avenue|ave|drive|dr|parade|pde|place|pl|terrace|tce|highway|hwy|mall|court|ct|close|vista|circuit|cct|way|lane|ln|crescent|cres|boulevard|bvd|blvd|parkway|pkwy|pwy|esplanade|esp|square|sq))\\b\\s+(.+?)(?:\\s+\\b(${STATE_CODE_PATTERN})\\b|\\s*$)`,
    "i",
  );
  const match = pattern.exec(text);
  if (!match) return null;
  const streetName = titleCase(expandStreetType(match[1]));
  const localityText = match[2];
  const resolvedState = state || (match[3] ? match[3].toUpperCase() : "");
  const town = findTownForStreetFallback(localityText, resolvedState);
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

function findTownForStreetFallback(value, state) {
  const needle = normalise(value);
  if (needle.length < 3) return null;
  const candidates = state ? REGIONAL_TOWNS.filter((townRecord) => townRecord.state === state) : REGIONAL_TOWNS;
  const exact = candidates.find((townRecord) =>
    townRecord.searchTexts.some((text) => text === needle || needle.includes(text)),
  );
  if (exact) return exact;
  const prefixMatches = candidates.filter((townRecord) =>
    townRecord.searchTexts.some((text) => text.startsWith(needle)),
  );
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function matchPlace(needles, place) {
  let best = null;
  for (const needle of needles) {
    for (const text of place.searchTexts) {
      let match = null;
      if (needle === text) match = { score: 0, confidence: "medium", matchType: "regional_exact" };
      else if (text.startsWith(needle)) match = { score: 8, confidence: "medium", matchType: "regional_prefix" };
      else if (text.includes(needle)) match = { score: 12, confidence: "medium", matchType: "regional_contains" };
      else if (needle.includes(text) && text.length >= 5) {
        match = {
          score: place.kind === "regional_poi" ? 16 : 18,
          confidence: "low",
          matchType: "regional_area_fallback",
        };
      }
      if (match && (!best || match.score < best.score)) best = match;
    }
  }
  return best;
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
  return STATE_CODES.find((code) => new RegExp(`\\b${code}\\b`).test(text)) || "";
}

function regionalSearchNeedles(query) {
  const needle = normalise(query);
  const withoutCountry = stripTerminalCountry(needle);
  const withoutState = stripTerminalStateCode(withoutCountry);
  const withoutGenericSuffix = stripGenericQuerySuffix(withoutState);
  return [...new Set([needle, withoutCountry, withoutState, withoutGenericSuffix].filter((value) => value.length >= 3))];
}

function stripTerminalStateCode(value) {
  return String(value || "").replace(/\b(nsw|act|qld|wa|vic|sa|tas|nt)\b$/i, "").trim();
}

function stripTerminalCountry(value) {
  return String(value || "").replace(/\baustralia\b$/i, "").trim();
}

function stripGenericQuerySuffix(value) {
  return String(value || "")
    .replace(/\btown centre\b$/i, "")
    .replace(/\bcity centre\b$/i, "")
    .trim();
}

function expandStreetType(value) {
  return String(value || "")
    .replace(/\bbvd\b/gi, "Boulevard")
    .replace(/\bblvd\b/gi, "Boulevard")
    .replace(/\bcct\b/gi, "Circuit")
    .replace(/\bcr\b/gi, "Crescent")
    .replace(/\bcres\b/gi, "Crescent")
    .replace(/\bct\b/gi, "Court")
    .replace(/\bst\b/gi, "Street")
    .replace(/\brd\b/gi, "Road")
    .replace(/\bave\b/gi, "Avenue")
    .replace(/\bdr\b/gi, "Drive")
    .replace(/\besp\b/gi, "Esplanade")
    .replace(/\bhwy\b/gi, "Highway")
    .replace(/\bpkwy\b/gi, "Parkway")
    .replace(/\bpwy\b/gi, "Parkway")
    .replace(/\bpde\b/gi, "Parade")
    .replace(/\bpl\b/gi, "Place")
    .replace(/\bln\b/gi, "Lane")
    .replace(/\bsq\b/gi, "Square")
    .replace(/\btce\b/gi, "Terrace");
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
