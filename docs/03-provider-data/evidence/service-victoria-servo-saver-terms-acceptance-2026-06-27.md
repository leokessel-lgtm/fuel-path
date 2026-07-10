# Service Victoria Servo Saver Terms, Attribution, Cache And Use Evidence

Recorded: 2026-06-27
Provider family: Service Victoria Servo Saver
Evidence reference: service-victoria-servo-saver-terms-commercial-attribution-cache-note-2026-06-27

## Evidence Held

- Fuel Path received access to the Service Victoria Servo Saver Open API by email on 2026-06-25.
- Leo confirmed on 2026-06-27 that the Service Victoria Servo Saver Terms and Acceptable Use policy has been agreed.
- The API key is intentionally not recorded in this note.
- The Service Victoria public Terms and Acceptable Use policy page was reviewed on 2026-06-27.
- The Terms state API consumers agree to the Additional API Consumer Terms when consuming, using, accessing or integrating with Service Victoria Platform APIs.
- The Terms state APIs made available through the Service Victoria Platform are licensed under the Creative Commons Attribution 4.0 International licence and any additional API licence terms notified before API use.
- The Terms prohibit removing copyright, trade mark or attribution notices from APIs or related materials/data.
- The Terms allow Service Victoria to set and enforce API-use limits, and Fuel Path must not circumvent those limits.
- The Terms prohibit misleading or deceptive material and prohibit implying Victorian Government endorsement of Fuel Path.
- The Terms prohibit disruptive commercial messages or advertisements, but the reviewed public Terms do not prohibit a consumer fuel-price app that complies with the licence, attribution, rate-limit, non-endorsement and acceptable-use obligations.

## Fuel Path Operational Decisions

- Price cache duration: 5 minutes maximum for Servo Saver live price data.
- Cache basis: conservative Fuel Path operational policy because the reviewed public Terms allow Service Victoria to set API limits but did not expose a stricter cache-duration number in the reviewed page.
- API-call policy: server-side only, no end-user device calls using the API key, no circumvention of Service Victoria limits.
- Attribution/disclaimer wording approved for display: "Fuel price data from Service Victoria Servo Saver, licensed under CC BY 4.0. Service Victoria does not endorse Fuel Path. Prices may change; confirm before driving."
- Commercial consumer-app use: confirmed for Fuel Path subject to the public Terms and Acceptable Use policy, including no misleading claims, no endorsement implication, no disruptive commercial messaging and no individual tracking/profiling from the API data.

## Remaining Caveats

- If Service Victoria later notifies Fuel Path of API-specific licence terms, rate limits, cache limits or attribution wording, those terms override this note.
- Public release should retain a visible source/disclaimer path anywhere Servo Saver prices are displayed.
- This note is not Service Victoria endorsement of Fuel Path.

## Release Decision

This note supports `servoSaverApiAccessApproved`, `servoSaverTermsAccepted`, `cachingDurationConfirmed`, `attributionDisclaimerReady`, `commercialConsumerAppUseConfirmed` and `termsAcceptedAt` evidence for VIC.
