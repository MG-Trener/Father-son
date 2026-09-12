# Автообновление Android — Папа & Я

## Схема

1. `main` проходит Expo Doctor, TypeScript, `expo prebuild` и `assembleRelease`.
2. Перед публикацией CI проверяет сертификат APK через `apksigner`.
3. Подписанный APK публикуется только в GitHub Releases как versioned asset `papa-i-ya-<version>.apk`.
4. Supabase Storage для APK не используется.
5. В таблице `app_releases` Supabase сохраняются только метаданные: `version_name`, `version_code`, `download_url`, `sha256`, `size_bytes`, дата публикации и статус релиза.
6. `download_url` указывает на GitHub Release asset.
7. Приложение проверяет `get_latest_app_release` при запуске.
8. Если доступна новая версия, клиент использует `download_url`, проверяет ожидаемый размер APK и передаёт файл системному Android installer.
9. Android всегда оставляет пользователю финальное подтверждение установки обновления.

## Где что хранится

- GitHub Releases — APK-файлы и история выпусков.
- Supabase Database — каталог версий и метаданные обновлений.
- Supabase Storage — не используется для APK.

## Обязательная постоянная подпись

Все APK, которые должны устанавливаться поверх уже установленной версии, должны быть подписаны одним и тем же постоянным Android release key. Preview/debug signing допустим только для временных тестовых сборок.

Рекомендуемый долгосрочный вариант — EAS-managed Android credentials либо собственный release keystore, хранящийся вне Git и передаваемый CI через защищённые secrets. Keystore и его пароли нельзя коммитить в репозиторий.

CI проверяет сертификат собранного APK и отказывается публиковать debug-signed сборку как production release.

## GitHub и Supabase secrets

Для release workflow используются:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `SUPABASE_RELEASE_SECRET_KEY` — только для записи метаданных в `app_releases`; APK через этот ключ не загружается.

`SUPABASE_RELEASE_SECRET_KEY` нельзя помещать в `app.json`, `.env` мобильного приложения или любой `EXPO_PUBLIC_*` параметр.

## Важно для приватного репозитория

Релизный APK физически хранится только в GitHub Releases. У текущего репозитория приватная видимость, поэтому прямой GitHub asset URL требует GitHub-доступ. Если понадобится полностью автоматическая загрузка APK из приложения без GitHub-аутентификации, правильный вариант — отдельный публичный release-only репозиторий только для APK, при этом исходный код `Father-son` может оставаться приватным.
