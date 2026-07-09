import { ImageSourcePropType } from "react-native";

import { colors } from "../theme";
import { DiscountRule } from "../types";

export type DiscountProgramStyle = {
  color: string;
  icon?: ImageSourcePropType;
  initials: string;
  label: string;
};

const discountProgramStyles: Record<string, DiscountProgramStyle> = {
  everyday_rewards: {
    color: "#f05a28",
    icon: require("../../assets/discount-icons/everyday-rewards.png"),
    initials: "ER",
    label: "Everyday Rewards",
  },
  flybuys: {
    color: "#0057b8",
    icon: require("../../assets/discount-icons/flybuys.png"),
    initials: "F",
    label: "Flybuys",
  },
  gday_parks_shell: {
    color: "#223a7a",
    icon: require("../../assets/discount-icons/gday-parks.png"),
    initials: "GP",
    label: "G'day Parks",
  },
  nrma_ampol: {
    color: "#173f8a",
    icon: require("../../assets/discount-icons/nrma.png"),
    initials: "N",
    label: "NRMA",
  },
  racv_eg_ampol: {
    color: "#006eb6",
    icon: require("../../assets/discount-icons/racv.png"),
    initials: "RV",
    label: "RACV",
  },
  racq_caltex: {
    color: "#005aa9",
    icon: require("../../assets/discount-icons/racq.png"),
    initials: "RQ",
    label: "RACQ",
  },
  rac_wa_caltex: {
    color: "#f4c400",
    icon: require("../../assets/discount-icons/rac-wa.png"),
    initials: "RW",
    label: "RAC WA",
  },
  raa_sa_fuel: {
    color: "#e31b23",
    icon: require("../../assets/discount-icons/raa.png"),
    initials: "RA",
    label: "RAA",
  },
  linkt_7eleven: {
    color: "#6f2dbd",
    icon: require("../../assets/discount-icons/linkt.png"),
    initials: "L",
    label: "Linkt",
  },
  telstra_plus_7eleven: {
    color: "#0064d2",
    icon: require("../../assets/discount-icons/telstra.png"),
    initials: "T",
    label: "Telstra",
  },
  wilson_parking_7eleven: {
    color: "#f58220",
    icon: require("../../assets/discount-icons/wilson-parking.png"),
    initials: "W",
    label: "Wilson Parking",
  },
  nab_goodies_7eleven: {
    color: "#d0002a",
    icon: require("../../assets/discount-icons/nab.png"),
    initials: "N",
    label: "NAB",
  },
};

export function discountProgramStyleFor(program: DiscountRule): DiscountProgramStyle {
  const style = discountProgramStyles[program.id];
  if (style) return style;

  const words = (program.shortLabel || program.label || "Discount")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  return {
    color: colors.blue,
    initials: words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    label: program.shortLabel || program.label || "Discount",
  };
}
