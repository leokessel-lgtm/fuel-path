import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, surfaces, typeScale } from "../theme";
import { SelectedCluster } from "../hooks/useNearbyClusterSelection";

export function NearbyClusterContextCard({
  cluster,
}: {
  cluster: SelectedCluster;
}) {
  return (
    <View style={styles.clusterContextCard}>
      <Text style={styles.clusterContextTitle}>{cluster.count} stations in this area</Text>
      {Number.isFinite(cluster.minPrice) ? (
        <Text style={styles.clusterContextText}>
          Cheapest visible price {cluster.minPrice?.toFixed(1)} c/L. Showing this group in the list.
        </Text>
      ) : (
        <Text style={styles.clusterContextText}>Showing this group in the list.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clusterContextCard: {
    ...surfaces.floating,
    ...shadow.float,
    borderRadius: radii.lg,
    bottom: 348,
    left: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: "absolute",
    right: spacing.lg,
  },
  clusterContextText: {
    color: colors.muted,
    fontSize: typeScale.caption,
    marginTop: 2,
  },
  clusterContextTitle: {
    color: colors.black,
    fontSize: typeScale.body,
    fontWeight: "800",
  },
});
