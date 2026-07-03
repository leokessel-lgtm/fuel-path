import { StationViewModel } from "../types";

type RouteEvidenceCandidate = Pick<StationViewModel, "actualDetour" | "detourMinutes">;

export function routeDetourEvidenceKind(candidate?: Pick<StationViewModel, "actualDetour">) {
  return candidate?.actualDetour?.source === "route_engine_via_station"
    ? "route_checked"
    : "estimated";
}

export function routeDetourEvidenceLabel(candidate?: Pick<StationViewModel, "actualDetour">) {
  return routeDetourEvidenceKind(candidate) === "route_checked"
    ? "Route-checked"
    : "Estimated";
}

export function routeDetourEvidenceMetricLabel(candidate?: Pick<StationViewModel, "actualDetour">) {
  return routeDetourEvidenceKind(candidate) === "route_checked"
    ? "Route-checked"
    : "Est. detour";
}

export function routeDetourEvidenceLine(
  candidate?: RouteEvidenceCandidate,
  fallbackMinutes = 0,
) {
  const minutes = routeDetourMinutes(candidate, fallbackMinutes);
  const label = routeDetourEvidenceLabel(candidate);
  if (minutes > 0.05) return `${label} detour: ${minutes.toFixed(1)} min`;
  return routeDetourEvidenceKind(candidate) === "route_checked"
    ? "Route-checked stop"
    : "Estimated on-route stop";
}

export function routeDetourNoticePhrase(
  candidate?: RouteEvidenceCandidate,
  fallbackMinutes = 0,
) {
  const minutes = routeDetourMinutes(candidate, fallbackMinutes);
  const checked = routeDetourEvidenceKind(candidate) === "route_checked";
  if (minutes > 0.05) {
    return checked
      ? `Route-checked stop adds about ${minutes.toFixed(1)} min`
      : `Estimated stop adds about ${minutes.toFixed(1)} min`;
  }
  return checked ? "Route-checked stop is on the route" : "Suggested stop is estimated on the route";
}

export function routeDetourMinutes(candidate?: RouteEvidenceCandidate, fallbackMinutes = 0) {
  const candidateMinutes = Number(candidate?.detourMinutes);
  if (Number.isFinite(candidateMinutes)) return candidateMinutes;
  const fallback = Number(fallbackMinutes);
  return Number.isFinite(fallback) ? fallback : 0;
}
