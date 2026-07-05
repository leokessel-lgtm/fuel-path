const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const source = readFileSync(join(process.cwd(), "api/_geocode.js"), "utf8");

test("geocode fallback policy keeps Plan autocomplete local-first, provider-second, local-fallback-last", () => {
  assert.match(source, /function mergeSuggestionsByFallbackPolicy/);
  assert.match(source, /if \(selectedProvider === "nominatim"\)[\s\S]*\.\.\.localSuggestions,[\s\S]*\.\.\.providerSuggestions/);
  assert.match(source, /if \(planAutocompleteCascade\)[\s\S]*\.\.\.planAutocompleteLocalFirstSuggestions,[\s\S]*\.\.\.providerSuggestions,[\s\S]*\.\.\.planAutocompleteLocalFallbackSuggestions/);
  assert.match(source, /requiresExactAddress \? exactLocalAddressMatches : localSuggestions/);
  assert.match(source, /requiresExactAddress \? nonExactLocalSuggestions : \[\]/);
  assert.match(source, /requiresExactAddress \? strictAddressSuggestions : addressSuggestions/);
});
