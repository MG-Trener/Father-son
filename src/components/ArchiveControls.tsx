import { Text, View } from "react-native";
import { Button, Chip, ui } from "./Everyday";
import { useFamily } from "../context/FamilyContext";
export function monthBounds(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return {
    from: start.toISOString(),
    until: end.toISOString(),
    label: start.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    }),
  };
}
export function ArchiveControls({
  month,
  setMonth,
  author,
  setAuthor,
}: {
  month: number;
  setMonth: (n: number) => void;
  author: string | null;
  setAuthor: (s: string | null) => void;
}) {
  const { members } = useFamily();
  return (
    <View style={{ gap: 12 }}>
      <View style={ui.between}>
        <Button label="‹ Месяц" secondary onPress={() => setMonth(month - 1)} />
        <Text style={[ui.caption, { flex: 1, textAlign: "center" }]}>
          {monthBounds(month).label}
        </Text>
        <Button
          label="Месяц ›"
          secondary
          disabled={month >= 0}
          onPress={() => setMonth(month + 1)}
        />
      </View>
      <View style={ui.wrap}>
        <Chip label="Оба" selected={!author} onPress={() => setAuthor(null)} />
        {members.map((m) => (
          <Chip
            key={m.user_id}
            label={m.display_name}
            selected={author === m.user_id}
            onPress={() => setAuthor(m.user_id)}
          />
        ))}
      </View>
    </View>
  );
}
export function ArchivePages({
  page,
  hasMore,
  busy,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  busy: boolean;
  onPage: (n: number) => void;
}) {
  return (
    <View style={ui.between}>
      <Button
        label="← Назад"
        secondary
        disabled={page === 0 || busy}
        onPress={() => onPage(page - 1)}
      />
      <Text style={ui.caption}>{page + 1}</Text>
      <Button
        label="Далее →"
        secondary
        disabled={!hasMore || busy}
        onPress={() => onPage(page + 1)}
      />
    </View>
  );
}
