# Supabase baseline recovery

Эта папка восстанавливает слой схемы, который существовал **до первой сохранённой migration** `20260910153606_together_interactions_rpc.sql`.

Baseline восстановлен 13 сентября 2026 из живого production-проекта Supabase и Git-истории проекта. Он хранится **вне** `supabase/migrations`, чтобы никогда не примениться к существующей production-базе как новая migration.

## Состав

1. `001_core_schema.sql` — исходные таблицы, ограничения и индексы.
2. `002_core_security.sql` — RLS, объектные права и базовые policies.
3. `003_core_rpcs.sql` — RPC, которых раньше не было в migration history: создание семьи, приглашения, подключение по коду, создание/завершение миссии.
4. `004_seed_catalog.sql` — статический каталог развития: 6 направлений, 44 шага, 17 достижений.

После baseline применяются обычные migrations из `supabase/migrations` начиная с `20260910153606`.

## Только для новой / пустой базы

**Не запускайте эти файлы как новую migration на существующем production.** Production уже содержит эти объекты.

Для disaster recovery новой Supabase-базы:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/baseline/001_core_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/baseline/002_core_security.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/baseline/003_core_rpcs.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/baseline/004_seed_catalog.sql
```

Затем примените migration chain начиная с `20260910153606` обычным способом Supabase CLI.

После восстановления обязательно выполните:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/baseline_manifest.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security_invariants.sql
```

Ожидаемые результаты:

- `baseline_manifest_ok`
- `security_invariants_ok`

## Почему baseline не лежит в migrations

Production уже имеет историю migrations, начинающуюся с `20260910153606`, но исходный слой был создан до того, как migrations начали сохраняться в Git. Добавление восстановленного baseline с новым timestamp заставило бы Supabase пытаться повторно создавать существующие объекты.

Поэтому baseline является **bootstrap-слоем для новой базы**, а не очередной production migration.

## Что намеренно добавляют последующие migrations

Некоторые поля не входят в первоначальный слой или добавляются повторно безопасно через `IF NOT EXISTS`, например:

- `families.timezone`
- `family_members.onboarding_completed_at`
- новые таблицы голосовых историй, growth journal, future letters, rituals, agreements, push-delivery и app releases
- новые RPC и дополнительные security hardening migrations

## Текущее подтверждение

На production 13 сентября 2026 выполнен `supabase/tests/baseline_manifest.sql`: результат `baseline_manifest_ok`.

Кроме того, каждый bootstrap-файл был отдельно выполнен против production внутри транзакции `BEGIN ... ROLLBACK`, поэтому проверка не оставляла изменений. Получены результаты:

```text
core_schema_sql_ok
core_security_sql_ok
core_rpcs_sql_ok
seed_catalog_sql_ok
```

Это подтверждает синтаксис, имена объектов и зависимости относительно текущей Supabase/PostgreSQL-среды. Проверка `001` на production использует `IF NOT EXISTS`, поэтому она не заменяет испытание фактического создания объектов с нуля.

Полный тест развёртывания baseline + всей migration chain на **чистой** Supabase development branch ещё должен быть выполнен отдельно. Создание Supabase branch является тарифицируемой операцией и требует явного подтверждения стоимости владельцем проекта, поэтому автоматически branch не создавался.
