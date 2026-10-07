import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ui } from "./Everyday";
const FeedbackContext = createContext<(message: string) => void>(() => {});
export const useFeedback = () => useContext(FeedbackContext);
export function FeedbackProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState("");
  const inset = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <FeedbackContext.Provider value={setMessage}>
      {children}
      {message ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: inset.top + 8,
            left: 16,
            right: 16,
            zIndex: 100,
          }}
        >
          <Pressable
            accessibilityRole="alert"
            onPress={() => setMessage("")}
            style={[
              ui.card,
              {
                backgroundColor: "#E6F1EB",
                borderColor: "#87B59B",
                padding: 14,
              },
            ]}
          >
            <Text style={ui.rowTitle}>✓ {message}</Text>
          </Pressable>
        </View>
      ) : null}
    </FeedbackContext.Provider>
  );
}
