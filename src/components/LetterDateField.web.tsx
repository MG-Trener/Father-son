import { Text, View } from 'react-native';
import { formatCalendarDate } from '../domain/calendarDate';
import { ui } from './Everyday';
import type { LetterDateFieldProps } from './LetterDateField.types';

export default function LetterDateField({ value, minimumDay, onChange, disabled }: LetterDateFieldProps) {
  return <View style={ui.stack}>
    <Text style={ui.rowTitle}>{formatCalendarDate(value)}</Text>
    <label style={{ color: '#52656C', fontSize: 15, fontFamily: 'system-ui, sans-serif' }}>Выбрать в календаре
      <input aria-label="Дата открытия письма" type="date" lang="ru" value={value} min={minimumDay} disabled={disabled} onChange={event => onChange(event.target.value)} style={{ display: 'block', boxSizing: 'border-box', width: '100%', minHeight: 52, marginTop: 8, padding: 12, borderRadius: 14, border: '1px solid #CAD7CD', color: '#17333C', background: 'white', font: 'inherit' }} />
    </label>
  </View>;
}
