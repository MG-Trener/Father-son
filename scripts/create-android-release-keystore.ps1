param(
  [string]$Alias = "papa-i-ya-release",
  [string]$Output = "$PSScriptRoot\..\papa-i-ya-release.keystore"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  throw "keytool не найден. Установите JDK 17+ и убедитесь, что keytool доступен в PATH."
}

if (Test-Path $Output) {
  throw "Файл уже существует: $Output. Не перезаписывайте существующий production keystore."
}

$storePasswordSecure = Read-Host "Придумайте пароль keystore" -AsSecureString
$keyPasswordSecure = Read-Host "Придумайте пароль ключа (можно тот же)" -AsSecureString

$storePassword = [System.Net.NetworkCredential]::new('', $storePasswordSecure).Password
$keyPassword = [System.Net.NetworkCredential]::new('', $keyPasswordSecure).Password

if ($storePassword.Length -lt 12 -or $keyPassword.Length -lt 12) {
  throw "Используйте пароли длиной не менее 12 символов."
}

& keytool -genkeypair `
  -v `
  -keystore $Output `
  -alias $Alias `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000 `
  -storepass $storePassword `
  -keypass $keyPassword `
  -dname "CN=Papa & Ya, OU=Android, O=MG-Trener, C=KZ"

if ($LASTEXITCODE -ne 0) {
  throw "keytool завершился с ошибкой."
}

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $Output)))

Write-Host ""
Write-Host "Keystore создан: $Output" -ForegroundColor Green
Write-Host "Сделайте защищённую резервную копию этого файла. Потеря ключа лишит возможности обновлять уже установленные production APK." -ForegroundColor Yellow
Write-Host ""
Write-Host "Добавьте в GitHub Actions Secrets следующие значения:" -ForegroundColor Cyan
Write-Host "ANDROID_KEY_ALIAS=$Alias"
Write-Host "ANDROID_KEYSTORE_PASSWORD=<пароль keystore, который вы ввели>"
Write-Host "ANDROID_KEY_PASSWORD=<пароль ключа, который вы ввели>"
Write-Host "ANDROID_KEYSTORE_BASE64=<строка ниже>"
Write-Host ""
Write-Output $base64

$storePassword = $null
$keyPassword = $null
