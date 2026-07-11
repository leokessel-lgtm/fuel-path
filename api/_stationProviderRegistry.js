const PROVIDER_ORDER = ["qld", "wa", "vic", "sa", "nt", "nsw", "tas"];

function createStationProviderRegistry({
  loadLiveQldStations,
  loadLiveWaStations,
  loadLiveVicStations,
  loadLiveSaStations,
  loadLiveNtStations,
  loadLiveStations,
  loadLiveTasStations,
} = {}) {
  return {
    qld: { sourceId: "api_qld", load: ({ forceRefresh }) => loadLiveQldStations({ forceRefresh }) },
    wa: { sourceId: "api_wa", load: ({ forceRefresh, points, radiusKm, fuels }) => loadLiveWaStations({ forceRefresh, points, radiusKm, fuels }) },
    vic: { sourceId: "api_vic", load: ({ forceRefresh }) => loadLiveVicStations({ forceRefresh }) },
    sa: { sourceId: "api_sa", load: ({ forceRefresh }) => loadLiveSaStations({ forceRefresh }) },
    nt: { sourceId: "api_nt", load: ({ forceRefresh, points, radiusKm, fuels }) => loadLiveNtStations({ forceRefresh, points, radiusKm, fuels }) },
    nsw: { sourceId: "api_nsw", load: ({ forceRefresh }) => loadLiveStations({ forceRefresh }) },
    tas: { sourceId: "api_tas", load: ({ forceRefresh, points, radiusKm, fuels }) => loadLiveTasStations({ forceRefresh, points, radiusKm, fuels }) },
  };
}

module.exports = { PROVIDER_ORDER, createStationProviderRegistry };
