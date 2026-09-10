import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppCard } from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../theme';

const years = ['11', '12', '13', '14', '15', '16', '17', '18'];

type InviteResult = {
  family_id: string;
  invite_code: string;
  invite_expires_at: string;
};

export default function UsScreen() {
  const { signOut } = useAuth();
  const { family, me, members } = useFamily();
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [busy, setBusy] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent'), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);
  const teamName = family?.name ?? 'Михаил + Артур';

  const createInvite = async () => {
    if (!supabase || !family || me?.role !== 'parent' || busy) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_family_invite', {
        p_family_id: family.id,
        p_display_name_hint: 'Артур',
      });
      if (error) throw error;
      setInvite(data as unknown as InviteResult);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось создать приглашение.';
      Alert.alert('Не удалось создать код', message.includes('FAMILY_FULL') ? 'Артур уже подключён к этой команде.' : message);
    } finally {
      setBusy(false);
    }
  };

  const exit = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Мы</Text>
        <Text style={styles.subtitle}>{teamName}</Text>

        <View style={styles.hero}>
          <Text style={styles.heroKicker}>КОМАНДА</Text>
          <Text style={styles.heroTitle}>Напарники</Text>
          <Text style={styles.heroText}>Уровень 1 · начало большой истории</Text>
        </View>

        <AppCard title="Участники" subtitle="Отдельные аккаунты, одно приватное пространство">
          <View style={styles.memberRow}>
            <Text style={styles.memberIcon}>🙂</Text>
            <View style={styles.memberText}>
              <Text style={styles.memberName}>{parent?.display_name ?? 'Михаил'}</Text>
              <Text style={styles.memberRole}>Папа</Text>
            </View>
            <Text style={styles.connected}>Подключён</Text>
          </View>
          <View style={styles.memberRow}>
            <Text style={styles.memberIcon}>{child ? '😎' : '○'}</Text>
            <View style={styles.memberText}>
              <Text style={styles.memberName}>{child?.display_name ?? 'Артур'}</Text>
              <Text style={styles.memberRole}>Сын</Text>
            </View>
            <Text style={child ? styles.connected : styles.waiting}>{child ? 'Подключён' : 'Ожидает код'}</Text>
          </View>
        </AppCard>

        {!child && me?.role === 'parent' ? (
          <AppCard title="Подключить Артура" subtitle="Новый код делает предыдущий недействительным">
            {invite ? (
              <View style={styles.inviteBox}>
                <Text style={styles.inviteLabel}>КОД ДЛЯ ВТОРОГО ТЕЛЕФОНА</Text>
                <Text selectable style={styles.inviteCode}>{invite.invite_code}</Text>
                <Text style={styles.inviteHint}>Одноразовый · действует 7 дней</Text>
              </View>
            ) : null}
            <Pressable style={[styles.primary, busy && styles.disabled]} onPress={() => void createInvite()} disabled={busy}>
              <Text style={styles.primaryText}>{busy ? 'Создаём…' : invite ? 'Создать новый код' : 'Получить код для Артура'}</Text>
            </Pressable>
          </AppCard>
        ) : null}

        <AppCard title="Путь Артура" subtitle="Это не шкала выполнения. Это годы, которые будут наполняться воспоминаниями.">
          <View style={styles.years}>
            {years.map((year, index) => (
              <View key={year} style={[styles.year, index === 0 && styles.yearActive]}>
                <Text style={[styles.yearText, index === 0 && styles.yearTextActive]}>{year}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        <AppCard title="Будущие артефакты пути">
          <Text style={styles.artifact}>♟ Шахматный конь · первая большая шахматная веха</Text>
          <Text style={styles.artifact}>⚽ Капитанская повязка · лидерство на поле</Text>
          <Text style={styles.artifact}>🧭 Компас · серьёзное самостоятельное решение</Text>
          <Text style={styles.artifact}>❤️ Фото · важный день Михаила и Артура</Text>
        </AppCard>

        <AppCard title="Главное правило">
          <Text style={styles.rule}>XP — для атмосферы. Настоящие достижения сохраняют реальные события, выборы, усилия, мысли и голос.</Text>
        </AppCard>

        {supabase ? (
          <Pressable onPress={() => void exit()} style={styles.exitButton}>
            <Text style={styles.exitText}>Выйти из аккаунта</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 32, gap: 15 },
  title: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: -9 },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 22 },
  heroKicker: { color: '#C9D7D7', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { color: colors.white, fontSize: 31, fontWeight: '900', marginTop: 3 },
  heroText: { color: '#E7EEEE', marginTop: 5, fontSize: 13 },
  memberRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  memberIcon: { width: 34, fontSize: 24, textAlign: 'center' },
  memberText: { flex: 1 },
  memberName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  memberRole: { color: colors.muted, fontSize: 12, marginTop: 2 },
  connected: { color: colors.green, fontSize: 11, fontWeight: '900' },
  waiting: { color: colors.amber, fontSize: 11, fontWeight: '900' },
  inviteBox: { backgroundColor: colors.navy, borderRadius: radius.md, padding: 17, alignItems: 'center', gap: 5 },
  inviteLabel: { color: '#C9D7D7', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  inviteCode: { color: colors.white, fontSize: 26, fontWeight: '900', letterSpacing: 1.5 },
  inviteHint: { color: '#D7E1E2', fontSize: 11 },
  primary: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.55 },
  years: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  year: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  yearActive: { backgroundColor: colors.amber },
  yearText: { color: colors.muted, fontWeight: '900' },
  yearTextActive: { color: colors.navyDeep },
  artifact: { color: colors.text, fontSize: 13, lineHeight: 20 },
  rule: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  exitButton: { alignItems: 'center', paddingVertical: 13 },
  exitText: { color: colors.red, fontWeight: '800', fontSize: 13 },
});
