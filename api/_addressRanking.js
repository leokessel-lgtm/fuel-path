function createAddressRanking({ normaliseAddressText }) {
  function scoreRecord(record, needle) {
    const texts = [record.searchText, normaliseAddressText(record.label), ...(record.aliases || [])]
      .filter(Boolean).map(normaliseAddressText);
    let bestScore = 0;
    let matchType = "";
    for (const text of texts) {
      if (needle === text) { bestScore = Math.max(bestScore, 1000); matchType = "exact_address"; }
      else if (text.startsWith(needle)) { bestScore = Math.max(bestScore, 900); matchType ||= "address_prefix"; }
      else if (text.includes(needle)) { bestScore = Math.max(bestScore, 760); matchType ||= "address_contains"; }
      else if (needle.includes(text) && text.length >= 8) { bestScore = Math.max(bestScore, 680); matchType ||= "address_alias"; }
    }
    return bestScore ? { record, score: bestScore, matchType } : null;
  }

  function addressIndexRank(candidate, needle) {
    const { row, matchType } = candidate;
    const label = normaliseAddressText(row?.label);
    const text = normaliseAddressText(row?.search_text);
    const key = normaliseAddressText(row?.search_key);
    const base = normaliseAddressText(row?.base_key);
    if (matchType === "exact_address") return 1000;
    if (label.startsWith(needle)) return 960;
    if (key && key.startsWith(needle)) return 950;
    if (base && base.startsWith(needle)) return 940;
    if (text.startsWith(needle)) return 930;
    if (matchType === "address_contains") return 760;
    const queryTokens = significantAddressTokens(needle);
    const rowTokens = new Set(significantAddressTokens(`${row?.search_text || ""} ${row?.label || ""}`));
    return 500 + queryTokens.filter((token) => rowTokens.has(token)).length;
  }

  function significantAddressTokens(value) {
    const stopwords = new Set(["act", "australia", "avenue", "ave", "drive", "dr", "highway", "hwy", "lane", "ln", "new", "nsw", "nt", "place", "pl", "qld", "road", "rd", "sa", "street", "st", "tas", "unit", "vic", "wa"]);
    return normaliseAddressText(value).split(/\s+/).filter((token) => token.length > 1 && !stopwords.has(token));
  }

  return { addressIndexRank, scoreRecord, significantAddressTokens };
}

module.exports = { createAddressRanking };
