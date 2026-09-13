import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { checkForAppUpdate, installReleaseApk, type UpdateStatus } from '../lib/appUpdater';
import { useAuth } from '../context/AuthContext';
import { colors, gradients, radius, shadows } from '../theme';

export function AppUpdateGate() {
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    try {
      const next = await checkForAppUpdate();
      setStatus(next);
      if (next.required && session) setDismissed(false);
    } catch {
      // Update checks must never block normal app startup on network errors.
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => void check(), 1600);
    return () => clearTimeout(timer);
  }, [check]);

  useEffect(() => {
    if (session && status?.required) setDismissed(false);
  }, [session, status?.required]);

  const install = async () => {
    if (!status?.release || busy) return;
    const hasPublishedArtifact = Boolean(
      status.release.download_url
      || (status.release.storage_bucket && status.release.storage_path),
    );
    if (!hasPublishedArtifact) {
      Alert.alert('Сборка ещё публикуется', 'Новая версия уже зарегистрирована, но APK пока не выложен. Проверка повторится при следующем запуске.');
      return;
    }

    if (!session && !status.release.download_url) {
      Alert.alert('Сначала войди', 'APK хранится в приватном хранилище. Войди в «Папа & Я», после этого обновление можно будет установить.');
      return;
    }

    setBusy(true);
    try {
      await installReleaseApk(status.release);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      if (message.includes('PERMISSION')) {
        Alert.alert('Разреши установку', 'Android должен разрешить «Папа & Я» устанавливать собственные обновления. После разрешения нажми «Обновить» ещё раз.');
      } else if (message.includes('AUTH_REQUIRED')) {
        Alert.alert('Нужно войти', 'APK хранится в приватном семейном хранилище. Войди в «Папа & Я» и повтори обновление.');
      } else if (message.includes('SIZE_')) {
        Alert.alert('Файл не прошёл проверку', 'Размер APK не совпадает с опубликованными метаданными. Установка отменена — попробуй позже.');
      } else if (message.includes('SHA256')) {
        Alert.alert('Файл не прошёл проверку', 'Контрольная сумма APK не совпала с опубликованной версией. Установка отменена для безопасности.');
      } else if (message.includes('SIGNED_URL')) {
        Alert.alert('Ссылка устарела', 'Не удалось получить временную защищённую ссылку на APK. Повтори обновление.');
      } else if (message.includes('DOWNLOAD_FAILED')) {
        Alert.alert('Не удалось скачать обновление', 'Файл APK не загрузился полностью. Проверь интернет и повтори попытку.');
      } else {
        Alert.alert('Не удалось обновить', 'Проверь интернет и попробуй ещё раз. Текущая версия продолжит работать.');
      }
    } finally {
      setBusy(false);
    }
  };

  const blockingRequired = Boolean(status?.required && session && !authLoading);
  const visible = Boolean(status?.available && !dismissed);
  if (!status?.release) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !blockingRequired && setDismissed(true)}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, shadows.lift]}>
          <LinearGradient colors={gradients.team} style={styles.hero}>
            <View style={styles.orbOne} />
            <View style={styles.orbTwo} />
            <View style={styles.rocketBadge}>
              <Text style={styles.rocket}>↗</Text>
            </View>
            <Text style={styles.kicker}>{blockingRequired ? 'ВАЖНОЕ ОБНОВЛЕНИЕ' : 'НОВАЯ ГЛАВА'}</Text>
            <Text style={styles.title}>Папа & Я {status.release.version_name}</Text>
            <Text style={styles.heroText}>{status.release.title ?? 'В приложении появились новые возможности.'}</Text>
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.versionRow}>
              <View>
                <Text style={styles.versionLabel}>Сейчас</Text>
                <Text style={styles.versionValue}>{status.currentVersion}</Text>
              </View>
              <View style={styles.routeLine}><View style={styles.routeDot} /><View style={styles.routeDash} /><View style={styles.routeDotActive} /></View>
              <View style={styles.versionRight}>
                <Text style={styles.versionLabel}>Новая</Text>
                <Text style={styles.versionValue}>{status.release.version_name}</Text>
              </View>
            </View>

            {status.release.notes ? (
              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>Что нового</Text>
                <Text style={styles.notes}>{status.release.notes}</Text>
              </View>
            ) : null}

            <Pressable style={[styles.updateButton, busy && styles.disabled]} disabled={busy} onPress={() => void install()}>
              <LinearGradient colors={gradients.connection} style={styles.updateGradient}>
                {busy ? <ActivityIndicator color={colors.navyDeep} /> : <Text style={styles.updateText}>{!session && !status.release.download_url ? 'Войти и обновить' : 'Обновить приложение'}</Text>}
              </LinearGradient>
            </Pressable>

            {!blockingRequired ? (
              <Pressable style={styles.laterButton} onPress={() => setDismissed(true)}>
                <Text style={styles.laterText}>Напомнить позже</Text>
              </Pressable>
            ) : (
              <Text style={styles.requiredHint}>Эта версия нужна для совместимости и безопасности семейных данных.</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(7,31,42,0.66)', justifyContent: 'center', padding: 20 },
  sheet: { overflow: 'hidden', backgroundColor: colors.paper, borderRadius: radius.xl },
  hero: { minHeight: 220, padding: 24, justifyContent: 'flex-end', overflow: 'hidden' },
  orbOne: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,215,106,0.13)', top: -50, right: -20 },
  orbTwo: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', top: 42, right: 62 },
  rocketBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center', marginBottom: 26, transform: [{ rotate: '-8deg' }] },
  rocket: { color: colors.navyDeep, fontSize: 28, fontWeight: '900' },
  kicker: { color: '#CFE4E5', fontSize: 10, letterSpacing: 1.4, fontWeight: '900' },
  title: { color: colors.white, fontSize: 29, fontWeight: '900', marginTop: 5, letterSpacing: -0.7 },
  heroText: { color: '#E7F0F0', fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: '90%' },
  body: { padding: 20, gap: 15 },
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  versionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  versionValue: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  versionRight: { alignItems: 'flex-end' },
  routeLine: { flex: 1, marginHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lineWarm },
  routeDash: { flex: 1, height: 2, backgroundColor: colors.lineWarm },
  routeDotActive: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.amber },
  notesCard: { padding: 15, borderRadius: radius.md, backgroundColor: colors.sandWarm },
  notesTitle: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' },
  notes: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  updateButton: { borderRadius: radius.md, overflow: 'hidden' },
  updateGradient: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  updateText: { color: colors.navyDeep, fontSize: 15, fontWeight: '900' },
  laterButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  laterText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  requiredHint: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 16 },
  disabled: { opacity: 0.55 },
});
