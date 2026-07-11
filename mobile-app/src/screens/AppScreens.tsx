// TypeScript fallback. Metro selects AppScreens.web.tsx or AppScreens.native.tsx.
export { AccountScreen } from "./AccountScreen";
export { NearbyScreen } from "./NearbyScreen";
export { PlanScreen } from "./PlanScreen";

export function preloadAppScreen(_screen: "plan" | "nearby" | "account") {
  // Platform implementations decide whether preloading is required.
}
