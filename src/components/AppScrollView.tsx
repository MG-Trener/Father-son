import { useCallback, useRef } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";
import { useFocusEffect } from "expo-router";
import { useNavigationRevision } from "./AppNavigation";

/** Every navigation-button press starts at the beginning, including a repeated tab press. */
export function AppScrollView(props: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const revision = useNavigationRevision();
  useFocusEffect(
    useCallback(() => {
      if (!props.horizontal) ref.current?.scrollTo({ y: 0, animated: false });
    }, [revision, props.horizontal]),
  );
  return <ScrollView ref={ref} {...props} />;
}
