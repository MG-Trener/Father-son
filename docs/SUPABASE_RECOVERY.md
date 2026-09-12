# Supabase recovery plan

Проверено и обновлено 13 сентября 2026 года для проекта `father-son` (`kyptvbnnyqlmwkiobtvq`).

## Что было не так

Каталог `supabase/migrations/` начинался с `20260910153606_together_interactions_rpc`, хотя рабочая база уже содержала базовые таблицы и RPC. Исходный bootstrap схемы никогда не был сохранён в Git.

Из-за этого пустой Supabase-проект нельзя было гарантированно восстановить только последовательным применением migration chain.

## Что восстановлено

В `supabase/baseline/` теперь хранится восстановленный bootstrap-слой, который существовал до первой tracked migration:

- `001_core_schema.sql` — 17 исходных таблиц, ограничения и ключевые индексы;
- `002_core_security.sql` — RLS, права и policies;
- `003_core_rpcs.sql` — исходные RPC семьи/приглашения/миссий;
- `004_seed_catalog.sql` — 6 направлений, 44 skill-node и 17 achievement definitions;
- `README.md` — безопасная процедура восстановления.

Baseline намеренно находится **вне** `supabase/migrations`, поэтому он не может случайно примениться к существующему production как новая migration.

## Проверки

Добавлены два SQL-набора проверок:

- `supabase/tests/baseline_manifest.sql`
- `supabase/tests/security_invariants.sql`

Оба выполнены на production 13 сентября 2026 года.

Ожидаемые и полученные результаты:

```text
baseline_manifest_ok
security_invariants_ok
```

`baseline_manifest.sql` проверяет наличие базовых таблиц, RPC, ключевых уникальных индексов, каталога 6/44/17 и обязательных Realtime publications.

`security_invariants.sql` проверяет RLS, запрет `SECURITY DEFINER` в `public`, запрет `PUBLIC EXECUTE` для private-функций, корректную wrapper/private RPC-chain и минимальные права `anon`.

## Текущее состояние рабочей базы

На момент проверки проект активен и работает на PostgreSQL 17.6. В схемах `public` и `private` находится 31 прикладная таблица, RLS включён для всех проверенных application tables.

Поздние migration-файлы создают остальные функции и сущности: push, voice stories, growth journal, future letters, meeting reactions, rituals, weekly focuses, agreements, onboarding state, activity reads и app releases.

Production Edge Function `send-family-push` обновлена до version 3 и использует `verify_jwt=true`.

## Восстановление пустого проекта

На новой/пустой Supabase-базе сначала выполняются файлы `supabase/baseline/001..004`, затем обычная migration chain начиная с `20260910153606`.

После восстановления обязательно выполняются оба SQL test-файла.

Полные команды находятся в `supabase/baseline/README.md`.

## Что ещё нужно для полного закрытия P0

Остаётся один главный тест: **restore rehearsal на полностью чистой базе**.

Нужно создать disposable Supabase development branch или локальный Supabase stack и проверить последовательность:

1. core baseline `001..004`;
2. все tracked migrations;
3. `baseline_manifest.sql`;
4. `security_invariants.sql`;
5. TypeScript types generation;
6. smoke-test основных RPC и Edge Function.

Development branch в Supabase является тарифицируемой операцией и требует явного подтверждения стоимости владельцем проекта, поэтому автоматически он не создавался.

## Дополнительный schema dump

Восстановленный baseline решает проблему отсутствующего исходного bootstrap, но не заменяет обычный backup.

Для disaster recovery всё равно полезно периодически хранить защищённый schema-only dump, migration history и резервную копию данных/Storage вне Git. Пароль БД, connection string, service-role/secret keys и backup с пользовательскими данными коммитить нельзя.

## Advisors

После последних DDL-изменений Security Advisor не сообщил о проблемах RLS или privileged functions. Единственное предупреждение — отключена Supabase Auth Leaked Password Protection.

Performance Advisor может показывать `unused_index`, но база новая; удалять индексы только по этой статистике преждевременно.

## Важное правило

Никогда не запускать destructive reset против production-проекта `father-son`. Reset допустим только для disposable dev/staging/local окружения.
