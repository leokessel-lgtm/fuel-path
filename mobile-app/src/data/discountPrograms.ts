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
    id: "rac_member",
    label: "RAC-style member discount",
    shortLabel: "RAC member",
    centsPerLitre: 4,
  },
  {
    id: "costco_member",
    label: "Costco member price estimate",
    shortLabel: "Costco",
    centsPerLitre: 6,
  },
  {
    id: "seven_eleven_lock",
    label: "7-Eleven manual price lock",
    shortLabel: "7-Eleven lock",
    centsPerLitre: 4,
  },
  {
    id: "fleet_card",
    label: "Fleet card estimate",
    shortLabel: "Fleet card",
    centsPerLitre: 3,
  },
];
