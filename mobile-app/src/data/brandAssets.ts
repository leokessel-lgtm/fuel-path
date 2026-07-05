import { ImageSourcePropType } from "react-native";

import { colors } from "../theme";
import { Station } from "../types";

export type BrandStyle = {
  label: string;
  initials: string;
  color: string;
  icon?: ImageSourcePropType;
  aliases: string[];
};

export const stationBrandStyles: BrandStyle[] = [
  {
    label: "EG Ampol",
    initials: "EG",
    color: "#173f8a",
    icon: require("../../assets/brand-icons/eg-ampol.png"),
    aliases: ["eg ampol", "eg australia", "eg fuel", "eg group", "eurogarages"],
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
    icon: require("../../assets/brand-icons/apw.png"),
    aliases: ["apw", "apw fuel"],
  },
  {
    label: "Inland Petroleum",
    initials: "IP",
    color: "#b59a20",
    icon: require("../../assets/brand-icons/inland.png"),
    aliases: ["inland", "inland petroleum"],
  },
  {
    label: "APCO",
    initials: "AP",
    color: "#0072bc",
    icon: require("../../assets/brand-icons/apco.png"),
    aliases: ["apco"],
  },
  {
    label: "AM/PM",
    initials: "AP",
    color: "#f39b21",
    icon: require("../../assets/brand-icons/ampm.png"),
    aliases: ["am/pm", "ampm", "am pm"],
  },
  {
    label: "Atlas Fuel",
    initials: "AF",
    color: "#0b7a43",
    icon: require("../../assets/brand-icons/atlas-fuel.png"),
    aliases: ["atlas fuel", "atlas"],
  },
  {
    label: "Bennett's Petroleum",
    initials: "BP",
    color: "#0e6ba8",
    icon: require("../../assets/brand-icons/bennetts-petroleum.png"),
    aliases: ["bennett's petroleum", "bennetts petroleum", "bennett petroleum", "bennetts"],
  },
  {
    label: "Better Choice",
    initials: "BC",
    color: "#f1c232",
    icon: require("../../assets/brand-icons/better-choice.png"),
    aliases: ["better choice", "better choice fuel"],
  },
  {
    label: "Endeavour Petroleum",
    initials: "EP",
    color: "#6b2b8a",
    icon: require("../../assets/brand-icons/endeavour-petroleum.png"),
    aliases: ["endeavour petroleum", "ee fuels", "eefuels"],
  },
  {
    label: "Freedom Fuels",
    initials: "FF",
    color: "#e53935",
    icon: require("../../assets/brand-icons/freedom-fuels.png"),
    aliases: ["freedom fuels", "freedom fuel"],
  },
  {
    label: "FuelXpress",
    initials: "FX",
    color: "#1c4f9c",
    icon: require("../../assets/brand-icons/fuelxpress.png"),
    aliases: ["fuelxpress", "fuel xpress"],
  },
  {
    label: "IOR",
    initials: "IO",
    color: "#232323",
    icon: require("../../assets/brand-icons/ior.png"),
    aliases: ["ior", "ior pty ltd"],
  },
  {
    label: "Lowes",
    initials: "L",
    color: "#e84353",
    icon: require("../../assets/brand-icons/lowes.png"),
    aliases: ["lowes", "lowes petrol"],
  },
  {
    label: "Mogas",
    initials: "M",
    color: "#1f6fb5",
    icon: require("../../assets/brand-icons/mogas.png"),
    aliases: ["mogas", "mogas regional"],
  },
  {
    label: "On the Run",
    initials: "OT",
    color: "#d3e31f",
    icon: require("../../assets/brand-icons/otr.png"),
    aliases: ["on the run", "otr"],
  },
  {
    label: "Pacific Fuel Solutions",
    initials: "PF",
    color: "#1f64b7",
    icon: require("../../assets/brand-icons/pacific-fuel-solutions.png"),
    aliases: ["pacific fuel solutions", "pacific fuel solutio"],
  },
  {
    label: "Pacific Petroleum",
    initials: "PP",
    color: "#1f64b7",
    icon: require("../../assets/brand-icons/pacific-petroleum.png"),
    aliases: ["pacific petroleum"],
  },
  {
    label: "Perrys",
    initials: "P",
    color: "#173f8a",
    icon: require("../../assets/brand-icons/perrys.png"),
    aliases: ["perrys", "perrys fuel", "perrys fuel distributors"],
  },
  {
    label: "Puma Energy",
    initials: "P",
    color: "#178448",
    icon: require("../../assets/brand-icons/puma-energy.png"),
    aliases: ["puma energy", "puma"],
  },
  {
    label: "Riordan Fuels",
    initials: "RF",
    color: "#c8202f",
    icon: require("../../assets/brand-icons/riordan-fuels.png"),
    aliases: ["riordan fuels", "riordan fuel", "riordan"],
  },
  {
    label: "SOLO",
    initials: "S",
    color: "#ef6c00",
    icon: require("../../assets/brand-icons/solo.png"),
    aliases: ["solo", "solo corp", "solo oil"],
  },
  {
    label: "Tas Petroleum",
    initials: "TP",
    color: "#0b5fa5",
    icon: require("../../assets/brand-icons/tas-petroleum.png"),
    aliases: ["tas petroleum", "tas petrol", "taspet"],
  },
  {
    label: "Vibe",
    initials: "V",
    color: "#2637a8",
    icon: require("../../assets/brand-icons/vibe.png"),
    aliases: ["vibe", "vibe petroleum"],
  },
  {
    label: "Woodham Petroleum",
    initials: "WP",
    color: "#26a7df",
    icon: require("../../assets/brand-icons/woodham-petroleum.png"),
    aliases: ["woodham petroleum", "woodham"],
  },
  {
    label: "X Convenience",
    initials: "X",
    color: "#2b2b2b",
    icon: require("../../assets/brand-icons/x-convenience.png"),
    aliases: ["x convenience", "x-convenience"],
  },
  {
    label: "Burk Fuel",
    initials: "B",
    color: "#1a4f8f",
    icon: require("../../assets/brand-icons/burk.png"),
    aliases: ["burk", "burk fuel", "burk fuels"],
  },
  {
    label: "CGL Fuel",
    initials: "CG",
    color: "#1d6e9d",
    icon: require("../../assets/brand-icons/cgl-fuel.png"),
    aliases: ["cgl", "cgl fuel", "cgl fuels"],
  },
  {
    label: "Dunnings",
    initials: "D",
    color: "#0f5c8c",
    icon: require("../../assets/brand-icons/dunnings.png"),
    aliases: ["dunnings", "dunnings fuel"],
  },
  {
    label: "Eagle Petroleum",
    initials: "E",
    color: "#1e4c88",
    icon: require("../../assets/brand-icons/eagle-petroleum.png"),
    aliases: ["eagle", "eagle petroleum", "eagle fuels"],
  },
  {
    label: "FDWA",
    initials: "FD",
    color: "#0c6f9d",
    icon: require("../../assets/brand-icons/fdwa.png"),
    aliases: ["fdwa", "fuel distributors wa"],
  },
  {
    label: "Maisey Fuels",
    initials: "MF",
    color: "#175f8a",
    icon: require("../../assets/brand-icons/maisey-fuels.png"),
    aliases: ["maisey", "maisey fuels", "maisy fuels"],
  },
  {
    label: "Petro Fuels",
    initials: "PF",
    color: "#0b5ea8",
    icon: require("../../assets/brand-icons/petro-fuels.png"),
    aliases: ["petro fuels", "petro fuel"],
  },
  {
    label: "WA Fuels",
    initials: "WA",
    color: "#174c7c",
    icon: require("../../assets/brand-icons/wa-fuels.png"),
    aliases: ["wa fuels", "wa fuel"],
  },
  {
    label: "Apollo Fuel",
    initials: "AF",
    color: "#185f8c",
    icon: require("../../assets/brand-icons/apollo-fuel.png"),
    aliases: ["apollo fuel", "apollo"],
  },
  {
    label: "FastFuel 24/7",
    initials: "FF",
    color: "#1f6fb5",
    icon: require("../../assets/brand-icons/fastfuel.png"),
    aliases: ["fastfuel", "fastfuel 24/7", "fast fuel"],
  },
  {
    label: "Fuel Zone",
    initials: "FZ",
    color: "#247a4d",
    icon: require("../../assets/brand-icons/fuel-zone.png"),
    aliases: ["fuel zone", "fuelzone"],
  },
  {
    label: "Gull",
    initials: "G",
    color: "#efb321",
    icon: require("../../assets/brand-icons/gull.png"),
    aliases: ["gull"],
  },
  {
    label: "Hope Energy",
    initials: "HE",
    color: "#0b7a43",
    icon: require("../../assets/brand-icons/hope-energy.png"),
    aliases: ["hope energy", "hopeenergy", "hopefuel"],
  },
  {
    label: "LMCT+",
    initials: "L+",
    color: "#111827",
    icon: require("../../assets/brand-icons/lmct.png"),
    aliases: ["lmct", "lmct+"],
  },
  {
    label: "MATEX",
    initials: "M",
    color: "#1c4f9c",
    icon: require("../../assets/brand-icons/matex.png"),
    aliases: ["matex", "matex fuel"],
  },
  {
    label: "Payless Fuel",
    initials: "P",
    color: "#d97706",
    icon: require("../../assets/brand-icons/payless-fuel.png"),
    aliases: ["payless", "payless fuel"],
  },
  {
    label: "Sinopec",
    initials: "S",
    color: "#d21f26",
    icon: require("../../assets/brand-icons/sinopec.png"),
    aliases: ["sinopec"],
  },
  {
    label: "METCO",
    initials: "M",
    color: "#1c4f9c",
    icon: require("../../assets/brand-icons/metco.png"),
    aliases: ["metco"],
  },
  {
    label: "dayef",
    initials: "D",
    color: "#247a4d",
    icon: require("../../assets/brand-icons/dayef.png"),
    aliases: ["dayef"],
  },
  {
    label: "Des Brown Service Centre",
    initials: "DB",
    color: "#8a4b1f",
    icon: require("../../assets/brand-icons/des-brown-service-centre.png"),
    aliases: ["des brown", "des brown service centre"],
  },
  {
    label: "Petrogas",
    initials: "P",
    color: "#1f64b7",
    icon: require("../../assets/brand-icons/petrogas.png"),
    aliases: ["petrogas"],
  },
  {
    label: "Phoenix Fuels",
    initials: "PF",
    color: "#c8202f",
    icon: require("../../assets/brand-icons/phoenix-fuels.png"),
    aliases: ["phoenix fuels", "phoenix fuel", "phoenix"],
  },
  {
    label: "Powerfuel",
    initials: "P",
    color: "#5f2d86",
    icon: require("../../assets/brand-icons/powerfuel.png"),
    aliases: ["powerfuel", "power fuel"],
  },
  {
    label: "Prime Petroleum",
    initials: "P",
    color: "#173f8a",
    icon: require("../../assets/brand-icons/prime-petroleum.png"),
    aliases: ["prime", "prime petroleum"],
  },
  {
    label: "Roo Petroleum",
    initials: "R",
    color: "#168f63",
    icon: require("../../assets/brand-icons/roo-petroleum.png"),
    aliases: ["roo", "roo petroleum"],
  },
  {
    label: "Supreme Fuel",
    initials: "S",
    color: "#2b2b2b",
    icon: require("../../assets/brand-icons/supreme-fuel.png"),
    aliases: ["supreme fuel", "supreme petroleum", "supreme"],
  },
  {
    label: "Westside",
    initials: "W",
    color: "#0f5c8c",
    icon: require("../../assets/brand-icons/westside.png"),
    aliases: ["westside", "westside petroleum"],
  },
  {
    label: "Independent",
    initials: "I",
    color: "#2c5f5c",
    icon: require("../../assets/brand-icons/independent.png"),
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
      "temco",
      "temco petroleum",
      "ez fuel",
      "coral petroleum",
      "unknown",
      "calvi petrol",
      "boost fuel",
      "npg retail",
    ],
  },
];

function normalise(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

export function brandStyleForStation(station: Station): BrandStyle {
  const brandText = normalise(`${station.brand || ""} ${station.name || ""}`);
  const match = stationBrandStyles.find((style) =>
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

export function stationBrandOptions() {
  return stationBrandStyles.map(({ aliases, color, icon, initials, label }) => ({
    aliases,
    color,
    icon,
    initials,
    label,
  }));
}

export function stationBrandFilterValues(labels: string[]) {
  const selected = new Set(labels);
  const values = new Set<string>();
  stationBrandStyles.forEach((brand) => {
    if (!selected.has(brand.label)) return;
    values.add(brand.label);
    brand.aliases.forEach((alias) => values.add(alias));
  });
  return Array.from(values);
}
