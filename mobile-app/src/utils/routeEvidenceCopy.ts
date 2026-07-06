import { StationViewModel } from "../types";

type RouteEvidenceCandidate = Pick<StationViewModel, "actualDetour" | "detourMinutes">;

function routeDetourEvidenceKind(candidate?: Pick<StationViewModel, "actualDetour">) {
  return candidate?.actualDetour?.source === "route_engine_via_station"
    ? "route_checked"
    : "estimated";
}

function routeDetourEvidenceLabel(candidate?: Pick<StationViewModel, "actualDetour">) {
  return routeDetourEvidenceKind(candidate) === "route_checked"
    ? "Checked"
    : "Estimated";
}

export function routeDetourEvidenceMetricLabel(candidate?: Pick<StationViewModel, "actualDetour">) {
  return routeDetourEvidenceKind(candidate) === "route_checked"
    ? "Checked detour"
    : "Est. detour";
}

export function routeDetourEvidenceLine(
  candidate?: RouteEvidenceCandidate,
  fallbackMinutes = 0,
) {
  const minutes = routeDetourMinutes(candidate, fallbackMinutes);
  if (minutes > 0.05) {
    return routeDetourEvidenceKind(candidate) === "route_checked"
      ? `Detour checked: ${minutes.toFixed(1)} min`
      : `Estimated detour: ${minutes.toFixed(1)} min`;
  }
  return routeDetourEvidenceKind(candidate) === "route_checked"
    ? "Checked on-route stop"
    : "Estimated on-route stop";
}

function routeDetourNoticePhrase(
  candidate?: RouteEvidenceCandidate,
  fallbackMinutes = 0,
) {
  const minutes = routeDetourMinutes(candidate, fallbackMinutes);
  const checked = routeDetourEvidenceKind(candidate) === "route_checked";
  if (minutes > 0.05) {
    return checked
      ? `Checked detour adds about ${minutes.toFixed(1)} min`
      : `Estimated stop adds about ${minutes.toFixed(1)} min`;
  }
  return checked ? "Checked stop is on the route" : "Suggested stop is estimated on the route";
}

export function routeDetourMinutes(candidate?: RouteEvidenceCandidate, fallbackMinutes = 0) {
  const candidateMinutes = Number(candidate?.detourMinutes);
  if (Number.isFinite(candidateMinutes)) return candidateMinutes;
  const fallback = Number(fallbackMinutes);
  return Number.isFinite(fallback) ? fallback : 0;
}
