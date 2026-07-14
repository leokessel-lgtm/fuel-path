import { Image, StyleSheet, Text, View } from "react-native";

import { brandStyleForStation } from "../data/brandAssets";
import { colors } from "../theme";
import { Station } from "../types";

export function BrandBadge({
  station,
  size = 34,
  marker = false,
}: {
  station: Station;
  size?: number;
  marker?: boolean;
}) {
  const style = brandStyleForStation(station);
  const source = marker ? style.markerIcon || style.icon : style.icon;
  const imageSize = Math.max(12, size - 4);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: source ? colors.white : style.color,
          height: size,
          width: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {source ? (
        <Image
          resizeMode="contain"
          source={source}
          style={[styles.image, { height: imageSize, width: imageSize }]}
        />
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
    flexShrink: 0,
  },
  initials: {
    color: colors.white,
    fontWeight: "900",
  },
});
