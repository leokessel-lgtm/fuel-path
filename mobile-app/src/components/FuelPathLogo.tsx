import { StyleSheet, View } from "react-native";

import { colors } from "../theme";

export function FuelPathLogo({ size = 42 }: { size?: number }) {
  const scale = size / 42;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          height: size,
          width: size,
        },
      ]}
    >
      <View
        style={[
          styles.pin,
          {
            borderRadius: 18 * scale,
            borderBottomLeftRadius: 5 * scale,
            height: 36 * scale,
            left: 3 * scale,
            top: 1 * scale,
            width: 36 * scale,
          },
        ]}
      >
        <View
          style={[
            styles.pinCentre,
            {
              borderRadius: 9 * scale,
              height: 18 * scale,
              left: 9 * scale,
              top: 9 * scale,
              width: 18 * scale,
            },
          ]}
        >
          <View
            style={[
              styles.pinDot,
              {
                borderRadius: 3 * scale,
                height: 6 * scale,
                left: 6 * scale,
                top: 6 * scale,
                width: 6 * scale,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: "relative",
  },
  pin: {
    backgroundColor: colors.green,
    position: "absolute",
    transform: [{ rotate: "-45deg" }],
  },
  pinCentre: {
    backgroundColor: colors.white,
    position: "absolute",
  },
  pinDot: {
    backgroundColor: colors.route,
    position: "absolute",
  },
});
