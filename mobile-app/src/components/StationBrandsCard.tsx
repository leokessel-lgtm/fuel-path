import { useMemo, useState } from "react";
import { Image, type ImageProps } from "expo-image";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { stationBrandOptions } from "../data/brandAssets";
import { colors, radii, spacing, surfaces, typeScale, typography } from "../theme";
import { AppPreferences, StationBrandMode } from "../types";

const commonBrands = ["Ampol", "BP", "Shell", "Caltex", "7-Eleven"];

export function StationBrandsCard({
  onSetMode,
  onSetPreferredBrands,
  onToggleBrand,
  preferences,
}: {
  onSetMode: (mode: StationBrandMode) => void;
  onSetPreferredBrands: (brands: string[]) => void;
  onToggleBrand: (brand: string) => void;
  preferences: AppPreferences;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(preferences.preferredStationBrands);
  const options = stationBrandOptions();
  const optionsByLabel = useMemo(
    () => new Map(options.map((brand) => [brand.label, brand])),
    [options],
  );
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((brand) =>
      [brand.label, ...brand.aliases].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [options, query]);

  const setMode = (mode: StationBrandMode) => {
    if (mode === "preferred_only" && preferences.preferredStationBrands.length === 0) {
      onSetPreferredBrands(commonBrands);
    }
    onSetMode(mode);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Stations & brands</Text>
      <Text style={styles.title}>Choose what appears on the map</Text>
      <Text style={styles.muted}>
        Filter Nearby and Plan to the station brands you are willing to use.
      </Text>

      <View style={styles.segmented}>
        <ModeButton
          active={preferences.stationBrandMode === "all"}
          label="All brands"
          onPress={() => setMode("all")}
        />
        <ModeButton
          active={preferences.stationBrandMode === "preferred_only"}
          label="Preferred only"
          onPress={() => setMode("preferred_only")}
        />
      </View>

      {preferences.preferredStationBrands.length ? (
        <View style={styles.selectedWrap}>
          {preferences.preferredStationBrands.map((brand) => (
            <Pressable
              accessibilityLabel={`Remove ${brand} from preferred station brands`}
              accessibilityRole="button"
              key={brand}
              onPress={() => onToggleBrand(brand)}
              style={styles.selectedChip}
            >
              <BrandLogo brand={optionsByLabel.get(brand)} size={22} />
              <Text style={styles.selectedChipText}>{brand}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>No preferred brands selected.</Text>
      )}

      <TextInput
        accessibilityLabel="Search station brands"
        onChangeText={setQuery}
        placeholder="Search brands"
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        value={query}
      />

      <View style={styles.actionRow}>
        <Pressable
          accessibilityLabel="Select common station brands"
          accessibilityRole="button"
          onPress={() => onSetPreferredBrands(commonBrands)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Common</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Clear preferred station brands"
          accessibilityRole="button"
          onPress={() => onSetPreferredBrands([])}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Clear</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Show all station brands"
          accessibilityRole="button"
          onPress={() => onSetMode("all")}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Show all</Text>
        </Pressable>
      </View>

      <View style={styles.brandList}>
        {filteredOptions.map((brand) => {
          const active = selected.has(brand.label);
          return (
            <Pressable
              accessibilityLabel={`${active ? "Remove" : "Add"} ${brand.label} preferred station brand`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              key={brand.label}
              onPress={() => onToggleBrand(brand.label)}
              style={[styles.brandRow, active && styles.brandRowActive]}
            >
              <BrandLogo brand={brand} size={36} />
              <Text style={styles.brandLabel}>{brand.label}</Text>
              <Text style={[styles.brandState, active && styles.brandStateActive]}>
                {active ? "On" : "Off"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BrandLogo({
  brand,
  size,
}: {
  brand?: {
    color: string;
    icon?: ImageProps["source"];
    initials: string;
  };
  size: number;
}) {
  const fallback = brand || { color: colors.blue, initials: "F" };
  return (
    <View
      style={[
        styles.brandLogo,
        {
          backgroundColor: fallback.icon ? colors.white : fallback.color,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      {fallback.icon ? (
        <Image cachePolicy="memory-disk" contentFit="contain" source={fallback.icon} style={styles.brandLogoImage} />
      ) : (
        <Text style={[styles.brandInitialsText, { fontSize: Math.max(9, size * 0.34) }]}>
          {fallback.initials}
        </Text>
      )}
    </View>
  );
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}
    >
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  brandLogo: {
    alignItems: "center",
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  brandLogoImage: {
    height: "100%",
    width: "100%",
  },
  brandInitialsText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  brandLabel: {
    ...typography.bodyStrong,
    flex: 1,
    minWidth: 0,
  },
  brandList: {
    gap: spacing.xs,
  },
  brandRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    padding: spacing.sm,
  },
  brandRowActive: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  brandState: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  brandStateActive: {
    color: colors.green,
  },
  card: {
    ...surfaces.floating,
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    textTransform: "uppercase",
  },
  modeButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  modeButtonActive: {
    backgroundColor: colors.ink,
  },
  modeButtonText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  muted: {
    color: colors.muted,
    fontSize: typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
  searchInput: {
    ...surfaces.field,
    borderRadius: radii.lg,
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: "500",
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButton: {
    ...surfaces.secondaryAction,
    borderRadius: radii.pill,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  segmented: {
    backgroundColor: colors.panel,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    padding: 3,
  },
  selectedChip: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  selectedChipText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  selectedWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
  },
});
