# Автообновление Android — Папа & Я

## Схема

1. `main` проходит Expo Doctor, TypeScript, `expo prebuild` и `assembleRelease`.
2. CI сохраняет APK как GitHub Actions artifact.
3. Когда настроен `SUPABASE_RELEASE_SECRET_KEY`, CI дополнительно загружает APK в приватный Supabase Storage bucket `app-releases`.
4. В `app_releases` сохраняются `version_name`, `version_code`, `storage_path`, `sha256` и `size_bytes`.
5. Приложение проверяет `get_latest_app_release` при запуске.
6. Для приватного APK авторизованный пользователь получает signed URL сроком на 10 минут.
7. APK скачивается в cache приложения, проверяется ожидаемый размер и передаётся системному Android installer.
8. Android всегда оставляет пользователю финальное подтверждение установки обновления.

## Обязательная постоянная подпись

Все APK, которые должны устанавливаться поверх уже установленной версии, должны быть подписаны одним и тем же постоянным Android release key. Preview/debug signing допустим только для временных тестовых сборок.

Рекомендуемый долгосрочный вариант — EAS-managed Android credentials либо собственный release keystore, хранящийся вне Git и передаваемый CI через защищённые secrets. Keystore и его пароли нельзя коммитить в репозиторий.

## GitHub secret

Для автоматической публикации файла из `main` workflow ожидает секрет:

`SUPABASE_RELEASE_SECRET_KEY`

Если секрет не настроен, сборка не падает: APK остаётся обычным GitHub Actions artifact, а публикация в Supabase безопасно пропускается.

## Storage

Bucket `app-releases` приватный. Мобильный клиент не имеет прав загружать или заменять APK. Авторизованному приложению разрешено только чтение релизных объектов, необходимое для генерации короткоживущей signed URL.
