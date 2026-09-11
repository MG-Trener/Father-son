# Android releases

## Versioning

Android preview builds use two values from `app.json`:

- `expo.version` — human-readable version, for example `0.3.0`;
- `expo.android.versionCode` — monotonically increasing integer used to identify Android builds.

Every publishable Android version must increment `versionCode`. A meaningful feature set should also increment `expo.version`.

## Automated pipeline

`.github/workflows/validate-android.yml` validates every pull request to `main` with Expo Doctor and TypeScript and then builds a release APK.

On a push to `main`, the workflow additionally:

1. creates a versioned GitHub prerelease tagged `android-v<versionCode>` and attaches `papa-i-ya-<version>.apk`;
2. keeps the APK as a short-lived GitHub Actions artifact for diagnostics/testing;
3. when `SUPABASE_RELEASE_SECRET_KEY` is configured and the APK is not debug-signed, uploads the APK to the private `app-releases` bucket and registers it in `app_releases` for the in-app updater.

## Current channels

- **GitHub prerelease** — preview/testing distribution; works without a Supabase server secret.
- **Supabase `preview`** — private in-app update channel. Requires `SUPABASE_RELEASE_SECRET_KEY` and a non-debug APK signature.

## Signing rule

Do not advertise a debug-signed APK as an in-place application update. Android only installs an update over an existing installation when the package name and signing identity are compatible. The Supabase publishing step therefore refuses debug-signed APKs.

For production-style updates, configure a persistent Android release keystore in repository secrets and wire it into the Android build before enabling automatic Supabase publication.
