import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typeScale } from "../theme";
import { MapPoint } from "../types";
import { locationEvidence, LocationEvidenceLevel } from "../utils/locationEvidence";

type LocationEvidenceChipProps = {
  point: MapPoint;
  showDetail?: boolean;
};

export function LocationEvidenceChip({ point, showDetail = false }: LocationEvidenceChipProps) {
  const evidence = locationEvidence(point);
  return (
    <View style={styles.row}>
      <View style={[styles.chip, chipStyle(evidence.level)]}>
        <Text style={[styles.chipText, chipTextStyle(evidence.level)]}>{evidence.label}</Text>
      </View>
      {showDetail ? (
        <Text numberOfLines={1} style={styles.detail}>
          {evidence.detail}
        </Text>
      ) : null}
    </View>
  );
}

function chipStyle(level: LocationEvidenceLevel) {
  if (level === "exact") return styles.chipExact;
  if (level === "area") return styles.chipArea;
  if (level === "external") return styles.chipExternal;
  if (level === "limited") return styles.chipLimited;
  if (level === "street") return styles.chipStreet;
  if (level === "unconfirmed") return styles.chipUnconfirmed;
  return styles.chipUnknown;
}

function chipTextStyle(level: LocationEvidenceLevel) {
  if (level === "exact") return styles.chipTextExact;
  if (level === "area") return styles.chipTextArea;
  if (level === "external") return styles.chipTextExternal;
  if (level === "limited") return styles.chipTextLimited;
  if (level === "street") return styles.chipTextStreet;
  if (level === "unconfirmed") return styles.chipTextUnconfirmed;
  return styles.chipTextUnknown;
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipExact: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  chipArea: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  chipExternal: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  chipLimited: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.red,
  },
  chipStreet: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  chipUnconfirmed: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  chipUnknown: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
  },
  chipText: {
    fontSize: typeScale.micro,
    fontWeight: "600",
  },
  chipTextExact: {
    color: colors.greenDark,
  },
  chipTextArea: {
    color: colors.amber,
  },
  chipTextExternal: {
    color: colors.blue,
  },
  chipTextLimited: {
    color: colors.red,
  },
  chipTextStreet: {
    color: colors.amber,
  },
  chipTextUnconfirmed: {
    color: colors.amber,
  },
  chipTextUnknown: {
    color: colors.muted,
  },
  detail: {
    color: colors.muted,
    flex: 1,
    fontSize: typeScale.micro,
    fontWeight: "400",
    minWidth: 0,
  },
});
