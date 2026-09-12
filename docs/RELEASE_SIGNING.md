# Постоянная Android-подпись — Папа & Я

Приложение распространяется напрямую как APK, поэтому все версии, которые должны устанавливаться поверх уже установленной, обязаны использовать один и тот же Android signing key.

## Текущий CI-вариант: локальный keystore + GitHub Actions Secrets

Для автоматической публикации APK из `main` используется постоянный keystore, который создаётся один раз на компьютере владельца проекта и никогда не коммитится в Git.

На Windows из корня репозитория запустите:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-android-release-keystore.ps1
```

Скрипт:

- создаёт `papa-i-ya-release.keystore` локально;
- требует пароли не короче 12 символов;
- выводит Base64-представление keystore для GitHub Secret;
- не добавляет keystore в репозиторий (`*.keystore` уже находится в `.gitignore`).

После создания ключа добавьте в приватном `MG-Trener/Father-son`: **Settings → Secrets and variables → Actions → New repository secret**:

- `ANDROID_KEYSTORE_BASE64` — Base64-строка, которую вывел скрипт;
- `ANDROID_KEYSTORE_PASSWORD` — пароль keystore;
- `ANDROID_KEY_ALIAS` — по умолчанию `papa-i-ya-release`;
- `ANDROID_KEY_PASSWORD` — пароль ключа;
- `SUPABASE_RELEASE_SECRET_KEY` — серверный Supabase secret key только для записи метаданных релиза в `app_releases`;
- `RELEASES_REPO_TOKEN` — fine-grained GitHub token для публикации только в `MG-Trener/Father-son-releases`.

Для `RELEASES_REPO_TOKEN` выберите доступ только к репозиторию `Father-son-releases` и разрешение **Repository permissions → Contents: Read and write**. Более широкие права не нужны.

`SUPABASE_RELEASE_SECRET_KEY` и `RELEASES_REPO_TOKEN` нельзя помещать в `app.json`, `.env` мобильного приложения или любой `EXPO_PUBLIC_*` параметр.

После добавления секретов следующий релизный push в `main` выполняет цепочку:

1. Expo Doctor и TypeScript.
2. Проверка доступа к публичному `Father-son-releases`.
3. Expo prebuild.
4. Временное восстановление keystore только внутри GitHub runner.
5. Сборка APK с постоянной подписью.
6. Проверка сертификата через `apksigner`.
7. Создание обычного Latest Release в публичном `MG-Trener/Father-son-releases` с versioned APK asset.
8. Запись публичного `download_url`, версии, SHA-256 и размера в таблицу `app_releases` Supabase.
9. Проверка `get_latest_app_release`.
10. Удаление keystore с runner.

APK хранится только в публичном GitHub Releases репозитории. Supabase Storage в release pipeline не используется.

## Первый переход на постоянную подпись

Если установленная на телефоне версия была собрана с debug/preview-ключом, Android не позволит установить поверх неё APK, подписанный новым production-ключом. Это штатное ограничение Android.

Поэтому при первом переходе на постоянную подпись нужно один раз:

1. убедиться, что важные данные приложения уже находятся в Supabase, а не только локально;
2. удалить старую preview/debug-установку;
3. установить первый APK с постоянной release-подписью;
4. дальше все версии устанавливаются поверх неё без смены signing key.

## Разделение репозиториев

- `MG-Trener/Father-son` — приватный: исходники, рабочие ветки, CI/CD и секреты.
- `MG-Trener/Father-son-releases` — публичный: только подписанные APK, теги и release notes.

Публичный репозиторий не должен содержать keystore, Supabase secrets, исходный код или workflow-секреты. Такая схема позволяет приложению скачивать APK по обычной публичной GitHub URL без входа пользователя в GitHub.

## Альтернативный вариант: EAS-managed credentials

Можно использовать EAS-managed credentials. Один раз на компьютере владельца проекта:

1. Установить/запустить EAS CLI и войти в Expo-аккаунт.
2. В корне проекта выполнить `eas build --platform android --profile production`.
3. При первом запросе Android credentials выбрать генерацию нового keystore через EAS.
4. EAS сохранит keystore на своих серверах и будет повторно использовать его для следующих production-сборок package `com.mgtrener.fatherson`.

Не следует одновременно заводить два независимых production signing key. После выбора базового production-ключа он должен оставаться единственным для прямых APK-обновлений.

## Важно

- Не коммитить keystore, `credentials.json`, пароли или секретные ключи в Git.
- Не менять Android package `com.mgtrener.fatherson` после начала реального использования.
- Не генерировать новый production keystore для каждого релиза.
- Перед публикацией релиза увеличивать `expo.version` и `expo.android.versionCode`.
- Сделать защищённую офлайн-резервную копию keystore и паролей. Потеря production signing key лишит возможности выпускать обновления поверх уже установленных APK.
