import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StoryHero } from '../components/StoryHero';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { checkForAppUpdate, installReleaseApk, type UpdateStatus } from '../lib/appUpdater';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

const years = [11, 12, 13, 14, 15, 16, 17, 18];
type InviteResult = { family_id: string; invite_code: string; invite_expires_at: string };

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 11;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 11;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return Math.max(11, Math.min(18, age));
};

export default function UsV2() {
  const { signOut } = useAuth();
  const { family, me, members } = useFamily();
  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const isChild = me?.role === 'child';
  const parentName = parent?.display_name ?? 'Михаил';
  const childName = child?.display_name ?? 'Артур';
  const teamName = family?.name ?? `${parentName} + ${childName}`;
  const age = ageFromBirthDate(child?.birth_date ?? null);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  const createInvite = async () => {
    if (!supabase || !family || me?.role !== 'parent' || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_family_invite', { p_family_id: family.id, p_display_name_hint: childName });
      if (error) throw error;
      setInvite(data as unknown as InviteResult);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось создать приглашение.';
      Alert.alert('Не удалось создать код', message.includes('FAMILY_FULL') ? `${childName} уже подключён к этой команде.` : message);
    } finally {
      setBusy(false);
    }
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
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!updateStatus?.release) {
      Alert.alert('APK ещё публикуется', 'Версия зарегистрирована, но файл обновления пока не опубликован.');
      return;
    }
    try {
      await installReleaseApk(updateStatus.release);
    } catch {
      Alert.alert('Не удалось начать установку', 'Проверь интернет и разрешение Android на установку приложений из этого источника.');
    }
  };

  const exit = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StoryHero
          kicker={isChild ? 'МОЯ КОМАНДА' : 'НАША КОМАНДА'}
          title={isChild ? `${parentName} & ${childName}` : teamName}
          subtitle={isChild
            ? `Это не семейный контроль. Это наше место: то, что мы делаем вместе, чему я учусь и что хочу однажды перечитать.`
            : `В одном месте — ваша связь, рост ${childName}, воспоминания и маленькие традиции, которые со временем станут большой историей.`}
          emblem="🏔️"
          variant="team"
          footer={(
            <View style={styles.heroPeople}>
              <View style={styles.heroPerson}><View style={[styles.avatar, styles.parentAvatar]}><Text style={styles.avatarText}>{parentName.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.heroName}>{parentName}</Text></View>
              <View style={styles.bridge}><View style={styles.bridgeLine} /><View style={styles.bridgeHeart}><Text style={styles.bridgeHeartText}>♥</Text></View><View style={styles.bridgeLine} /></View>
              <View style={styles.heroPerson}><View style={[styles.avatar, styles.childAvatar]}><Text style={styles.avatarText}>{childName.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.heroName}>{childName}</Text></View>
            </View>
          )}
        />

        <View style={[styles.identityCard, shadows.soft]}>
          <Text style={styles.kicker}>КТО МЫ ЗДЕСЬ</Text>
          <View style={styles.memberRow}>
            <View style={[styles.miniAvatar, { backgroundColor: colors.blue }]}><Text style={styles.miniAvatarText}>{parentName.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.memberCopy}><Text style={styles.memberName}>{parentName}</Text><Text style={styles.memberRole}>Папа · рядом, помогает, рассказывает</Text></View>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.divider} />
          <View style={styles.memberRow}>
            <View style={[styles.miniAvatar, { backgroundColor: child ? colors.orange : '#C9C4BA' }]}><Text style={styles.miniAvatarText}>{child ? childName.slice(0, 1).toUpperCase() : '?'}</Text></View>
            <View style={styles.memberCopy}><Text style={styles.memberName}>{childName}</Text><Text style={styles.memberRole}>Сын · растёт, выбирает, пробует</Text></View>
            <View style={[styles.onlineDot, !child && styles.waitingDot]} />
          </View>
        </View>

        {!child && me?.role === 'parent' ? (
          <LinearGradient colors={['#1D5A67', '#357B7D', '#D89A48']} style={[styles.inviteCard, shadows.lift]}>
            <View style={styles.inviteGlow} />
            <Text style={styles.inviteKicker}>ПОДКЛЮЧИТЬ {childName.toUpperCase()}</Text>
            <Text style={styles.inviteTitle}>Два телефона.{`\n`}Одна история.</Text>
            <Text style={styles.inviteText}>Создай одноразовый код и введи его на телефоне сына.</Text>
            {invite ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>КОД ПРИГЛАШЕНИЯ</Text>
                <Text selectable style={styles.code}>{invite.invite_code}</Text>
                <Text style={styles.codeHint}>Действует 7 дней</Text>
              </View>
            ) : null}
            <Pressable disabled={busy} onPress={() => void createInvite()} style={[styles.whiteButton, busy && styles.disabled]}>
              <Text style={styles.whiteButtonText}>{busy ? 'Создаём…' : invite ? 'Создать новый код' : 'Получить код →'}</Text>
            </Pressable>
          </LinearGradient>
        ) : null}

        <View style={styles.sectionHead}>
          <View><Text style={styles.kicker}>НАША ДОГОВОРЁННОСТЬ</Text><Text style={styles.sectionTitle}>Что здесь важно</Text></View>
        </View>
        <View style={styles.valuesRow}>
          {[
            ['👂', 'Слушаем', 'Можно сказать не то, что ожидают услышать.'],
            ['🤝', 'Поддерживаем', 'Помощь — без сравнения и давления.'],
            ['🌱', 'Растём', 'Пауза не обнуляет путь. Ошибки тоже часть истории.'],
          ].map(([icon, title, text]) => (
            <View key={title} style={[styles.valueCard, shadows.soft]}><Text style={styles.valueIcon}>{icon}</Text><Text style={styles.valueTitle}>{title}</Text><Text style={styles.valueText}>{text}</Text></View>
          ))}
        </View>

        <Pressable onPress={() => router.push('/(tabs)/yearbook')} style={[styles.journeyCard, shadows.soft]}>
          <View style={styles.journeyTop}>
            <View><Text style={styles.kicker}>ПУТЬ {childName.toUpperCase()}</Text><Text style={styles.sectionTitle}>11 → 18</Text></View>
            <View style={styles.bookBadge}><Text style={styles.bookBadgeText}>📖</Text></View>
          </View>
          <Text style={styles.journeyText}>Семь лет не как процент выполнения, а как главы: фотографии, мысли, голос, достижения, трудные моменты и ваши встречи.</Text>
          <View style={styles.years}>
            {years.map((year, index) => {
              const active = year === age;
              const passed = year < age;
              return (
                <View key={year} style={styles.yearPart}>
                  <View style={[styles.yearNode, passed && styles.yearPassed, active && styles.yearActive]}><Text style={[styles.yearText, (passed || active) && styles.yearTextBright]}>{year}</Text></View>
                  {index < years.length - 1 ? <View style={[styles.yearLine, passed && styles.yearLinePassed]} /> : null}
                </View>
              );
            })}
          </View>
          <Text style={styles.openBook}>Открыть книгу года →</Text>
        </Pressable>

        <View style={[styles.updateCard, shadows.soft]}>
          <View style={styles.updateIcon}><Text style={styles.updateIconText}>↻</Text></View>
          <View style={styles.updateCopy}>
            <Text style={styles.kicker}>ПРИЛОЖЕНИЕ</Text>
            <Text style={styles.updateTitle}>Обновления</Text>
            <Text style={styles.updateText}>
              {updateStatus?.available
                ? `Доступна версия ${updateStatus.release?.version_name ?? 'новая'}`
                : updateStatus
                  ? `Версия ${updateStatus.currentVersion} актуальна`
                  : 'Можно проверить новую версию прямо здесь'}
            </Text>
          </View>
          {checkingUpdate ? <ActivityIndicator color={colors.navy} /> : (
            <Pressable style={[styles.updateButton, updateStatus?.available && styles.updateButtonReady]} onPress={() => updateStatus?.available ? void installUpdate() : void checkUpdate()}>
              <Text style={[styles.updateButtonText, updateStatus?.available && styles.updateButtonTextReady]}>{updateStatus?.available ? 'Обновить' : 'Проверить'}</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.noteCard, shadows.soft]}>
          <Text style={styles.noteMark}>“</Text>
          <Text style={styles.noteText}>{isChild ? 'Мне не нужно всё делать идеально. Главное — чтобы это был мой настоящий путь.' : 'Приложение должно помогать быть ближе, а не превращать отношения в таблицу показателей.'}</Text>
        </View>

        {supabase ? <Pressable onPress={() => void exit()} style={styles.exitButton}><Text style={styles.exitText}>Выйти из аккаунта</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 34, gap: 16 },
  heroPeople: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  heroPerson: { alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 17, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  parentAvatar: { backgroundColor: colors.blue },
  childAvatar: { backgroundColor: colors.orange },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: '900' },
  heroName: { color: colors.white, fontSize: 9, fontWeight: '900', marginTop: 4 },
  bridge: { width: 110, flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginBottom: 16 },
  bridgeLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.26)' },
  bridgeHeart: { width: 29, height: 29, borderRadius: 15, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  bridgeHeartText: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' },
  identityCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E8DFD1' },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  memberRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11 },
  miniAvatar: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  memberCopy: { flex: 1 },
  memberName: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  memberRole: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  waitingDot: { backgroundColor: colors.amber },
  divider: { height: 1, backgroundColor: '#EEE7DC', marginLeft: 54 },
  inviteCard: { borderRadius: radius.xl, padding: 19, overflow: 'hidden' },
  inviteGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,218,125,0.15)', right: -65, top: -78 },
  inviteKicker: { color: '#D8E7E5', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  inviteTitle: { color: colors.white, fontSize: 25, lineHeight: 27, fontWeight: '900', marginTop: 6 },
  inviteText: { color: '#E0E9E8', fontSize: 10, lineHeight: 15, marginTop: 8, maxWidth: '82%' },
  codeBox: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: 14 },
  codeLabel: { color: '#D8E7E5', fontSize: 8, fontWeight: '900' },
  code: { color: '#FFD774', fontSize: 28, fontWeight: '900', letterSpacing: 1.6, marginTop: 4 },
  codeHint: { color: '#D8E7E5', fontSize: 8, marginTop: 2 },
  whiteButton: { minHeight: 45, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  whiteButtonText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  valuesRow: { flexDirection: 'row', gap: 8 },
  valueCard: { flex: 1, minHeight: 142, borderRadius: 22, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E8DFD1', padding: 12 },
  valueIcon: { fontSize: 24 },
  valueTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900', marginTop: 10 },
  valueText: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 },
  journeyCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: '#E8DFD1' },
  journeyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookBadge: { width: 47, height: 47, borderRadius: 17, backgroundColor: '#FFF0C9', alignItems: 'center', justifyContent: 'center' },
  bookBadgeText: { fontSize: 23 },
  journeyText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },
  years: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  yearPart: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  yearNode: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#E8E3DA', alignItems: 'center', justifyContent: 'center' },
  yearPassed: { backgroundColor: '#77A78E' },
  yearActive: { width: 33, height: 33, borderRadius: 17, backgroundColor: colors.amber, borderWidth: 3, borderColor: '#FFF3D7' },
  yearText: { color: '#8A9694', fontSize: 9, fontWeight: '900' },
  yearTextBright: { color: colors.white },
  yearLine: { flex: 1, height: 2, backgroundColor: '#E8E3DA' },
  yearLinePassed: { backgroundColor: '#A9C7B7' },
  openBook: { color: colors.teal, fontSize: 10, fontWeight: '900', marginTop: 14 },
  updateCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: '#E8DFD1', flexDirection: 'row', alignItems: 'center', gap: 11 },
  updateIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#E2F0F1', alignItems: 'center', justifyContent: 'center' },
  updateIconText: { color: colors.teal, fontSize: 22, fontWeight: '900' },
  updateCopy: { flex: 1 },
  updateTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 2 },
  updateText: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  updateButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13, backgroundColor: '#F1ECE4' },
  updateButtonReady: { backgroundColor: colors.green },
  updateButtonText: { color: colors.navyDeep, fontSize: 9, fontWeight: '900' },
  updateButtonTextReady: { color: colors.white },
  noteCard: { backgroundColor: '#173C4A', borderRadius: radius.xl, padding: 19, overflow: 'hidden' },
  noteMark: { position: 'absolute', right: 17, top: -12, color: 'rgba(255,255,255,0.12)', fontSize: 96, fontWeight: '900' },
  noteText: { color: colors.white, fontSize: 13, lineHeight: 19, fontWeight: '800', maxWidth: '89%' },
  exitButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  exitText: { color: '#A6615C', fontSize: 10, fontWeight: '900' },
});
