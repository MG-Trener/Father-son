# Автообновление Android — Папа & Я

## Схема

1. Приватный `MG-Trener/Father-son` проходит Expo Doctor, TypeScript, `expo prebuild` и `assembleRelease`.
2. Перед публикацией CI проверяет сертификат APK через `apksigner`.
3. Подписанный APK публикуется в публичном `MG-Trener/Father-son-releases` как GitHub Release asset `papa-i-ya-<version>.apk`.
4. Supabase Storage для APK не используется.
5. В таблице `app_releases` Supabase сохраняются только метаданные: `version_name`, `version_code`, публичный `download_url`, `sha256`, `size_bytes`, дата публикации и статус релиза.
6. Приложение проверяет `get_latest_app_release` при запуске.
7. Если доступна новая версия, клиент скачивает APK напрямую из публичного GitHub Releases репозитория, проверяет ожидаемый размер и передаёт файл системному Android installer.
8. Android всегда оставляет пользователю финальное подтверждение установки обновления.

## Где что хранится

- `MG-Trener/Father-son` — приватный исходный код, CI/CD, документация и Supabase-интеграция.
- `MG-Trener/Father-son-releases` — публичные стабильные APK и release notes.
- Supabase Database — каталог версий и метаданные обновлений.
- Supabase Storage — не используется для APK.

## Обязательная постоянная подпись

Все APK, которые должны устанавливаться поверх уже установленной версии, должны быть подписаны одним и тем же постоянным Android release key. Preview/debug signing допустим только для временных тестовых сборок.

CI проверяет сертификат собранного APK и отказывается публиковать debug-signed сборку как production release.

## GitHub и Supabase secrets

В приватном репозитории `Father-son` используются:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `SUPABASE_RELEASE_SECRET_KEY` — только для записи метаданных в `app_releases`; APK через этот ключ не загружается.
- `RELEASES_REPO_TOKEN` — fine-grained GitHub token, которому разрешена запись только в `MG-Trener/Father-son-releases`.

Для `RELEASES_REPO_TOKEN` достаточно создать fine-grained personal access token с доступом только к репозиторию `Father-son-releases` и разрешением **Contents: Read and write**. Токен хранится только в GitHub Actions Secret приватного репозитория и не попадает в приложение.

`SUPABASE_RELEASE_SECRET_KEY` и `RELEASES_REPO_TOKEN` нельзя помещать в `app.json`, `.env` мобильного приложения или любой `EXPO_PUBLIC_*` параметр.

## Публикация

При новом релизе CI приватного репозитория:

1. собирает и подписывает APK;
2. создаёт тег `android-v<versionCode>` в `Father-son-releases`;
3. создаёт там обычный Latest Release;
4. загружает APK;
5. записывает публичную ссылку вида `https://github.com/MG-Trener/Father-son-releases/releases/download/android-v<versionCode>/papa-i-ya-<version>.apk` в Supabase;
6. проверяет `get_latest_app_release`.

Таким образом приложение может скачать обновление без GitHub-аутентификации, при этом исходный код остаётся приватным.
