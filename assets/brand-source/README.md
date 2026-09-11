# Визуальный набор «Папа & Я»

Эта папка хранит исходные изображения, утверждённые для дальнейшего развития приложения. Файлы `assets/generated/*` создаются автоматически скриптом `scripts/generate-brand-assets.mjs` и поэтому не должны редактироваться вручную.

## Основные изображения

- `app-icon.png` — основная иконка приложения.
- `splash.png` — вертикальная заставка / splash «Папа & Я».
- `family-hero.png` — широкая семейная hero-иллюстрация для главных экранов.

## Навигация и разделы

- `navigation-icons.png` — набор: Главная, Путь/Развитие, Книга, Вместе, Мы.
- `growth-directions.png` — направления развития: Школа, Футбол, Шахматы, English, Лидерство.
- `utility-icons.png` — календарь, голосовые истории, договорённости, путь/цель, признания/награды.
- `feature-icons.png` — дополнительный набор тематических иконок; резерв для карточек и пустых состояний.

## Достижения и декор

- `achievement-badges.png` — гербы многолетней системы достижений.
- `decor-atlas.png` — декоративные элементы: солнце, облака, звёзды, дорога, горы, растения и фоновые карточки.
- `brand-atlas.webp` — облегчённый обзор визуального набора.

## Автоматически генерируемые файлы

После `npm install` скрипт создаёт в `assets/generated/`:

- `app-icon.png`
- `app-icon-monochrome.png`
- `splash-screen.png`
- `family-hero.png`
- `direction-school.png`
- `direction-football.png`
- `direction-chess.png`
- `direction-english.png`
- `direction-leadership.png`
- `nav-home.png`
- `nav-growth.png`
- `nav-book.png`
- `nav-together.png`
- `nav-us.png`
- `utility-calendar.png`
- `utility-voice.png`
- `utility-agreement.png`
- `utility-goal.png`
- `utility-recognition.png`
- `badge-school.png`
- `badge-football.png`
- `badge-chess.png`
- `badge-english.png`
- `badge-adventure.png`
- `badge-team.png`
- `badge-courage.png`
- `badge-planner.png`
- `decor-atlas.png`

## Правило именования

Исходники теперь имеют короткие стабильные английские имена без пробелов, дат и локализованных символов. Это упрощает Expo/Android-сборку, ссылки `require(...)`, CI и дальнейшую замену отдельных картинок.

## Preview APK

Ветка `big-update-shared-plans` имеет отдельную GitHub Actions-сборку `Preview Brand Branch`. При каждом новом push она заново генерирует графику, выполняет TypeScript/Expo-проверки и собирает ARM64 preview APK как временный artifact.

Цветовая база проекта: тёмно-синий, золотой/тёплый оранжевый, кремовый и природный зелёный. Визуальные решения должны оставаться семейными, тёплыми и достаточно взрослыми для долгосрочного использования ребёнком в возрасте 11–18 лет.
