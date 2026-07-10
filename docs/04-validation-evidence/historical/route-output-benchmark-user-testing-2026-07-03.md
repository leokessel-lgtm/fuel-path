# Route Output Benchmark For Driver Testing

Date: 2026-07-03

Production surface: https://fuel-path.vercel.app

Raw evidence: `docs/evidence/route-output-benchmark-user-testing-2026-07-03T06-33-31-440Z.json`

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
| NSW | Sydney CBD NSW to Newcastle NSW | U91 | North Ryde Petroleum, North Ryde | 153.7 c/L U91 | 3.1 min | 1.2 c/L | NSW FuelCheck; fresh 5m ago; exact U91 price |
| NSW | Sydney CBD NSW to Newcastle NSW | PDL | Metro Petroleum West Wallsend, West Wallsend | 177.9 c/L PDL | 4.1 min | 0.0 c/L | NSW FuelCheck; fresh 5m ago; exact PDL price |
| ACT/NSW | Canberra ACT to Sydney CBD NSW | U91 | Metro Bexley, Bexley | 147.9 c/L U91 | 8.3 min | 0.9 c/L | NSW FuelCheck; fresh 5m ago; exact U91 price |
| ACT/NSW | Canberra ACT to Sydney CBD NSW | PDL | Budget Bexley South, Bexley | 169.8 c/L PDL | 6.7 min | 0.1 c/L | NSW FuelCheck; fresh 5m ago; exact PDL price |
| VIC | Melbourne CBD VIC to Ballarat VIC | U91 | Metro Petroleum Golden Point, GOLDEN POINT | 149.3 c/L U91 | 2.1 min | 0.2 c/L | VIC Servo Saver; fresh 5m ago; exact U91 price |
| VIC | Melbourne CBD VIC to Ballarat VIC | PDL | Metro Petroleum Golden Point, GOLDEN POINT | 163.3 c/L PDL | 2.1 min | 3.6 c/L | VIC Servo Saver; fresh 5m ago; exact PDL price |
| QLD | Brisbane CBD QLD to Longreach QLD | U91 | United Woolloongabba, Woolloongabba | 153.9 c/L U91 | 3.1 min | 1.6 c/L | Queensland Fuel Prices; fresh 4m ago; exact U91 price |
| QLD | Brisbane CBD QLD to Longreach QLD | PDL | Costco Ipswich Fuel Station, Bundamba | 172.7 c/L PDL | 3.1 min | 1.8 c/L | Queensland Fuel Prices; fresh 4m ago; exact PDL price |
| WA | Perth CBD WA to Broome WA | U91 | Metro Bassendean, Bassendean | 149.2 c/L U91 | 3.1 min | 8.1 c/L | WA FuelWatch; refreshed now; exact U91 price |
| WA | Perth CBD WA to Broome WA | PDL | Solo Morley, Morley | 171.5 c/L PDL | 4.6 min | 3.8 c/L | WA FuelWatch; refreshed now; exact PDL price |
| SA | Adelaide CBD SA to Coober Pedy SA | U91 | Costco Kilburn, Kilburn | 150.7 c/L U91 | 4.7 min | 6.8 c/L | SA Fuel Pricing; fresh 4m ago; exact U91 price |
| SA | Adelaide CBD SA to Coober Pedy SA | PDL | Costco Kilburn, Kilburn | 171.7 c/L PDL | 4.7 min | 8.8 c/L | SA Fuel Pricing; fresh 5m ago; exact PDL price |
| TAS | Hobart TAS to Strahan TAS | U91 | Ampol Brooker, North Hobart | 162.9 c/L U91 | 0.0 min | 0.0 c/L | TAS FuelCheck; refreshed now; exact U91 price |
| TAS | Hobart TAS to Strahan TAS | PDL | Tas Petroleum Moonah (unmanned), Moonah | 199.9 c/L PDL | 3.1 min | 3.0 c/L | TAS FuelCheck; refreshed now; exact PDL price |
| NT | Darwin NT to Alice Springs NT | U91 | NT-08200045, Winnellie | 164.5 c/L U91 | 2.5 min | 0.4 c/L | MyFuel NT; refreshed now; exact U91 price |
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
