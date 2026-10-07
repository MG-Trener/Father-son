# Бесплатная схема проверок «Папа & Я»

Платная Supabase development branch сейчас не требуется. Пока приложение небольшое и production-схема контролируется миграциями, используем набор бесплатных проверок, которые не изменяют пользовательские данные.

## 1. Migration history parity

`supabase/tests/migration_history_invariants.sql` сравнивает canonical список migration versions в Git с `supabase_migrations.schema_migrations` production.

Проверка должна возвращать:

```text
migration_history_ok
```

Это ловит drift, когда DDL применили в Supabase, но забыли добавить соответствующий migration-файл в репозиторий, либо наоборот.

## 2. Baseline manifest

`supabase/tests/baseline_manifest.sql` проверяет наличие критичных таблиц, индексов, RPC и Realtime publications после всей цепочки миграций.

Ожидаемый результат:

```text
baseline_manifest_ok
```

## 3. Security / access invariants

Read-only SQL checks в `supabase/tests/` проверяют:

- RLS/security invariants;
- matrix клиентских прав;
- Storage policies;
- data integrity;
- индексы;
- отсутствие лишних клиентских `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- границы конкретных доменов, например `ritual_invariants.sql`.

После DDL-изменения нужно также запускать Supabase Security Advisor.

## 4. Чистые TypeScript/Node тесты

Логика, не зависящая от React Native, выносится в `src/domain/` и `src/lib/` и покрывается `node:test`.

Сейчас сюда входят:

- проверка release metadata;
- SHA/size integrity;
- mapping ошибок Android installer;
- RPC result parsing;
- правила Future Letters;
- правила Rituals.

Это позволяет проверять значительную часть поведения без Android emulator, APK build и GitHub Actions.

## 5. Production schema introspection

После изменения PostgreSQL API:

1. сверить фактическую сигнатуру RPC через `pg_proc`;
2. обновить TypeScript schema snapshot / app-facing overrides;
3. проверить grants;
4. запустить соответствующий invariant test;
5. проверить Security Advisor.

## 6. Backward compatibility

Пока новая APK не установлена на оба телефона, backend-изменения должны оставаться совместимыми с предыдущей версией клиента.

Пример: `record_ritual_moment()` уже является предпочтительной атомарной операцией, но старые direct INSERT-права на `ritual_moments` пока не отозваны. Их можно закрыть только после перехода установленных клиентов на версию, использующую RPC.

## Что эта схема не заменяет

Она не доказывает на 100%, что пустой Supabase project восстановится из нуля. Полный clean-room restore остаётся полезной финальной проверкой перед публичным масштабированием, но на текущем этапе не оправдывает отдельные платные compute-hours.

Перед релизом 1.0 можно выполнить clean-room restore локально через Supabase CLI + Docker либо во временной удалённой среде, когда это станет экономически оправдано.
