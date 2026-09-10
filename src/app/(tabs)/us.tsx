import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { checkForAppUpdate, installReleaseApk, type UpdateStatus } from '../../lib/appUpdater';
import { supabase } from '../../lib/supabase';
import { colors, gradients, radius, shadows } from '../../theme';

const years = [11, 12, 13, 14, 15, 16, 17, 18];

type InviteResult = { family_id: string; invite_code: string; invite_expires_at: string };

export default function UsScreen() {
  const { signOut } = useAuth();
  const { family, me, members } = useFamily();
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  const parent = useMemo(() => members.find((member) => member.role === 'parent'), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);
  const teamName = family?.name ?? 'Михаил + Артур';

  const createInvite = async () => {
    if (!supabase || !family || me?.role !== 'parent' || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_family_invite', { p_family_id: family.id, p_display_name_hint: 'Артур' });
      if (error) throw error;
      setInvite(data as unknown as InviteResult);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось создать приглашение.';
      Alert.alert('Не удалось создать код', message.includes('FAMILY_FULL') ? 'Артур уже подключён к этой команде.' : message);
    } finally { setBusy(false); }
  };

  const checkUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate();
      setUpdateStatus(result);
      if (!result.available) Alert.alert('Всё актуально ✓', `Установлена версия ${result.currentVersion}.`);
    } catch {
      Alert.alert('Не удалось проверить', 'Проверь интернет и попробуй ещё раз.');
    } finally { setCheckingUpdate(false); }
  };

  const installUpdate = async () => {
    if (!updateStatus?.release?.download_url) {
      Alert.alert('APK ещё публикуется', 'Версия зарегистрирована, но файл обновления пока не опубликован.');
      return;
    }
    try { await installReleaseApk(updateStatus.release); }
    catch { Alert.alert('Не удалось начать установку', 'Проверь разрешение Android на установку приложений из этого источника.'); }
  };

  const exit = async () => { await signOut(); router.replace('/sign-in'); };
  const parentName = parent?.display_name ?? 'Михаил';
  const childName = child?.display_name ?? 'Артур';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroOrb} /><View style={styles.heroOrbit} />
          <Text style={styles.kicker}>НАША КОМАНДА</Text>
          <Text style={styles.heroTitle}>{teamName}</Text>
          <Text style={styles.heroLevel}>Напарники · глава первая</Text>
          <View style={styles.avatarScene}>
            <View style={styles.avatarWrap}><View style={[styles.avatar, styles.parentAvatar]}><Text style={styles.avatarText}>{parentName.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.avatarName}>{parentName}</Text></View>
            <View style={styles.bridge}><View style={styles.bridgeLine} /><View style={styles.bridgeStar}><Text style={styles.bridgeStarText}>✦</Text></View><View style={styles.bridgeLine} /></View>
            <View style={styles.avatarWrap}><View style={[styles.avatar, styles.childAvatar]}><Text style={styles.avatarText}>{childName.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.avatarName}>{childName}</Text></View>
          </View>
        </LinearGradient>

        <View style={[styles.membersCard, shadows.soft]}>
          <Text style={styles.sectionKicker}>УЧАСТНИКИ</Text>
          <View style={styles.memberRow}><View style={[styles.memberMiniAvatar, { backgroundColor: colors.blue }]}><Text style={styles.memberMiniText}>{parentName.slice(0, 1).toUpperCase()}</Text></View><View style={styles.memberText}><Text style={styles.memberName}>{parentName}</Text><Text style={styles.memberRole}>Папа · основатель команды</Text></View><View style={styles.onlineDot} /></View>
          <View style={styles.memberDivider} />
          <View style={styles.memberRow}><View style={[styles.memberMiniAvatar, { backgroundColor: child ? colors.orange : colors.line }]}><Text style={styles.memberMiniText}>{child ? childName.slice(0, 1).toUpperCase() : '?'}</Text></View><View style={styles.memberText}><Text style={styles.memberName}>{childName}</Text><Text style={styles.memberRole}>Сын · {child ? 'в команде' : 'ожидает приглашение'}</Text></View><View style={[styles.onlineDot, !child && styles.waitingDot]} /></View>
        </View>

        {!child && me?.role === 'parent' ? (
          <LinearGradient colors={['#4A8490', '#236371']} style={[styles.inviteCard, shadows.soft]}>
            <View style={styles.inviteDecor}>+</View>
            <Text style={styles.inviteKicker}>ПОДКЛЮЧИТЬ АРТУРА</Text>
            <Text style={styles.inviteTitle}>Два телефона.{`\n`}Одно пространство.</Text>
            {invite ? <View style={styles.inviteBox}><Text style={styles.inviteLabel}>КОД ДЛЯ ВТОРОГО ТЕЛЕФОНА</Text><Text selectable style={styles.inviteCode}>{invite.invite_code}</Text><Text style={styles.inviteHint}>Одноразовый · 7 дней</Text></View> : null}
            <Pressable style={[styles.inviteButton, busy && styles.disabled]} onPress={() => void createInvite()} disabled={busy}><Text style={styles.inviteButtonText}>{busy ? 'Создаём…' : invite ? 'Новый код' : 'Получить код →'}</Text></Pressable>
          </LinearGradient>
        ) : null}

        <View style={[styles.pathCard, shadows.soft]}>
          <View style={styles.pathDecor}><Text style={styles.pathDecorText}>↗</Text></View>
          <Text style={styles.sectionKicker}>ПУТЬ АРТУРА</Text>
          <Text style={styles.sectionTitle}>11 → 18</Text>
          <Text style={styles.pathText}>Не процент выполнения, а семь лет моментов, решений и взросления.</Text>
          <View style={styles.years}>
            {years.map((year, index) => (
              <View key={year} style={styles.yearPart}>
                <View style={[styles.year, index === 0 && styles.yearActive]}><Text style={[styles.yearText, index === 0 && styles.yearTextActive]}>{year}</Text></View>
                {index < years.length - 1 ? <View style={styles.yearLine} /> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHead}><View><Text style={styles.sectionKicker}>АРТЕФАКТЫ ПУТИ</Text><Text style={styles.sectionTitle}>То, что останется</Text></View></View>
        <View style={styles.artifactGrid}>
          {[
            ['♟', 'Шахматный конь', 'Первая большая шахматная веха', '#E7E2F6'],
            ['⚽', 'Повязка', 'Лидерство и команда на поле', '#DCEFE4'],
            ['🧭', 'Компас', 'Серьёзное самостоятельное решение', '#F7DDD5'],
            ['❤️', 'Наш день', 'Момент Михаила и Артура', '#FFF0CF'],
          ].map(([icon, title, text, background]) => (
            <View key={title} style={[styles.artifactCard, { backgroundColor }, shadows.soft]}><Text style={styles.artifactIcon}>{icon}</Text><Text style={styles.artifactTitle}>{title}</Text><Text style={styles.artifactText}>{text}</Text></View>
          ))}
        </View>

        <View style={[styles.updateCard, shadows.soft]}>
          <View style={styles.updateIcon}><Text style={styles.updateIconText}>↻</Text></View>
          <View style={styles.updateCopy}>
            <Text style={styles.sectionKicker}>ПРИЛОЖЕНИЕ</Text>
            <Text style={styles.updateTitle}>Обновления</Text>
            <Text style={styles.updateText}>
              {updateStatus?.available
                ? `Доступна ${updateStatus.release?.version_name ?? 'новая версия'}`
                : updateStatus
                  ? `Версия ${updateStatus.currentVersion} актуальна`
                  : 'Автопроверка включена при запуске'}
            </Text>
          </View>
          {checkingUpdate ? <ActivityIndicator color={colors.navy} /> : (
            <Pressable style={styles.updateButton} onPress={() => updateStatus?.available ? void installUpdate() : void checkUpdate()}>
              <Text style={styles.updateButtonText}>{updateStatus?.available ? 'Обновить' : 'Проверить'}</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.ruleCard, shadows.soft]}><Text style={styles.ruleMark}>“</Text><Text style={styles.rule}>XP — для атмосферы. Настоящие достижения сохраняют реальные события, выборы, усилия, мысли и голос.</Text></View>

        {supabase ? <Pressable onPress={() => void exit()} style={styles.exitButton}><Text style={styles.exitText}>Выйти из аккаунта</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 38, gap: 18 },
  hero: { minHeight: 315, borderRadius: radius.xl, padding: 22, overflow: 'hidden' }, heroOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -50, top: -55, backgroundColor: 'rgba(255,215,106,0.10)' }, heroOrbit: { position: 'absolute', width: 170, height: 80, borderRadius: 85, borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', right: -10, top: 45, transform: [{ rotate: '-22deg' }] }, kicker: { color: '#BBD1D2', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 }, heroTitle: { color: colors.white, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 5 }, heroLevel: { color: colors.sun, fontSize: 11, fontWeight: '900', marginTop: 4 }, avatarScene: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 42 }, avatarWrap: { alignItems: 'center' }, avatar: { width: 70, height: 70, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }, parentAvatar: { backgroundColor: colors.blue, transform: [{ rotate: '-3deg' }] }, childAvatar: { backgroundColor: colors.orange, transform: [{ rotate: '3deg' }] }, avatarText: { color: colors.white, fontSize: 27, fontWeight: '900' }, avatarName: { color: colors.white, fontSize: 11, fontWeight: '900', marginTop: 8 }, bridge: { width: 110, flexDirection: 'row', alignItems: 'center', marginHorizontal: -3, marginBottom: 22 }, bridgeLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.26)' }, bridgeStar: { width: 31, height: 31, borderRadius: 16, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }, bridgeStarText: { color: colors.navyDeep, fontWeight: '900' },
  membersCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 18 }, sectionKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.15 }, memberRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 11 }, memberMiniAvatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, memberMiniText: { color: colors.white, fontSize: 16, fontWeight: '900' }, memberText: { flex: 1 }, memberName: { color: colors.navyDeep, fontSize: 15, fontWeight: '900' }, memberRole: { color: colors.muted, fontSize: 10, marginTop: 2 }, onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green }, waitingDot: { backgroundColor: colors.amber }, memberDivider: { height: 1, backgroundColor: colors.lineWarm, marginLeft: 53 },
  inviteCard: { borderRadius: radius.xl, padding: 20, overflow: 'hidden' }, inviteDecor: { position: 'absolute', color: 'rgba(255,255,255,0.10)', fontSize: 160, fontWeight: '200', right: 4, top: -34 }, inviteKicker: { color: '#CDE1E3', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, inviteTitle: { color: colors.white, fontSize: 24, lineHeight: 27, fontWeight: '900', marginTop: 7 }, inviteBox: { marginTop: 17, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center' }, inviteLabel: { color: '#CDE1E3', fontSize: 8, fontWeight: '900' }, inviteCode: { color: colors.sun, fontSize: 27, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 }, inviteHint: { color: '#D5E4E5', fontSize: 9, marginTop: 3 }, inviteButton: { minHeight: 46, marginTop: 12, backgroundColor: colors.white, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, inviteButtonText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  pathCard: { minHeight: 225, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 20, overflow: 'hidden' }, pathDecor: { position: 'absolute', width: 80, height: 80, borderRadius: 28, backgroundColor: '#FFF0CF', right: 15, top: 15, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] }, pathDecorText: { color: colors.orange, fontSize: 36, fontWeight: '900' }, sectionTitle: { color: colors.navyDeep, fontSize: 23, fontWeight: '900', marginTop: 3 }, pathText: { color: colors.muted, fontSize: 10, lineHeight: 16, maxWidth: '67%', marginTop: 8 }, years: { flexDirection: 'row', alignItems: 'center', marginTop: 25 }, yearPart: { flex: 1, flexDirection: 'row', alignItems: 'center' }, year: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' }, yearActive: { backgroundColor: colors.amber }, yearText: { color: colors.muted, fontSize: 8, fontWeight: '900' }, yearTextActive: { color: colors.navyDeep }, yearLine: { flex: 1, height: 1, backgroundColor: colors.lineWarm },
  sectionHead: { marginTop: 2 }, artifactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, artifactCard: { width: '48.5%', minHeight: 145, borderRadius: radius.lg, padding: 15 }, artifactIcon: { fontSize: 26 }, artifactTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 14 }, artifactText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  updateCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }, updateIcon: { width: 45, height: 45, borderRadius: 16, backgroundColor: '#DCEEF1', alignItems: 'center', justifyContent: 'center' }, updateIconText: { color: colors.teal, fontSize: 23, fontWeight: '900' }, updateCopy: { flex: 1 }, updateTitle: { color: colors.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 2 }, updateText: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 2 }, updateButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.navy }, updateButtonText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  ruleCard: { minHeight: 130, backgroundColor: '#FFF0CF', borderRadius: radius.xl, padding: 20, overflow: 'hidden', justifyContent: 'center' }, ruleMark: { position: 'absolute', color: 'rgba(201,135,34,0.13)', fontSize: 130, right: 14, top: -5, fontWeight: '900' }, rule: { color: '#604B31', fontSize: 15, lineHeight: 22, fontWeight: '800', maxWidth: '88%' }, exitButton: { alignItems: 'center', paddingVertical: 13 }, exitText: { color: colors.red, fontWeight: '800', fontSize: 12 }, disabled: { opacity: 0.55 },
});
