import { useAuth } from "../context/AuthContext";
import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import {
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePathname, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { brandAssets } from "../brandAssets";
import { useFamily } from "../context/FamilyContext";
import { isSupabaseConfigured } from "../lib/supabase";
import { colors } from "../theme";

const NavigationRevision = createContext(0);
export const useNavigationRevision = () => useContext(NavigationRevision);
const items = [
  {
    title: "Сегодня",
    href: "/(tabs)",
    image: brandAssets.navigation.home,
    matches: ["/", "/today"],
  },
  {
    title: "Вместе",
    href: "/(tabs)/together",
    image: brandAssets.navigation.together,
    matches: [
      "/together",
      "/chat",
      "/meeting-plan",
      "/rituals",
      "/agreements",
      "/recognitions",
      "/conversation-cards",
      "/month-together",
    ],
  },
  {
    title: "Развитие",
    href: "/(tabs)/development",
    image: brandAssets.navigation.growth,
    matches: [
      "/development",
      "/chess",
      "/school-schedule",
      "/growth-journal",
      "/growth-entry-new",
      "/weekly-focus",
      "/mission-new",
      "/week-review",
      "/achievements",
      "/path-map",
    ],
  },
  {
    title: "Память",
    href: "/(tabs)/yearbook",
    image: brandAssets.navigation.book,
    matches: [
      "/yearbook",
      "/memories",
      "/reflection-new",
      "/voice-stories",
      "/voice-story-new",
      "/year-review",
      "/history",
      "/letters",
      "/future-letter-new",
      "/future-letter-view",
    ],
  },
  {
    title: "Настройки",
    href: "/settings",
    image: null,
    matches: ["/settings", "/notifications"],
  },
] as const;

export function AppNavigation({ children }: PropsWithChildren) {
  const path = usePathname();
  const { session } = useAuth();
  const { family, me } = useFamily();
  const [revision, setRevision] = useState(0);
  const entry =
    ["/sign-in", "/team-setup", "/auth-callback"].includes(path) ||
    (path === "/onboarding" && !me?.onboarding_completed_at);
  const visible =
    !entry &&
    (!isSupabaseConfigured || Boolean(family && me?.onboarding_completed_at));
  return (
    <NavigationRevision.Provider value={revision}>
      <SafeAreaView style={styles.root} edges={["bottom", "left", "right"]}>
        <View key={session?.user.id ?? "signed-out"} style={styles.body}>
          {children}
        </View>
        {visible ? (
          <View style={styles.bar} accessibilityRole="tablist">
            {items.map((item) => {
              const active = (item.matches as readonly string[]).includes(path);
              return (
                <Pressable
                  key={item.title}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={item.title}
                  style={styles.tab}
                  onPress={() => {
                    Keyboard.dismiss();
                    setRevision((value) => value + 1);
                    router.dismissTo(item.href as Href);
                  }}
                >
                  <View style={[styles.icon, active && styles.active]}>
                    {item.image ? (
                      <Image source={item.image} style={styles.image} />
                    ) : (
                      <Text style={styles.gear}>⚙</Text>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.label, active && styles.selected]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </SafeAreaView>
    </NavigationRevision.Provider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  body: { flex: 1 },
  bar: {
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderColor: "#DDE5DF",
    backgroundColor: "#FFFFFF",
  },
  tab: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  icon: {
    width: 48,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  active: { backgroundColor: "#E2EEE6" },
  image: { width: 27, height: 27, resizeMode: "contain" },
  gear: { color: colors.navyDeep, fontSize: 27, lineHeight: 30 },
  label: { fontSize: 11, color: "#596C72" },
  selected: { color: colors.navyDeep, fontWeight: "700" },
});
