import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { brandStyleForStation } from "../data/brandAssets";
import { colors } from "../theme";
import { Station } from "../types";

export function BrandBadge({ station, size = 34 }: { station: Station; size?: number }) {
  const style = brandStyleForStation(station);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: style.icon ? colors.white : style.color,
          height: size,
          width: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {style.icon ? (
        <Image cachePolicy="memory-disk" contentFit="contain" source={style.icon} style={styles.image} />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.34) }]}>
          {style.initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    borderColor: colors.white,
    borderWidth: 2,
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  initials: {
    color: colors.white,
    fontWeight: "900",
  },
});
