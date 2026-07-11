# Route Output Benchmark For Driver Testing

Date: 2026-07-09

Production surface: https://fuel-path.vercel.app

Raw evidence: `docs/evidence/route-output-benchmark-user-testing-2026-07-09T03-26-23-889Z.json`

## TLDR

Fuel Path returned 15/16 route recommendations across the national driver-test route set using U91 and PDL. 1 case returned no recommendation and should be treated as explicit coverage/product caveats in driver testing.

Use this as the recruited-driver evidence pack: ask drivers whether the top stop, detour, best-price-by value and provider caveat are enough to trust or reject the recommendation.

## Method

- Route set: Sydney-Newcastle, Canberra-Sydney, Melbourne-Ballarat, Brisbane-Longreach, Perth-Broome, Adelaide-Coober Pedy, Hobart-Strahan, Darwin-Alice Springs.
- Fuels: U91, PDL.
- API: production `/api/score`, live source, no selected discounts.
- Output captured: top recommendation, displayed fuel price, detour, best-price-by c/L, provider/source caveat.

## Route Outputs

| Region | Route | Fuel | Top recommendation | Price | Detour | Best price by | Provider caveat |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| NSW | Sydney CBD NSW to Newcastle NSW | U91 | Enhance Waratah, Waratah | 155.5 c/L U91 | 1.7 min | 0.0 c/L | NSW FuelCheck; refreshed now; exact U91 price |
| NSW | Sydney CBD NSW to Newcastle NSW | PDL | Metro Islington, Islington | 177.5 c/L PDL | 2.3 min | 0.0 c/L | NSW FuelCheck; fresh now; exact PDL price |
| ACT/NSW | Canberra ACT to Sydney CBD NSW | U91 | Metro Petroleum Earlwood, Earlwood | 152.9 c/L U91 | 7.0 min | 0.0 c/L | NSW FuelCheck; fresh now; exact U91 price |
| ACT/NSW | Canberra ACT to Sydney CBD NSW | PDL | ARKO Earlwood, Earlwood | 174.5 c/L PDL | 7.5 min | 0.0 c/L | NSW FuelCheck; fresh now; exact PDL price |
| VIC | Melbourne CBD VIC to Ballarat VIC | U91 | Burk Kingsville, Kingsville | 153.3 c/L U91 | 1.4 min | 0.0 c/L | VIC Servo Saver; refreshed now; exact U91 price |
| VIC | Melbourne CBD VIC to Ballarat VIC | PDL | Pearl Energy Bakery Hill, Bakery Hill | 175.3 c/L PDL | 0.3 min | 0.0 c/L | VIC Servo Saver; fresh now; exact PDL price |
| QLD | Brisbane CBD QLD to Longreach QLD | U91 | Oakey Pie Face, Oakey | 157.7 c/L U91 | 0.8 min | 0.0 c/L | Queensland Fuel Prices; refreshed now; exact U91 price |
| QLD | Brisbane CBD QLD to Longreach QLD | PDL | Costco Ipswich Fuel Station, Bundamba | 172.7 c/L PDL | 3.1 min | 0.8 c/L | Queensland Fuel Prices; fresh now; exact PDL price |
| WA | Perth CBD WA to Broome WA | U91 | Burk Mount Lawley, Mount Lawley | 153.3 c/L U91 | 0.0 min | 0.0 c/L | WA FuelWatch; provider degraded; refreshed now; exact U91 price; WA tomorrow locked prices are checked after 2:30pm AWST. |
| WA | Perth CBD WA to Broome WA | PDL | Vibe Bayswater, Bayswater | 180.9 c/L PDL | 1.5 min | 0.0 c/L | WA FuelWatch; provider degraded; refreshed now; exact PDL price; WA tomorrow locked prices are checked after 2:30pm AWST. |
| SA | Adelaide CBD SA to Coober Pedy SA | U91 | U-Go West Hindmarsh, West Hindmarsh | 158.5 c/L U91 | 1.8 min | 0.0 c/L | SA Fuel Pricing; refreshed now; exact U91 price |
| SA | Adelaide CBD SA to Coober Pedy SA | PDL | AMPM Mile End, Mile End | 179.9 c/L PDL | 1.0 min | 0.0 c/L | SA Fuel Pricing; fresh now; exact PDL price |
| TAS | Hobart TAS to Strahan TAS | U91 | Ampol Brooker, North Hobart | 159.9 c/L U91 | 0.0 min | 0.0 c/L | TAS FuelCheck; refreshed now; exact U91 price |
| TAS | Hobart TAS to Strahan TAS | PDL | Tas Petroleum Moonah (unmanned), Moonah | 199.9 c/L PDL | 3.1 min | 0.0 c/L | TAS FuelCheck; refreshed now; exact PDL price |
| NT | Darwin NT to Alice Springs NT | U91 | NT-08200230, Stuart Park | 169.5 c/L U91 | 0.1 min | 0.0 c/L | MyFuel NT; refreshed now; exact U91 price |
| NT | Darwin NT to Alice Springs NT | PDL | No recommendation | - | - | - | MyFuel NT; fresh now |

## Driver Testing Prompts

- Would you trust this stop enough to navigate there? Why or why not?
- Is the detour small enough for the saving shown?
- Is `Best price by` clear, or does it need a comparison explanation?
- Does the provider caveat increase trust or create hesitation?
- For no-recommendation or alternative-fuel cases, is the explanation clear enough to avoid a bad trip decision?

## Product Read

- Keep the recommendation card focused on station, price, detour and best-price-by.
- Keep provider/source caveats visible in evidence, especially WA timing, stale cache, unsupported provider and NT exact-fuel gaps.
- Treat no-recommendation cases as research material, not failures to hide. They tell us where users need fallback guidance.
