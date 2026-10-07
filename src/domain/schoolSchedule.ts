import data from "./schoolScheduleData.json";
export type Lesson = [string, number, number, string, string];
export const schoolDays = data.days as {
  name: string;
  color: string;
  lessons: Lesson[];
}[];
export const periods = data.periods as unknown as Record<
  string,
  [string, string]
>;
const holidayRanges = [
  { start: "2026-10-26", resume: "2026-11-02", title: "Осенние каникулы" },
  { start: "2026-12-28", resume: "2027-01-11", title: "Зимние каникулы" },
  { start: "2027-03-22", resume: "2027-03-29", title: "Весенние каникулы" },
];
export function schoolNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri"].indexOf(parts.weekday ?? "");
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const holiday = holidayRanges.find((h) => key >= h.start && key < h.resume);
  const time = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const period =
    holiday || day < 0
      ? null
      : (Object.keys(periods)
          .map(Number)
          .find(
            (p) =>
              minute >= time(periods[p]![0]) && minute < time(periods[p]![1]),
          ) ?? null);
  const next =
    holiday || day < 0
      ? null
      : (schoolDays[day]!.lessons.flatMap((l) =>
          Array.from({ length: l[2] - l[1] + 1 }, (_, i) => ({
            number: l[1] + i,
            title: l[0],
            room: l[3],
          })),
        ).find((l) => time(periods[l.number]![0]) > minute) ?? null);
  return { day, minute, period, holiday, next };
}
