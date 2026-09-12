# Визуальный набор «Папа & Я»

Эта папка хранит утверждённые исходные изображения для дальнейшего развития приложения. Файлы `assets/generated/*` создаются автоматически скриптом `scripts/generate-brand-assets.mjs` и не должны редактироваться вручную.

## Основные изображения

- `app-icon.png` — основная иконка приложения.
- `splash.png` — вертикальная заставка / splash «Папа & Я».
- `family-hero.png` — широкая семейная hero-иллюстрация для главных экранов.

## Отдельные гербы

Гербы больше не режутся из общего листа во время сборки. Каждый герб хранится отдельным PNG и может заменяться независимо:

- `badge-school.png`
- `badge-football.png`
- `badge-chess.png`
- `badge-english.png`
- `badge-adventure.png`
- `badge-team.png`
- `badge-courage.png`
- `badge-planner.png`

`achievement-badges.png` оставлен только как исходный обзорный лист и не используется генератором приложения.

## Отдельный декор

Декоративный атлас также разобран на отдельные mobile-ready PNG. Источником состава является `manifest.json`. В приложении элементы доступны через `src/lib/decorAssets.ts`.

Примеры:

- `decor-sun.png`, `decor-moon.png`
- `decor-star-large.png`, `decor-shooting-star.png`
- `decor-heart-ribbon.png`, `decor-heart-navy.png`
- `decor-road-bushes.png`, `decor-road-plants.png`
- `decor-mountains.png`, `decor-village.png`
- `decor-flowers.png`, `decor-birds.png`, `decor-flying-leaves.png`
- `card-cloud-hills.png`, `card-night-stars.png`, `card-warm-abstract.png`

`decor-atlas.png` теперь служит только исходным обзорным листом и не используется при генерации отдельных элементов.

## Наборы, которые пока остаются атласами

Следующие исходники ещё содержат несколько элементов и пока автоматически разделяются скриптом сборки:

- `navigation-icons.png` — Главная, Путь/Развитие, Книга, Вместе, Мы.
- `growth-directions.png` — Школа, Футбол, Шахматы, English, Лидерство.
- `utility-icons.png` — календарь, голос, договорённости, путь/цель, признания.
- `feature-icons.png` — дом, общий путь, книга, Вместе, папа и ребёнок.

По мере появления отдельных PNG эти четыре атласа нужно переводить на ту же схему, что уже используется для гербов и декора.

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
- `utility-agreements.png`
- `utility-goal.png`
- `utility-recognition.png`
- `feature-home.png`
- `feature-path.png`
- `feature-book.png`
- `feature-together.png`
- `feature-family.png`
- восемь `badge-*.png`
- все элементы `decor-*.png` и `card-*.png`, перечисленные в `manifest.json`
- `decor-manifest.json`

## Использование в интерфейсе

Семантическая иконка и декоративный элемент — разные вещи. Герб или utility-иконка обозначает функцию, а `decor-*` используется как мягкий визуальный акцент. Компонент `ToolHub` поддерживает отдельное поле `decor`, поэтому карточки могут использовать собственный PNG-фон, не подменяя смысловую иконку.

Для новых экранов предпочтительно использовать готовые отдельные файлы через `assets/generated/` или `src/lib/decorAssets.ts`, а не обращаться к целому атласу.

## Правило именования

Исходники имеют короткие стабильные английские имена без пробелов, дат и локализованных символов. Это упрощает Expo/Android-сборку, `require(...)`, CI и дальнейшую замену отдельных картинок.

## Preview APK

Рабочая ветка `post-0.4.1-polish` имеет отдельную GitHub Actions-сборку `Preview Feature Branch`. При push она должна генерировать графику, выполнять TypeScript/Expo-проверки и собирать ARM64 preview APK как временный artifact.

Цветовая база проекта: тёмно-синий, золотой/тёплый оранжевый, кремовый и природный зелёный. Визуальные решения должны оставаться семейными, тёплыми и достаточно взрослыми для долгосрочного использования ребёнком в возрасте 11–18 лет.
