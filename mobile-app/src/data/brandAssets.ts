import { ImageSourcePropType } from "react-native";

import { colors } from "../theme";
import { Station } from "../types";

type BrandStyle = {
  label: string;
  initials: string;
  color: string;
  icon?: ImageSourcePropType;
  aliases: string[];
};

const brandStyles: BrandStyle[] = [
  {
    label: "EG Ampol",
    initials: "EG",
    color: "#173f8a",
    icon: require("../../assets/brand-icons/eg-ampol.png"),
    aliases: ["eg ampol", "eg australia", "eg fuel", "eg group"],
  },
  {
    label: "Reddy Express",
    initials: "R",
    color: "#df2f2f",
    icon: require("../../assets/brand-icons/reddy.png"),
    aliases: ["reddy", "reddy express", "shell reddy", "coles express"],
  },
  {
    label: "Shell",
    initials: "S",
    color: "#f6b800",
    icon: require("../../assets/brand-icons/shell.png"),
    aliases: ["shell"],
  },
  {
    label: "Ampol",
    initials: "A",
    color: "#e53935",
    icon: require("../../assets/brand-icons/ampol.png"),
    aliases: ["ampol", "ampol foodary"],
  },
  {
    label: "Caltex",
    initials: "C",
    color: "#1565c0",
    icon: require("../../assets/brand-icons/caltex.png"),
    aliases: ["caltex"],
  },
  {
    label: "Budget",
    initials: "B",
    color: "#0f5c8c",
    icon: require("../../assets/brand-icons/budget.png"),
    aliases: ["budget", "budget petrol"],
  },
  {
    label: "BP",
    initials: "BP",
    color: "#138a36",
    icon: require("../../assets/brand-icons/bp.png"),
    aliases: ["bp", "bp connect"],
  },
  {
    label: "7-Eleven",
    initials: "7",
    color: "#ef6c00",
    icon: require("../../assets/brand-icons/seven-eleven.png"),
    aliases: ["7-eleven", "7 eleven", "7eleven", "711"],
  },
  {
    label: "United",
    initials: "U",
    color: "#1e63b5",
    icon: require("../../assets/brand-icons/united.png"),
    aliases: ["united", "united petroleum"],
  },
  {
    label: "Metro",
    initials: "M",
    color: "#1b7f5c",
    icon: require("../../assets/brand-icons/metro.png"),
    aliases: ["metro", "metro fuel", "metro petroleum"],
  },
  {
    label: "Mobil",
    initials: "M",
    color: "#1f4f9c",
    icon: require("../../assets/brand-icons/mobil.png"),
    aliases: ["mobil"],
  },
  {
    label: "Costco",
    initials: "C",
    color: "#005dab",
    icon: require("../../assets/brand-icons/costco.png"),
    aliases: ["costco", "costco fuel", "costco wholesale"],
  },
  {
    label: "Speedway",
    initials: "SW",
    color: "#5f2d86",
    icon: require("../../assets/brand-icons/speedway.png"),
    aliases: ["speedway"],
  },
  {
    label: "Pearl Energy",
    initials: "P",
    color: "#1597d3",
    icon: require("../../assets/brand-icons/pearl.png"),
    aliases: ["pearl", "pearl energy"],
  },
  {
    label: "U-GO",
    initials: "UG",
    color: "#ff8200",
    icon: require("../../assets/brand-icons/ugo.png"),
    aliases: ["u-go", "u go", "ugo"],
  },
  {
    label: "Enhance",
    initials: "E",
    color: "#009b4d",
    icon: require("../../assets/brand-icons/enhance.png"),
    aliases: ["enhance"],
  },
  {
    label: "ASTRON",
    initials: "A",
    color: "#f26b21",
    icon: require("../../assets/brand-icons/astron.png"),
    aliases: ["astron", "astron energy"],
  },
  {
    label: "ARKO Energy",
    initials: "AE",
    color: "#2f95c8",
    icon: require("../../assets/brand-icons/arko.png"),
    aliases: ["arko", "arko energy"],
  },
  {
    label: "Liberty",
    initials: "L",
    color: "#0b5ea8",
    icon: require("../../assets/brand-icons/liberty.png"),
    aliases: ["liberty", "liberty oil", "liberty convenience"],
  },
  {
    label: "Ultra Petroleum",
    initials: "UP",
    color: "#f36b2a",
    icon: require("../../assets/brand-icons/ultra.png"),
    aliases: ["ultra", "ultra petroleum"],
  },
  {
    label: "APW",
    initials: "AP",
    color: "#222970",
    aliases: ["apw", "apw fuel"],
  },
  {
    label: "Inland Petroleum",
    initials: "IP",
    color: "#b59a20",
    aliases: ["inland", "inland petroleum"],
  },
  {
    label: "APCO",
    initials: "AP",
    color: "#0072bc",
    aliases: ["apco"],
  },
  {
    label: "AM/PM",
    initials: "AP",
    color: "#f39b21",
    aliases: ["am/pm", "ampm", "am pm"],
  },
  {
    label: "Atlas Fuel",
    initials: "AF",
    color: "#0b7a43",
    aliases: ["atlas fuel", "atlas"],
  },
  {
    label: "Bennett's Petroleum",
    initials: "BP",
    color: "#0e6ba8",
    aliases: ["bennett's petroleum", "bennetts petroleum", "bennett petroleum"],
  },
  {
    label: "Better Choice",
    initials: "BC",
    color: "#f1c232",
    aliases: ["better choice", "better choice fuel"],
  },
  {
    label: "Endeavour Petroleum",
    initials: "EP",
    color: "#6b2b8a",
    aliases: ["endeavour petroleum", "ee fuels", "eefuels"],
  },
  {
    label: "Freedom Fuels",
    initials: "FF",
    color: "#e53935",
    aliases: ["freedom fuels", "freedom fuel"],
  },
  {
    label: "FuelXpress",
    initials: "FX",
    color: "#1c4f9c",
    aliases: ["fuelxpress", "fuel xpress"],
  },
  {
    label: "IOR",
    initials: "IO",
    color: "#232323",
    aliases: ["ior", "ior pty ltd"],
  },
  {
    label: "Lowes",
    initials: "L",
    color: "#e84353",
    aliases: ["lowes", "lowes petrol"],
  },
  {
    label: "Mogas",
    initials: "M",
    color: "#1f6fb5",
    aliases: ["mogas", "mogas regional"],
  },
  {
    label: "On the Run",
    initials: "OT",
    color: "#d3e31f",
    aliases: ["on the run", "otr"],
  },
  {
    label: "Pacific Fuel Solutions",
    initials: "PF",
    color: "#1f64b7",
    aliases: ["pacific fuel solutions"],
  },
  {
    label: "Pacific Petroleum",
    initials: "PP",
    color: "#1f64b7",
    aliases: ["pacific petroleum"],
  },
  {
    label: "Perrys",
    initials: "P",
    color: "#173f8a",
    aliases: ["perrys", "perrys fuel", "perrys fuel distributors"],
  },
  {
    label: "Puma Energy",
    initials: "P",
    color: "#178448",
    aliases: ["puma energy", "puma"],
  },
  {
    label: "Riordan Fuels",
    initials: "RF",
    color: "#c8202f",
    aliases: ["riordan fuels", "riordan fuel", "riordan"],
  },
  {
    label: "SOLO",
    initials: "S",
    color: "#ef6c00",
    aliases: ["solo", "solo corp", "solo oil"],
  },
  {
    label: "Tas Petroleum",
    initials: "TP",
    color: "#0b5fa5",
    aliases: ["tas petroleum", "tas petrol"],
  },
  {
    label: "Vibe",
    initials: "V",
    color: "#2637a8",
    aliases: ["vibe", "vibe petroleum"],
  },
  {
    label: "Woodham Petroleum",
    initials: "WP",
    color: "#26a7df",
    aliases: ["woodham petroleum", "woodham"],
  },
  {
    label: "X Convenience",
    initials: "X",
    color: "#2b2b2b",
    aliases: ["x convenience", "x-convenience"],
  },
  {
    label: "Independent",
    initials: "I",
    color: "#2c5f5c",
    aliases: [
      "independent",
      "unbranded",
      "apex petroleum",
      "aus petroleum",
      "fairfield fuel",
      "rebel petrol",
      "rural fuel",
      "south west",
      "transwest fuels",
      "bargo petroleum",
      "bargow petroleum",
      "bangalow general store",
      "bendalong general store",
      "bribbaree servo",
      "choice",
      "greens mandurama",
      "highland fuels",
      "hopefuel",
      "the major",
      "tinonee general store",
    ],
  },
  {
    label: "Fuel retailer",
    initials: "F",
    color: "#247a4d",
    icon: require("../../assets/brand-icons/generic-fuel.png"),
    aliases: [
      "prime",
      "prime petroleum",
      "powerfuel",
      "supreme fuel",
      "supreme petroleum",
      "temco",
      "temco petroleum",
      "ez fuel",
      "coral petroleum",
      "payless fuel",
      "matex fuel",
      "calvi petrol",
      "westside",
      "boost fuel",
      "roo petroleum",
      "npg retail",
      "gull",
      "petrogas",
    ],
  },
];

function normalise(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

export function brandStyleForStation(station: Station): BrandStyle {
  const brandText = normalise(`${station.brand || ""} ${station.name || ""}`);
  const match = brandStyles.find((style) =>
    style.aliases.some((alias) => brandText.includes(normalise(alias))),
  );
  if (match) return match;

  const words = (station.brand || station.name || "Fuel")
    .replace(/sample/gi, "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  return {
    label: station.brand || "Station",
    initials: words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    color: colors.blue,
    icon: require("../../assets/brand-icons/generic-fuel.png"),
    aliases: [],
  };
}
