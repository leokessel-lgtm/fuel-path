import { MapPoint } from "../types";

export function locationSuggestionDisplay(point: MapPoint) {
  const parts = suggestionParts(point);
  const title =
    point.displayTitle ||
    (titleConsumesStreetNumber(parts) ? `${parts[0]} ${parts[1]}` : parts[0]) ||
    point.label;
  const startIndex = titleConsumesStreetNumber(parts) ? 2 : 1;
  const subtitle =
    point.displaySubtitle ||
    parts.slice(startIndex, startIndex + 3).join(", ") ||
    point.refineHint ||
    "Australia";
  return {
    title,
    subtitle,
    badge: usefulBadge(point),
  };
}

function usefulBadge(point: MapPoint) {
  if (point.refineRequired) return "Building";
  if (point.sourceLabel === "Exact address") return "Exact address";
  if (point.sourceLabel === "Street/road") return "Street";
  if (point.sourceLabel === "Suburb/area") return "Suburb";
  if (point.sourceLabel === "Transit stop") return "Transit stop";
  if (point.sourceLabel === "Place/landmark") return "Place";
  if (point.sourceLabel === "Fuel station") return "Fuel station";
  return "";
}

function suggestionParts(point: MapPoint) {
  return point.label.split(",").map((part) => part.trim()).filter(Boolean);
}

function titleConsumesStreetNumber(parts: string[]) {
  return Boolean(parts[1] && isStreetNumberFragment(parts[0]));
}

function isStreetNumberFragment(value: string) {
  return /^\d+[a-z]?(?:[/-]\d+[a-z]?)?$/i.test(value.trim());
}
