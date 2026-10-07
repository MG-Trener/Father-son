import { Pressable, Text, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";

/** A rendering failure should show a recovery screen, not expose internal error data. */
export function RecoverableError({ retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 28,
        gap: 20,
        backgroundColor: "#F4F7F2",
      }}
    >
      <Text style={{ fontSize: 26, color: "#173D3B", fontWeight: "700" }}>
        Не удалось открыть экран
      </Text>
      <Text style={{ fontSize: 17, lineHeight: 25, color: "#405957" }}>
        Попробуйте открыть его ещё раз. Если ошибка повторится, сообщите, какое
        действие вы выполняли.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{ borderRadius: 18, backgroundColor: "#235D50", padding: 18 }}
      >
        <Text style={{ color: "white", textAlign: "center", fontSize: 17 }}>
          Открыть снова
        </Text>
      </Pressable>
    </View>
  );
}
