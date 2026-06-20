import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale, typography } from "../theme";

const MIN_SAVING_OPTIONS = [3, 5, 8, 12];
const MAX_DETOUR_OPTIONS = [3, 5, 8, 12];

export function DecisionRuleCard({
  maxDetourMinutes,
  minSavingDollars,
  onUpdateDecisionRule,
}: {
  maxDetourMinutes: number;
  minSavingDollars: number;
  onUpdateDecisionRule: (key: "minSavingDollars" | "maxDetourMinutes", value: number) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Decision rule</Text>
      <Text style={styles.title}>Worth the detour</Text>
      <View style={styles.rulePickerGroup}>
        <DecisionRuleSelector
          label="Minimum saving"
          options={MIN_SAVING_OPTIONS}
          renderValue={(value) => `$${value}`}
          selected={minSavingDollars}
          onSelect={(value) => onUpdateDecisionRule("minSavingDollars", value)}
        />
        <DecisionRuleSelector
          label="Max detour"
          options={MAX_DETOUR_OPTIONS}
          renderValue={(value) => `${value} min`}
          selected={maxDetourMinutes}
          onSelect={(value) => onUpdateDecisionRule("maxDetourMinutes", value)}
        />
      </View>
    </View>
  );
}

function DecisionRuleSelector({
  label,
  onSelect,
  options,
  renderValue,
  selected,
}: {
  label: string;
  onSelect: (value: number) => void;
  options: number[];
  renderValue: (value: number) => string;
  selected: number;
}) {
  return (
    <View style={styles.rulePicker}>
      <Text style={styles.rulePickerLabel}>{label}</Text>
      <View style={styles.ruleOptionRow}>
        {options.map((value) => {
          const active = value === selected;
          return (
            <Pressable
              accessibilityLabel={`${label} ${renderValue(value)}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={`${label}:${value}`}
              onPress={() => onSelect(value)}
              style={[styles.ruleOption, active && styles.ruleOptionSelected]}
            >
              <Text style={[styles.ruleOptionText, active && styles.ruleOptionTextSelected]}>
                {renderValue(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  rulePickerGroup: {
    gap: spacing.md,
  },
  rulePicker: {
    gap: spacing.sm,
  },
  rulePickerLabel: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  ruleOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  ruleOption: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 66,
    paddingHorizontal: spacing.md,
  },
  ruleOptionSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  ruleOptionText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "600",
  },
  ruleOptionTextSelected: {
    color: colors.greenDark,
    fontWeight: "700",
  },
});
