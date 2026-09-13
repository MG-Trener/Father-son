# Архитектура «Папа & Я»

Этот документ фиксирует целевую структуру приложения после security-аудита сентября 2026 года. Главный принцип: экран отвечает за отображение и пользовательское действие, data-layer — за Supabase, а бизнес-правила, влияющие на безопасность и целостность, живут в PostgreSQL RPC/RLS.

## Слои

### 1. UI / routes

`src/app/` и `src/screens/`.

Задачи слоя:
- отображение состояния;
- ввод пользователя;
- навигация;
- локальные animation/loading/error states;
- вызов repository/service функций.

Не следует постепенно добавлять в экран:
- длинные Supabase query chains;
- ручную проверку членства в семье;
- несколько зависимых write-запросов, которые должны быть атомарными;
- копии типов таблиц, уже существующих в сгенерированной схеме.

Большие существующие экраны переводятся на эту модель постепенно, без массовой переписи.

### 2. Shared components

`src/components/`.

Сюда относятся переиспользуемые визуальные блоки: hero, loading scene, карточки, empty state, section header и т.п.

Графика берётся через `src/brandAssets.ts`. Новые экраны не должны создавать собственные каталоги `require('../../assets/generated/...')`, если ресурс уже есть в общем реестре.

### 3. Data layer

`src/data/`.

Repository-модули содержат чтение/запись данных конкретного домена и возвращают понятные приложению структуры.

Первый переведённый домен — семья:
- `getMembership()`;
- `getFamily()`;
- `getFamilyMembers()`;
- `getFamilySnapshot()`.

Следующие кандидаты для переноса:
- meetings / meeting ideas;
- growth / missions;
- yearbook;
- agreements / rituals;
- voice stories.

### 4. Supabase client + types

- `src/lib/supabase.ts` — единственная конфигурация Supabase client;
- `src/types/database.generated.ts` — снимок типов production-схемы;
- `src/types/database.ts` — узкие app-facing overrides там, где PostgreSQL допускает `DEFAULT NULL`, а генератор описывает аргумент только как optional.

После изменения схемы типы должны генерироваться заново из актуальной базы.

### 5. Database business rules

`supabase/migrations/`, `supabase/baseline/`, PostgreSQL RLS/RPC.

В базе должны оставаться правила, которые нельзя доверять мобильному клиенту:
- принадлежность к семье;
- создание/вступление в семейную команду;
- лимит состава семьи;
- назначение и завершение миссий;
- награды;
- атомарные операции «основная запись + activity event»;
- доступ к голосовым файлам;
- неизменяемость identity/ownership полей.

Для привилегированных операций предпочтителен public wrapper + private implementation с явными EXECUTE grants.

## Данные и безопасность

### RLS

Все application tables в exposed schema должны иметь RLS. `TO authenticated` само по себе не является авторизацией: policy обязана проверять ownership/family membership.

### RPC-only write boundaries

Таблица становится RPC-only, когда прямой write позволяет обойти бизнес-правило. Сейчас это применяется, в частности, к family membership, missions/awards, reflections insert и push devices.

### Realtime

Realtime используется как сигнал «данные изменились», а не как второй источник истины. После события клиент перечитывает нужный domain snapshot из базы.

### Storage

`voice-stories` остаётся private bucket. Доступ проверяется storage policies, а metadata регистрируется только после проверки существования фактического объекта.

## Android updates

Клиент принимает release только если metadata валидна. Перед запуском installer проверяются:
- доверенный GitHub Releases URL;
- ожидаемый размер;
- SHA-256 APK.

Metadata публикации должна совпадать с реально выпущенным APK.

## Визуальная система

Исходные атласы лежат в `assets/brand-source/`. Скрипт `scripts/generate-brand-assets.mjs` создаёт отдельные PNG в `assets/generated/`.

`src/brandAssets.ts` — единая карта этих ресурсов. Это позволяет менять визуальную систему централизованно и исключает ошибочное использование целого sprite sheet вместо конкретного изображения.

## Правило рефакторинга

Не переписывать крупный экран целиком только ради архитектурной чистоты. Для каждого домена:

1. зафиксировать типы;
2. вынести query/RPC в repository/service;
3. добавить чистые unit-тестируемые helpers;
4. перевести экран на новый API;
5. только затем дробить визуальные компоненты.

Такой порядок уменьшает риск регрессий и позволяет выпускать приложение между этапами рефакторинга.
