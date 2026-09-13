export type RitualCadence = 'weekly' | 'monthly' | 'flexible';

export const normalizeRitualCadenceValue = (
  cadence: RitualCadence,
  value: number | null | undefined,
): number | null => {
  if (cadence === 'flexible') return null;
  if (!Number.isInteger(value)) return null;
  if (cadence === 'weekly') return value! >= 0 && value! <= 6 ? value! : null;
  return value! >= 1 && value! <= 31 ? value! : null;
};

export const ritualAlreadyMarkedOn = (
  moments: Array<{ ritual_id: string; happened_on: string }>,
  ritualId: string,
  day: string,
): boolean => moments.some((moment) => moment.ritual_id === ritualId && moment.happened_on === day);

export const ritualCadenceLabel = (
  cadence: RitualCadence,
  cadenceValue: number | null,
  weekDays: readonly string[] = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
): string => {
  if (cadence === 'weekly' && cadenceValue !== null && cadenceValue >= 0 && cadenceValue <= 6) {
    return `каждую неделю · ${weekDays[cadenceValue] ?? cadenceValue}`;
  }
  if (cadence === 'monthly' && cadenceValue !== null && cadenceValue >= 1 && cadenceValue <= 31) {
    return `каждый месяц · ${cadenceValue} число`;
  }
  return 'когда хочется';
};
