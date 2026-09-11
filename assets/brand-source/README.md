# Визуальный набор «Папа & Я»

Эта папка хранит исходные изображения, утверждённые для дальнейшего развития приложения. Файлы `assets/generated/*` создаются автоматически скриптом `scripts/generate-brand-assets.mjs` и поэтому не должны редактироваться вручную.

## Основные изображения

- `ChatGPT Image 12 сент. 2026 г., 00_25_42.png` — основная иконка приложения.
- `ChatGPT Image 12 сент. 2026 г., 00_24_04 (4).png` — вертикальная заставка / splash «Папа & Я».
- `ChatGPT Image 12 сент. 2026 г., 00_24_05 (5).png` — широкая семейная hero-иллюстрация для главных экранов.

## Навигация и разделы

- `ChatGPT Image 12 сент. 2026 г., 00_24_06 (7).png` — набор: Главная, Путь/Развитие, Книга, Вместе, Мы.
- `ChatGPT Image 12 сент. 2026 г., 00_25_22.png` — направления развития: Школа, Футбол, Шахматы, English, Лидерство.
- `ChatGPT Image 12 сент. 2026 г., 00_24_41.png` — календарь, голосовые истории, договорённости, путь/цель, признания/награды.
- `ChatGPT Image 12 сент. 2026 г., 00_24_06 (6).png` — дополнительный набор тематических иконок; резерв для карточек и пустых состояний.

## Достижения и декор

- `ChatGPT Image 12 сент. 2026 г., 00_24_54.png` — гербы многолетней системы достижений.
- `ChatGPT Image 12 сент. 2026 г., 00_25_06.png` — декоративные элементы: солнце, облака, звёзды, дорога, горы, растения и фоновые карточки.

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
- `badge-school.png`
- `badge-football.png`
- `badge-chess.png`
- `badge-english.png`
- `badge-adventure.png`
- `badge-team.png`
- `badge-courage.png`
- `badge-planner.png`
- `decor-atlas.png`

## Preview APK

Ветка `big-update-shared-plans` имеет отдельную GitHub Actions-сборку `Preview Brand Branch`. При каждом новом push она заново генерирует графику, выполняет TypeScript/Expo-проверки и собирает ARM64 preview APK как временный artifact.

Цветовая база проекта: тёмно-синий, золотой/тёплый оранжевый, кремовый и природный зелёный. Визуальные решения должны оставаться семейными, тёплыми и достаточно взрослыми для долгосрочного использования ребёнком в возрасте 11–18 лет.
