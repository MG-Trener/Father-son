# Автообновление Android — Папа & Я

## Схема

1. `main` проходит Expo Doctor, TypeScript, `expo prebuild` и `assembleRelease`.
2. CI сохраняет APK как GitHub Actions artifact.
3. Перед публикацией CI проверяет сертификат APK через `apksigner`.
4. Если APK всё ещё подписан `Android Debug`, публикация в канал обновлений блокируется.
5. Когда настроен постоянный Android release key и `SUPABASE_RELEASE_SECRET_KEY`, CI загружает APK в приватный Supabase Storage bucket `app-releases`.
6. В `app_releases` сохраняются `version_name`, `version_code`, `storage_path`, `sha256` и `size_bytes`.
7. Приложение проверяет `get_latest_app_release` при запуске.
8. Для приватного APK авторизованный пользователь получает signed URL сроком на 10 минут.
9. APK скачивается в cache приложения, проверяется ожидаемый размер и передаётся системному Android installer.
10. Android всегда оставляет пользователю финальное подтверждение установки обновления.

## Обязательная постоянная подпись

Все APK, которые должны устанавливаться поверх уже установленной версии, должны быть подписаны одним и тем же постоянным Android release key. Preview/debug signing допустим только для временных тестовых сборок.

Рекомендуемый долгосрочный вариант — EAS-managed Android credentials либо собственный release keystore, хранящийся вне Git и передаваемый CI через защищённые secrets. Keystore и его пароли нельзя коммитить в репозиторий.

CI дополнительно проверяет сертификат собранного APK и отказывается публиковать debug-signed сборку в `app-releases`. Это защищает от случайного выпуска APK, который Android потом не сможет поставить поверх production-версии.

## GitHub secret

Для автоматической публикации файла из `main` workflow ожидает секрет:

`SUPABASE_RELEASE_SECRET_KEY`

Если секрет не настроен, сборка не падает: APK остаётся обычным GitHub Actions artifact, а публикация в Supabase безопасно пропускается.

## Storage

Bucket `app-releases` приватный. Мобильный клиент не имеет прав загружать или заменять APK. Авторизованному приложению разрешено только чтение релизных объектов, необходимое для генерации короткоживущей signed URL.
