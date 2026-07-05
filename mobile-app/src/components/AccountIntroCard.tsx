import { StyleSheet, Text, View } from "react-native";

import { spacing } from "../theme";

export function AccountIntroCard({ firstRun }: { firstRun: boolean }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{firstRun ? "Quick setup" : "Account"}</Text>
      <Text style={styles.title}>{firstRun ? "Set the basics first" : "Tune your real price"}</Text>
      <Text style={styles.text}>
        {firstRun
          ? "Start with vehicle energy type and fuel grade. Discounts, saved places and route alerts can wait until the first route makes sense."
          : "Your account settings control fuel grade, discount eligibility, saved commutes and alert behaviour across Plan and Nearby."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#15231d",
    borderRadius: 28,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  eyebrow: {
    color: "#bfe8cd",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  text: {
    color: "#d8e5dd",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
  },
});
