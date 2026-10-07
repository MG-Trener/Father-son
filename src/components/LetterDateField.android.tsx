import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, Text, View } from 'react-native';
import { formatCalendarDate, parseIsoDay, toIsoDay } from '../domain/calendarDate';
import { ui } from './Everyday';
import type { LetterDateFieldProps } from './LetterDateField.types';

export default function LetterDateField({ value, minimumDay, onChange, disabled }: LetterDateFieldProps) {
  const openCalendar = () => {
    const minimumDate = parseIsoDay(minimumDay)!;
    const selected = parseIsoDay(value);
    DateTimePickerAndroid.open({
      value: selected && selected >= minimumDate ? selected : minimumDate,
      minimumDate,
      mode: 'date',
      display: 'calendar',
      firstDayOfWeek: 1,
      positiveButton: { label: 'Выбрать' },
      negativeButton: { label: 'Отмена' },
      onValueChange: (_event, date) => onChange(toIsoDay(date)),
    });
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={`Дата открытия: ${formatCalendarDate(value)}. Выбрать в календаре`} disabled={disabled} onPress={openCalendar} style={[ui.input, disabled && ui.disabled]}>
    <View style={ui.stack}><Text style={ui.rowTitle}>{formatCalendarDate(value)}</Text><Text style={ui.link}>Выбрать в календаре</Text></View>
  </Pressable>;
}
