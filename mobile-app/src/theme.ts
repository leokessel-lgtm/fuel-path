export const colors = {
  canvas: "#eef2f4",
  green: "#087a63",
  greenDark: "#075642",
  greenSoft: "#dff2e5",
  ink: "#17201b",
  inkSoft: "#253229",
  muted: "#5f6c65",
  mutedSoft: "#8b9690",
  line: "#dbe4df",
  panel: "#f7faf8",
  panelStrong: "#eef5f0",
  mapMist: "#e8f0ec",
  white: "#ffffff",
  black: "#111412",
  route: "#ff6a3d",
  routeDark: "#d94d28",
  amber: "#9a5b00",
  amberSoft: "#fff2d6",
  red: "#a33a2a",
  blue: "#2d5f9a",
  blueSoft: "#e4efff",
};

export const mapSkin = {
  route: colors.route,
  routeCasing: "rgba(17, 20, 18, 0.82)",
  routeDark: colors.routeDark,
  routeShadow: "rgba(255, 106, 61, 0.22)",
  baseTileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  baseAttribution: "&copy; OpenStreetMap contributors",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 22,
  xxl: 28,
  control: 22,
  pill: 999,
};

export const typeScale = {
  micro: 10,
  caption: 12,
  body: 14,
  lead: 16,
  title: 22,
  section: 24,
  hero: 28,
};

export const typography = {
  eyebrow: {
    color: colors.greenDark,
    fontSize: typeScale.micro,
    fontWeight: "600" as const,
  },
  title: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: "700" as const,
  },
  bodyStrong: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "600" as const,
  },
  bodyMuted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400" as const,
  },
};

export const surfaces = {
  field: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
  },
  secondaryAction: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
  },
  floating: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: colors.line,
    borderWidth: 1,
  },
  softPanel: {
    backgroundColor: colors.panelStrong,
    borderColor: colors.line,
    borderWidth: 1,
  },
  darkAction: {
    backgroundColor: colors.black,
  },
};

export const shadow = {
  soft: {
    boxShadow: "0 8px 18px rgba(23, 32, 27, 0.1)",
    elevation: 5,
  },
  float: {
    boxShadow: "0 14px 30px rgba(23, 32, 27, 0.13)",
    elevation: 8,
  },
};
