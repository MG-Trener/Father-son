#!/usr/bin/env bash
set -euo pipefail

if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool не найден. Установите Java/JDK в Codespace и повторите запуск."
  exit 1
fi

KEYSTORE_FILE="papa-i-ya-release.keystore"
KEY_ALIAS="papa-i-ya-release"

if [ -f "$KEYSTORE_FILE" ]; then
  echo "Файл $KEYSTORE_FILE уже существует. Удалите его вручную, если хотите создать новый ключ."
  exit 1
fi

read -r -s -p "Введите пароль для keystore: " STORE_PASS
echo
read -r -s -p "Повторите пароль для keystore: " STORE_PASS_CONFIRM
echo
if [ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]; then
  echo "Пароли keystore не совпадают."
  exit 1
fi

read -r -s -p "Введите пароль для ключа (можно тот же): " KEY_PASS
echo
read -r -s -p "Повторите пароль для ключа: " KEY_PASS_CONFIRM
echo
if [ "$KEY_PASS" != "$KEY_PASS_CONFIRM" ]; then
  echo "Пароли ключа не совпадают."
  exit 1
fi

keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_FILE" \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Papa & Ya, OU=Mobile, O=MG-Trener, L=Astana, ST=Astana, C=KZ"

BASE64_VALUE="$(base64 -w 0 "$KEYSTORE_FILE" 2>/dev/null || base64 "$KEYSTORE_FILE" | tr -d '\n')"

cat <<EOF

Готово. Добавьте в GitHub Actions Secrets:

ANDROID_KEYSTORE_BASE64
$BASE64_VALUE

ANDROID_KEYSTORE_ALIAS
$KEY_ALIAS

Пароли, которые вы только что ввели, добавьте как:
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_PASSWORD

Важно: не коммитьте файл $KEYSTORE_FILE и не публикуйте эти значения.
EOF
