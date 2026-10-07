import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  ActionRow,
  Card,
  Chip,
  Heading,
  Page,
  ui,
} from "../components/Everyday";
import { periods, schoolDays, schoolNow } from "../domain/schoolSchedule";

export default function SchoolSchedule() {
  const [now, setNow] = useState(() => schoolNow());
  const [day, setDay] = useState(() => Math.max(0, schoolNow().day));
  useEffect(() => {
    const timer = setInterval(() => setNow(schoolNow()), 30000);
    return () => clearInterval(timer);
  }, []);
  const selected = schoolDays[day]!;
  return (
    <Page>
      <Heading
        title="Школьное расписание"
        subtitle="Уроки, время и кабинеты · время Астаны"
        back
      />
      {now.holiday ? (
        <Card tone="warm">
          <Text style={ui.sectionTitle}>{now.holiday.title}</Text>
          <Text style={ui.body}>
            В школу —{" "}
            {new Date(`${now.holiday.resume}T12:00:00`).toLocaleDateString(
              "ru-RU",
              { day: "numeric", month: "long" },
            )}
            . Расписание можно посмотреть заранее.
          </Text>
        </Card>
      ) : now.day < 0 ? (
        <Card tone="mint">
          <Text style={ui.rowTitle}>Сегодня выходной</Text>
          <Text style={ui.body}>
            Отдыхай. Здесь можно подготовиться к новой неделе.
          </Text>
        </Card>
      ) : (
        <Card tone="mint">
          <Text style={ui.rowTitle}>
            {now.period &&
            schoolDays[now.day]!.lessons.some(
              (l) => now.period! >= l[1] && now.period! <= l[2],
            )
              ? "Сейчас идёт урок"
              : now.next
                ? now.minute < 14 * 60
                  ? "Уроки начнутся в 14:00"
                  : "Перемена"
                : "Занятия на сегодня закончились"}
          </Text>
          {now.next ? (
            <Text style={ui.body}>
              Далее: {now.next.title} · {periods[now.next.number]![0]} ·{" "}
              {now.next.room === "Спортзал"
                ? "Спортзал"
                : `каб. ${now.next.room}`}
            </Text>
          ) : null}
        </Card>
      )}
      <View style={ui.wrap}>
        {["Пн", "Вт", "Ср", "Чт", "Пт"].map((label, i) => (
          <Chip
            key={label}
            label={label}
            selected={day === i}
            onPress={() => setDay(i)}
          />
        ))}
      </View>
      <View style={ui.between}>
        <Text style={ui.sectionTitle}>{selected.name}</Text>
        <Text style={ui.caption}>
          до {periods[selected.lessons.at(-1)![2]]![1]}
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        {selected.lessons.map(([title, first, last, room], i) => {
          const active =
            day === now.day &&
            !now.holiday &&
            now.period !== null &&
            now.period >= first &&
            now.period <= last;
          return (
            <View
              key={i}
              style={[
                ui.card,
                {
                  padding: 14,
                  borderLeftWidth: 4,
                  borderLeftColor: active ? "#20836C" : "#A0BABE",
                  backgroundColor: active ? "#E5F3EB" : "white",
                },
              ]}
            >
              <View style={ui.between}>
                <Text style={ui.rowTitle}>
                  {periods[first]![0]} — {periods[last]![1]}
                </Text>
                <Text style={ui.caption}>
                  {active
                    ? "Сейчас"
                    : last > first
                      ? "2 урока"
                      : `${first - 8} урок`}
                </Text>
              </View>
              <Text style={ui.sectionTitle}>{title}</Text>
              <Text style={ui.body}>
                {room === "Спортзал" ? room : `Кабинет ${room}`}
              </Text>
              {last > first ? (
                <Text style={ui.caption}>
                  Перемена {periods[first]![1]} — {periods[last]![0]}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <ActionRow
        title="Мои занятия и цели"
        description="Записи об учёбе"
        to={{ pathname: "/growth-journal", params: { category: "school" } }}
      />
      <Text style={ui.caption}>Расписание Artur · учебный год 2026/27. </Text>
    </Page>
  );
}
