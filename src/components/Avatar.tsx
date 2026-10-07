import { useCallback, useState } from "react";
import { Image, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
export function Avatar({
  familyId,
  userId,
  name,
  size = 64,
  revision = 0,
}: {
  familyId?: string;
  userId?: string;
  name: string;
  size?: number;
  revision?: number;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setUri(null);
      if (supabase && familyId && userId)
        void supabase.storage
          .from("family-avatars")
          .createSignedUrl(`${familyId}/${userId}.jpg`, 3600)
          .then(({ data }) => {
            if (active) setUri(data?.signedUrl ?? null);
          });
      return () => {
        active = false;
      };
    }, [familyId, userId, revision]),
  );
  return uri ? (
    <Image
      accessibilityLabel={`Аватар: ${name}`}
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setUri(null)}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#DCEBE2",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ fontSize: size * 0.4, fontWeight: "700", color: "#17463D" }}
      >
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
