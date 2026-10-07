import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable, Text, View } from 'react-native';
import { formatCalendarDate, parseIsoDay, toIsoDay } from '../domain/calendarDate';
import { ui } from './Everyday';
import type { LetterDateFieldProps } from './LetterDateField.types';

export default function LetterDateField({ value, minimumDay, onChange, disabled }: LetterDateFieldProps) {
  const [open, setOpen] = useState(false);
  return <View style={ui.stack}>
    <Pressable accessibilityRole="button" disabled={disabled} style={ui.input} onPress={() => setOpen(!open)}><Text style={ui.rowTitle}>{formatCalendarDate(value)}</Text><Text style={ui.link}>Выбрать в календаре</Text></Pressable>
    {open ? <DateTimePicker value={parseIsoDay(value) ?? parseIsoDay(minimumDay)!} minimumDate={parseIsoDay(minimumDay)!} mode="date" display="inline" onValueChange={(_event, date) => { onChange(toIsoDay(date)); setOpen(false); }} /> : null}
  </View>;
}
