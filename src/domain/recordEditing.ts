export const FAMILY_TIME_ZONE = "Asia/Qyzylorda";
const day = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: FAMILY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

// UI hint only. PostgreSQL independently enforces the cutoff using its clock.
export function canEditRecord(
  createdAt: string,
  authorId: string,
  userId?: string,
  now = new Date(),
): boolean {
  const created = new Date(createdAt);
  return (
    authorId === userId &&
    Number.isFinite(created.getTime()) &&
    day(created) === day(now)
  );
}

export const editWindowHint =
  "Изменять можно только свои записи в день создания, до 00:00 по времени Кызылорды (UTC+5).";
export function recordEditError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  if (message.includes("EDIT_WINDOW_CLOSED"))
    return "День создания записи закончился. Теперь её можно только читать или слушать.";
  if (message.includes("RECORD_CHANGED"))
    return "Запись уже изменена на другом устройстве. Откройте её заново перед редактированием.";
  if (message.includes("EDIT_ACCESS_DENIED"))
    return "Можно изменять только свои записи.";
  return "Не удалось сохранить изменения. Они остаются на этом экране — попробуйте ещё раз.";
}
