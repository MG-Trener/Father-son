# Папа & Я

Приватное Android-приложение для Михаила и Артура, которое помогает оставаться одной командой, даже когда они живут отдельно.

## Концепция

Приложение не является системой родительского контроля. Основные темы: общение, школа, футбол, шахматы, английский язык, лидерство, совместные миссии и многолетняя история достижений.

## Текущая версия

- Приложение: `0.4.1`
- Android `versionCode`: `15`
- Android package: `com.mgtrener.fatherson`

## Технологии

- Expo SDK 57 / React Native 0.86
- Expo Router
- TypeScript в строгом режиме
- Supabase Auth + PostgreSQL + Storage + Realtime + Edge Functions
- Expo Notifications для семейных push-уведомлений
- Expo Audio для голосовых историй
- GitHub Actions для проверки и выпуска Android APK

## Основные возможности

- Авторизация и семейная команда с ролями `parent` / `child`.
- Совместные сигналы, встречи, идеи встреч и реакции.
- Голосовые истории и семейная хроника.
- Развитие по направлениям: школа, футбол, шахматы, английский язык и лидерство.
- Миссии, достижения, признания, ритуалы и недельные фокусы.
- Письма в будущее и книга семейной истории.
- Realtime-обновления семейных данных.
- Push-уведомления через Supabase Edge Function.
- Встроенная проверка и установка Android APK-обновлений.

## Графика

Утверждённые исходные изображения находятся в `assets/brand-source/`.

Файлы `assets/generated/` создаются автоматически скриптом `scripts/generate-brand-assets.mjs` во время установки зависимостей и не коммитятся. Скрипт формирует самостоятельные PNG для навигации, направлений развития, достижений и служебных иконок, поэтому приложение использует отдельные изображения, а не единый атлас во время выполнения.

## Первый запуск разработчика

1. Установить Node.js 22.
2. Скопировать `.env.example` в `.env`.
3. Заполнить `EXPO_PUBLIC_SUPABASE_URL` и `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` проекта Supabase `father-son`.
4. Установить зависимости: `npm install`.
5. Запустить `npm run start`.
6. Проверить проект командами `npm test`, `npx expo-doctor` и `npm run typecheck`.

> Репозиторию всё ещё требуется настоящий `package-lock.json`. До его появления CI использует `npm install`; после фиксации lockfile следует перейти на `npm ci`.

## Android APK и обновления

Release-пайплайн:

1. Запускает unit tests, Expo Doctor и TypeScript.
2. Генерирует Android-проект через Expo Prebuild.
3. Собирает ARM64 release APK.
4. Проверяет постоянную release-подпись.
5. Вычисляет размер и SHA-256 APK.
6. Публикует APK в `MG-Trener/Father-son-releases`.
7. Публикует метаданные обновления в Supabase.

Клиент принимает только корректные release metadata, доверенный GitHub Releases URL либо совместимый приватный Storage-источник. Перед запуском Android installer скачанный APK обязательно проверяется по точному размеру и SHA-256. Повреждённый файл удаляется из cache и не устанавливается.

## Supabase

Рабочий проект использует Auth, PostgreSQL, Storage, Realtime и Edge Functions. Семейные данные защищены RLS и минимальными object/column grants, а критичные операции выполняются через проверяемые RPC.

- Production migrations хранятся в `supabase/migrations/`.
- Восстановленный bootstrap исходной схемы находится в `supabase/baseline/`.
- SQL regression checks находятся в `supabase/tests/`.
- `supabase/baseline/README.md` описывает порядок disaster recovery новой базы.

Baseline хранится отдельно от migrations намеренно: production уже содержит исходные объекты, поэтому bootstrap-файлы предназначены только для новой пустой базы.

## Безопасность

- В мобильный клиент не помещаются `service_role` и secret keys.
- Клиент использует только publishable key.
- Все прикладные public-таблицы защищаются Row Level Security.
- `anon` не имеет прямого доступа к семейным таблицам.
- Семья, миссии, награды, reflections и push devices используют ограниченные RPC/write boundaries.
- Identity/ownership-поля защищены от подмены клиентом.
- Voice Storage приватный и ограничен семейной принадлежностью/владельцем пути.
- APK проверяется по SHA-256 перед установкой.
- Клиентские Postgres-роли не имеют `TRUNCATE`, `REFERENCES` и `TRIGGER` на application tables.

## Состояние проекта

`0.4.1` — рабочая функциональная версия, а не дизайн-прототип. Основной текущий технический долг: зафиксировать npm lockfile, восстановить стабильную выдачу GitHub-hosted runner, выполнить полный clean-room restore на отдельной Supabase development branch и постепенно выносить бизнес-логику из самых крупных экранов в reusable feature/service слой.
