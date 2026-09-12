# Supabase recovery plan

Проверено 13 сентября 2026 года для проекта `father-son` (`kyptvbnnyqlmwkiobtvq`).

## Почему этот документ нужен

Текущий каталог `supabase/migrations/` не содержит первоначальный bootstrap схемы. Первая запись в истории миграций начинается с `20260910153606_together_interactions_rpc`, хотя в рабочей базе уже существуют базовые таблицы `families`, `family_members`, `activity_events`, `missions`, `moods`, `meetings` и другие сущности, созданные раньше.

Из-за этого новый пустой Supabase-проект нельзя считать гарантированно восстановимым только последовательным применением файлов из `supabase/migrations/`.

## Текущее состояние рабочей базы

На момент проверки проект активен и работает на PostgreSQL 17.6. В схемах `public` и `private` найдено 31 прикладная таблица. У каждой из них включён Row Level Security.

Таблицы:

- `private.family_invites`
- `public.achievement_awards`
- `public.achievement_definitions`
- `public.activity_event_reads`
- `public.activity_events`
- `public.age_seasons`
- `public.app_releases`
- `public.families`
- `public.family_agreement_confirmations`
- `public.family_agreements`
- `public.family_members`
- `public.family_rituals`
- `public.future_letter_contents`
- `public.future_letters`
- `public.growth_entries`
- `public.meeting_idea_reactions`
- `public.meeting_ideas`
- `public.meetings`
- `public.missions`
- `public.moods`
- `public.notification_deliveries`
- `public.push_devices`
- `public.recognitions`
- `public.reflections`
- `public.ritual_moments`
- `public.skill_nodes`
- `public.skill_paths`
- `public.skill_progress`
- `public.voice_stories`
- `public.weekly_focuses`
- `public.year_reviews`

## Безопасный способ получить baseline

Не нужно вручную писать первоначальную миграцию по памяти и не нужно выполнять destructive reset на рабочем проекте.

Supabase рекомендует для существующего удалённого проекта либо `supabase db pull` для перехода на полноценный migration workflow, либо `supabase db dump` для резервной копии схемы. Перед использованием CLI нужно проверить актуальные параметры команд через `supabase --help` и `supabase db --help`.

Для аварийного восстановления наиболее безопасно хранить отдельно:

1. schema dump;
2. migration history;
3. данные, если нужен полный backup;
4. отдельные настройки Auth/Storage и сами Storage-объекты;
5. Edge Functions из `supabase/functions/`.

Официальный CLI поддерживает схему вида:

```bash
supabase db dump --db-url "$DB_URL" -f schema.sql
supabase db dump --db-url "$DB_URL" -f history_schema.sql --schema supabase_migrations
supabase db dump --db-url "$DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
```

Пароль БД, connection string, service-role/secret keys и backup с реальными пользовательскими данными нельзя коммитить в Git.

## Что нужно сделать перед закрытием замечания P0

- Снять свежий schema dump рабочего проекта и сохранить проверенную schema-only копию в защищённом backup-хранилище.
- Сформировать migration baseline так, чтобы чистая локальная база проходила `supabase db reset` без ручных действий.
- Отдельно проверить кастомные изменения `storage` и Realtime publications.
- Проверить Edge Function `send-family-push` после восстановления.
- Создать тестовый пустой Supabase-проект или локальный стек и выполнить полный restore rehearsal.
- После успешной проверки зафиксировать baseline/migration strategy в репозитории и больше не менять production schema через Dashboard без новой миграции.

## Текущие Advisors

Security Advisor на 13 сентября 2026 года не сообщил о проблемах RLS, exposed tables или privileged functions. Единственное предупреждение — отключена Supabase Auth Leaked Password Protection.

Performance Advisor показывает много `unused_index`, но база существует всего несколько дней. Эти индексы сейчас не следует удалять только на основании текущей статистики использования.

## Важное правило

Никогда не запускать `supabase db reset --linked` против production-проекта `father-son`. Эта команда разрушительна и предназначена только для disposable dev/staging окружений.
