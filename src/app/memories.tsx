import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Heading, LoadError, Page, ui } from '../components/Everyday';
import { useFamily } from '../context/FamilyContext';
import { reflectionPageCursor } from '../domain/reflections';
import { supabase } from '../lib/supabase';

type Memory = { id: string; author_user_id: string; prompt: string | null; body: string; created_at: string };
const PAGE_SIZE = 20;

export default function MemoriesScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { family, members } = useFamily();
  const [rows, setRows] = useState<Memory[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);

  const load = useCallback(async (after?: Memory) => {
    const current = ++request.current;
    if (!supabase || !family) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('reflections').select('id,author_user_id,prompt,body,created_at')
        .eq('family_id', family.id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(id ? 1 : PAGE_SIZE);
      if (id) query = query.eq('id', id);
      if (after && !id) {
        query = query.or(reflectionPageCursor(after));
      }
      const result = await query;
      if (result.error) throw result.error;
      if (current !== request.current) return;
      const page = result.data ?? [];
      setRows(previous => after ? [...previous, ...page.filter(row => !previous.some(old => old.id === row.id))] : page);
      setHasMore(!id && page.length === PAGE_SIZE);
    } catch { if (current === request.current) setError('Не удалось загрузить воспоминания. Проверьте интернет и попробуйте снова.'); }
    finally { if (current === request.current) setLoading(false); }
  }, [family?.id, id]);

  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));

  return <Page refreshing={loading} onRefresh={() => void load()}>
    <Heading title={id ? 'Воспоминание' : 'Текстовые воспоминания'} subtitle={id ? undefined : 'Ваши истории и ответы — целиком, в одном месте.'} back />
    {error ? <LoadError message={error} retry={() => void load()} /> : null}
    {!id ? <Button label="Записать воспоминание" onPress={() => router.push({ pathname: '/reflection-new', params: { mode: 'story' } })} /> : null}
    {!loading && !error && !rows.length ? <Card><Text style={ui.body}>{id ? 'Запись не найдена или недоступна вашему аккаунту.' : 'Первая история ещё впереди. Можно начать с нескольких слов о сегодняшнем дне.'}</Text></Card> : null}
    {rows.map(row => <Card key={row.id}>
      <Text style={ui.caption}>{members.find(member => member.user_id === row.author_user_id)?.display_name ?? 'Участник семьи'} · {new Date(row.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      {row.prompt ? <Text style={ui.rowTitle}>{row.prompt}</Text> : null}
      <Text selectable style={ui.body} numberOfLines={id || expanded === row.id ? undefined : 4}>{row.body}</Text>
      {!id ? <Button label={expanded === row.id ? 'Свернуть' : 'Читать полностью'} secondary onPress={() => setExpanded(expanded === row.id ? null : row.id)} /> : null}
    </Card>)}
    {hasMore ? <Button label="Более ранние воспоминания" secondary busy={loading} onPress={() => void load(rows.at(-1))} /> : null}
  </Page>;
}
