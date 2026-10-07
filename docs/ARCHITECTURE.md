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

Уже выделены:

- `familyRepository.ts` — membership, family/member snapshot, создание команды, invite и join-by-code;
- `meetingRepository.ts` — встречи, идеи, реакции, create/complete/cancel операции;
- `growthRepository.ts` — пути развития, шаги, миссии, журнал роста, progress и достижения;
- `familyCultureRepository.ts` — договорённости и семейные ритуалы;
- `memoryArchiveRepository.ts` — голосовые истории, private Storage, Future Letters;
- `reflectionRepository.ts` — сохранение текстовых размышлений через RPC.

На repositories уже переведены, в частности:

- список/создание/чтение Future Letters;
- голосовой архив и создание голосовой истории;
- договорённости;
- ритуалы;
- новая миссия;
- новая запись развития;
- текстовое размышление.

Следующие кандидаты для переноса:
- агрегаты `DevelopmentV2`;
- yearbook/history summaries;
- connection signals / together flow;
- оставшиеся onboarding/team-setup вызовы UI → familyRepository.

### 4. Domain layer

`src/domain/` содержит чистые правила, которые не требуют React Native или Supabase и поэтому проверяются обычным `node:test`.

Сейчас туда вынесены:
- правила доступа и открытия Future Letters;
- периодичность и дедупликация Rituals.

Новые вычислимые правила следует по возможности сначала оформлять здесь, а не прятать внутри JSX.

### 5. Supabase client + types

- `src/lib/supabase.ts` — единственная конфигурация Supabase client;
- `src/types/database.generated.ts` — снимок типов production-схемы;
- `src/types/database.ts` — узкие app-facing overrides там, где PostgreSQL допускает `DEFAULT NULL`, а генератор описывает аргумент только как optional, а также кратковременные additions для только что развёрнутых backwards-compatible RPC.

После изменения схемы типы должны генерироваться заново из актуальной базы.

### 6. Database business rules

`supabase/migrations/`, `supabase/baseline/`, PostgreSQL RLS/RPC.

В базе должны оставаться правила, которые нельзя доверять мобильному клиенту:
- принадлежность к семье;
- создание/вступление в семейную команду;
- лимит состава семьи;
- назначение и завершение миссий;
- награды;
- атомарные операции «основная запись + activity event»;
- доступ к голосовым файлам;
- неизменяемость identity/ownership полей;
- идемпотентность операций, которые могут прийти с двух устройств одновременно.

Пример: `record_ritual_moment()` атомарно создаёт ritual moment и activity event и не допускает второй момент для того же ритуала в тот же день.

Для привилегированных операций предпочтителен public wrapper + private implementation с явными EXECUTE grants.

## Данные и безопасность

### RLS

Все application tables в exposed schema должны иметь RLS. `TO authenticated` само по себе не является авторизацией: policy обязана проверять ownership/family membership.

### RPC-only write boundaries

Таблица становится RPC-only, когда прямой write позволяет обойти бизнес-правило. Сейчас это применяется, в частности, к family membership, missions/awards, reflections insert и push devices.

При миграции существующего APK на новую RPC-границу старые direct privileges могут временно сохраняться ради backward compatibility. Их следует отзывать только после обновления установленных клиентов.

### Realtime

Realtime используется как сигнал «данные изменились», а не как второй источник истины. После события клиент перечитывает нужный domain snapshot из базы.

### Storage

`voice-stories` остаётся private bucket. Доступ проверяется storage policies, а metadata регистрируется только после проверки существования фактического объекта.

## Проверки без платной ветки

Текущий zero-cost процесс описан в `docs/FREE_VERIFICATION.md` и включает:
- migration history parity Git ↔ production;
- baseline manifest;
- read-only SQL invariants;
- Security Advisor;
- чистые Node/TypeScript tests;
- production schema/RPC introspection.

Полный clean-room restore остаётся финальной проверкой перед публичным масштабированием, но не является обязательным платным шагом на текущем этапе.

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
