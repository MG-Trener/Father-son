import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { canEditRecord } from "../domain/recordEditing";

export function useRecordEditing(userId?: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      update();
      const offset = 5 * 3600000;
      const now = Date.now();
      const next =
        (Math.floor((now + offset) / 86400000) + 1) * 86400000 - offset;
      timer = setTimeout(scheduleMidnight, next - now + 50);
    };
    scheduleMidnight();
    const listener = AppState.addEventListener("change", update);
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, []);
  return (created: string, author: string) =>
    canEditRecord(created, author, userId, now);
}
