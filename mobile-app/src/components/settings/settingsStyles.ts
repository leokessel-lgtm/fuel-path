import { StyleSheet } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../../theme";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  rootHeader: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  rootTitle: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  rootSubtitle: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
  },
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    overflow: "hidden",
  },
  supportCard: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.md,
  },
  settingsRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingsRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  rowTitle: {
    color: colors.ink,
    fontSize: typeScale.lead,
    fontWeight: "800",
    marginTop: 2,
  },
  rowSummary: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "500",
    marginTop: 2,
  },
  rowChevron: {
    color: colors.muted,
    fontSize: 30,
    fontWeight: "300",
  },
  detailHeader: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  headerBackButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    minHeight: 34,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  headerBackText: {
    color: colors.green,
    fontSize: typeScale.body,
    fontWeight: "800",
  },
  detailTitle: {
    color: colors.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  title: {
    ...typography.title,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
  preferenceGroup: {
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  preferenceRow: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 58,
    padding: spacing.sm,
  },
  preferenceRowSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  preferenceCopy: {
    flex: 1,
    minWidth: 0,
  },
  preferenceTitle: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "800",
  },
  preferenceSummary: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 17,
    marginTop: 2,
  },
  preferenceState: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
    minWidth: 58,
    textAlign: "right",
  },
  preferenceStateSelected: {
    color: colors.greenDark,
  },
});
