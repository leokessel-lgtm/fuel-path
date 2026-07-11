import { lazy } from "react";

const loaders = {
  account: () => import("./AccountScreen").then((module) => ({ default: module.AccountScreen })),
  nearby: () => import("./NearbyScreen").then((module) => ({ default: module.NearbyScreen })),
  plan: () => import("./PlanScreen").then((module) => ({ default: module.PlanScreen })),
};

export const AccountScreen = lazy(loaders.account);
export const NearbyScreen = lazy(loaders.nearby);
export const PlanScreen = lazy(loaders.plan);

export function preloadAppScreen(screen: keyof typeof loaders) {
  void loaders[screen]();
}
