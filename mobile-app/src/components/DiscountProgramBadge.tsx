import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { discountProgramStyleFor } from "../data/discountProgramAssets";
import { colors } from "../theme";
import { DiscountRule } from "../types";

export function DiscountProgramBadge({ program, size = 28 }: { program: DiscountRule; size?: number }) {
  const style = discountProgramStyleFor(program);
  return (
    <View
      renderToHardwareTextureAndroid
      style={[
        styles.badge,
        {
          backgroundColor: style.icon ? colors.white : style.color,
          borderRadius: size / 2,
          height: size,
          width: size,
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
