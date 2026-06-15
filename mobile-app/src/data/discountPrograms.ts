import { DiscountRule } from "../types";

export const discountPrograms: DiscountRule[] = [
  {
    id: "everyday_rewards",
    label: "Everyday Rewards fuel discount",
    shortLabel: "Everyday Rewards",
    centsPerLitre: 4,
  },
  {
    id: "flybuys",
    label: "Flybuys docket discount",
    shortLabel: "Flybuys",
    centsPerLitre: 4,
  },
  {
    id: "nrma_ampol",
    label: "NRMA Ampol member discount",
    shortLabel: "NRMA / Ampol",
    centsPerLitre: 5,
  },
  {
    id: "fleet_card",
    label: "Fleet card estimate",
    shortLabel: "Fleet card",
    centsPerLitre: 3,
  },
  {
    id: "linkt_rewards",
    label: "Linkt Rewards fuel offer",
    shortLabel: "Linkt Rewards",
    centsPerLitre: 6,
  },
];
