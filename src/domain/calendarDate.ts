export const toIsoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const parseIsoDay = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

export const formatCalendarDate = (value: string) => parseIsoDay(value)?.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) ?? 'Выбрать дату';

// Clamp Jan 31 + one month to February's last day instead of silently moving into March.
export const addCalendarMonths = (date: Date, months: number) => {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
};
