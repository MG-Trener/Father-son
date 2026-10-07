import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";

/** Reconnect refresh and bounded polling cover a dropped realtime connection. */
export function useLiveFamily(
  table: string,
  familyId: string | undefined,
  load: () => Promise<void>,
) {
  useFocusEffect(
    useCallback(() => {
      void load();
      if (!supabase || !familyId) return;
      const client = supabase;
      const channel = client
        .channel(`${table}-${familyId}-${Math.random()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `family_id=eq.${familyId}`,
          },
          () => void load(),
        )
        .subscribe();
      const interval = setInterval(() => {
        if (AppState.currentState === "active") void load();
      }, 15000);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      return () => {
        clearInterval(interval);
        listener.remove();
        void client.removeChannel(channel);
      };
    }, [familyId, table, load]),
  );
}
