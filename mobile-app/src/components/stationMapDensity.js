const maxVisibleEvMarkers = 18;
const minimumEvMarkerSpacingPx = 58;

function prioritiseSelectedChargers(chargers, selectedChargerId) {
  if (!selectedChargerId) return chargers;
  const selected = chargers.find((charger) => charger.id === selectedChargerId);
  if (!selected) return chargers;
  return [
    selected,
    ...chargers.filter((charger) => charger.id !== selectedChargerId),
  ];
}

function spatiallySeparatedEvChargers(
  chargers,
  selectedChargerId,
  positionForCharger,
  {
    limit = maxVisibleEvMarkers,
    minimumSpacingPx = minimumEvMarkerSpacingPx,
  } = {},
) {
  const selected = [];
  for (const charger of prioritiseSelectedChargers(chargers, selectedChargerId)) {
    const point = positionForCharger(charger);
    if (!point) continue;
    const overlaps = selected.some(({ point: existing }) =>
      Math.hypot(point.x - existing.x, point.y - existing.y) < minimumSpacingPx,
    );
    if (overlaps && charger.id !== selectedChargerId) continue;
    selected.push({ charger, point });
    if (selected.length >= limit) break;
  }
  return selected.map(({ charger }) => charger);
}

module.exports = {
  maxVisibleEvMarkers,
  minimumEvMarkerSpacingPx,
  prioritiseSelectedChargers,
  spatiallySeparatedEvChargers,
};
