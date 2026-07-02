import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";
import { AppPreferences, SavedCommute } from "../types";
import { weeklyFleetLiteReportSummary } from "../utils/decisionEvidence";

export function WeeklyReportCard({
  preferences,
  savedCommutes,
}: {
  preferences: AppPreferences;
  savedCommutes: SavedCommute[];
}) {
  const weeklyReport = weeklyFleetLiteReportSummary({ preferences, savedCommutes });

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Weekly report</Text>
      <Text style={styles.title}>Fleet-lite summary</Text>
      <Text style={styles.muted}>
        A driver-facing view of watched routes, selected discounts and alert outcomes. No payroll, accounting or admin tools.
      </Text>
      <View style={styles.weeklyReportGrid}>
        <WeeklyReportMetric label="Watched" value={`${weeklyReport.activeRouteCount}`} />
        <WeeklyReportMetric label="Synced" value={`${weeklyReport.backendSyncedRouteCount}`} />
        <WeeklyReportMetric label="Local only" value={`${weeklyReport.localOnlyRouteCount}`} />
        <WeeklyReportMetric label="Blocked" value={`${weeklyReport.blockedRouteCount}`} />
      </View>
      <View style={styles.weeklyReportPanel}>
        <Text style={styles.weeklyReportLine}>{weeklyReport.reportLine}</Text>
        <Text style={styles.weeklyReportMeta}>
          Rule floor ${weeklyReport.minSavingDollars}+ saving, {weeklyReport.maxDetourMinutes} min max detour.
        </Text>
        <Text style={styles.weeklyReportMeta}>Policy brands: {weeklyReport.policyBrands}</Text>
        <Text style={styles.weeklyReportMeta}>{weeklyReport.outcomeLine}</Text>
      </View>
    </View>
  );
}

function WeeklyReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.weeklyReportMetric}>
      <Text style={styles.weeklyReportMetricLabel}>{label}</Text>
      <Text style={styles.weeklyReportMetricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow.float,
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.md,
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
  weeklyReportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  weeklyReportMetric: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: "46%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 58,
    padding: spacing.md,
  },
  weeklyReportMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  weeklyReportMetricValue: {
    color: colors.ink,
    fontSize: typeScale.lead,
    fontWeight: "700",
    marginTop: 2,
  },
  weeklyReportPanel: {
    ...surfaces.softPanel,
    borderRadius: radii.xl,
    gap: spacing.xs,
    padding: spacing.md,
  },
  weeklyReportLine: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "600",
    lineHeight: 18,
  },
  weeklyReportMeta: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});
