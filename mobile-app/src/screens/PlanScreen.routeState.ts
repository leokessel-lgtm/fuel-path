import { EvCharger, EvChargerResponse, MapPoint, ScoreResponse } from "../types";

export type PlanRouteData = {
  endpoints?: { from: MapPoint; to: MapPoint };
  points: MapPoint[];
  distanceKm: number | null;
};

export type PlanEvFallback = {
  chargers: EvCharger[];
  context: EvChargerResponse["context"] | null;
  loading: boolean;
  error: string;
};

export type PlanRouteState = {
  error: string;
  evFallback: PlanEvFallback;
  loading: boolean;
  result: ScoreResponse | null;
  routeControlsCollapsed: boolean;
  routeData: PlanRouteData;
  routeStarted: boolean;
  selectedChargerId?: string;
  selectedCode?: string;
};

const emptyRoute: PlanRouteData = { endpoints: undefined, points: [], distanceKm: null };

export const emptyEvFallback: PlanEvFallback = {
  chargers: [],
  context: null,
  error: "",
  loading: false,
};

export const initialPlanRouteState: PlanRouteState = {
  error: "",
  evFallback: emptyEvFallback,
  loading: false,
  result: null,
  routeControlsCollapsed: false,
  routeData: emptyRoute,
  routeStarted: false,
  selectedChargerId: undefined,
  selectedCode: undefined,
};

type RouteResolvedPayload = {
  collapseControls: boolean;
  routeData: PlanRouteData;
};

export type PlanRouteAction =
  | { type: "blocked"; error: string }
  | { type: "clear-error" }
  | { type: "collapse-controls"; collapsed: boolean }
  | { type: "edit" }
  | { type: "error"; error: string }
  | { type: "ev-fallback-loading"; loading: boolean }
  | ({ type: "ev-success"; evFallback: PlanEvFallback; selectedChargerId?: string } & RouteResolvedPayload)
  | { type: "finish-loading" }
  | ({ type: "fuel-success"; result: ScoreResponse; selectedCode?: string } & RouteResolvedPayload)
  | { type: "select-charger"; chargerId: string }
  | { type: "select-station"; stationCode?: string }
  | { type: "start-loading" }
  | { type: "transient-error"; error: string }
  | { type: "validation-error"; error: string };

export function planRouteReducer(state: PlanRouteState, action: PlanRouteAction): PlanRouteState {
  switch (action.type) {
    case "blocked":
      return {
        ...state,
        error: action.error,
        result: null,
        routeControlsCollapsed: false,
        routeData: { ...state.routeData, points: [] },
        selectedCode: undefined,
      };
    case "clear-error":
      return { ...state, error: "" };
    case "collapse-controls":
      return { ...state, routeControlsCollapsed: action.collapsed };
    case "edit":
      return {
        ...state,
        error: "",
        evFallback: emptyEvFallback,
        result: null,
        routeData: emptyRoute,
        routeStarted: false,
        selectedCode: undefined,
      };
    case "error":
      return {
        ...state,
        error: action.error,
        evFallback: emptyEvFallback,
        result: null,
        routeControlsCollapsed: false,
        routeData: emptyRoute,
      };
    case "ev-fallback-loading":
      return {
        ...state,
        evFallback: { ...state.evFallback, error: "", loading: action.loading },
      };
    case "ev-success":
      return {
        ...state,
        error: "",
        evFallback: action.evFallback,
        result: null,
        routeControlsCollapsed: action.collapseControls,
        routeData: action.routeData,
        selectedChargerId: action.selectedChargerId,
        selectedCode: undefined,
      };
    case "finish-loading":
      return { ...state, loading: false };
    case "fuel-success":
      return {
        ...state,
        error: "",
        evFallback: emptyEvFallback,
        result: action.result,
        routeControlsCollapsed: action.collapseControls,
        routeData: action.routeData,
        selectedCode: action.selectedCode,
      };
    case "select-charger":
      return { ...state, selectedChargerId: action.chargerId, selectedCode: undefined };
    case "select-station":
      return { ...state, selectedChargerId: undefined, selectedCode: action.stationCode };
    case "start-loading":
      return {
        ...state,
        error: "",
        evFallback: emptyEvFallback,
        loading: true,
        routeStarted: true,
      };
    case "transient-error":
      return { ...state, error: action.error };
    case "validation-error":
      return { ...state, error: action.error, routeControlsCollapsed: false };
    default:
      return state;
  }
}
