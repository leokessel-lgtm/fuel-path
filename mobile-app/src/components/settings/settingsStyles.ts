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
    ...typography.title,
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
    ...typography.listTitle,
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
    fontSize: typography.buttonLabel.fontSize,
    fontWeight: typography.buttonLabel.fontWeight,
  },
  detailTitle: {
    ...typography.title,
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
  dataDeleteButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.red,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  dataDeleteButtonText: {
    color: colors.red,
    fontSize: typography.buttonLabel.fontSize,
    fontWeight: typography.buttonLabel.fontWeight,
  },
  preferenceGroup: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    textTransform: "uppercase",
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
    ...typography.bodyStrong,
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
