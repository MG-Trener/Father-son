import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ownerConfirmationRedirect, parseAccountAccess, type AccountAccess } from '../domain/ownerAccess';
import { supabase } from '../lib/supabase';
import { Button, Card, Page, ui } from './Everyday';

export function AccountAccessGate({ children }: PropsWithChildren) {
  const { session, loading, signOut, linkError } = useAuth();
  const [access, setAccess] = useState<AccountAccess | null>(null);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const currentToken = useRef(session?.access_token);
  currentToken.current = session?.access_token;
  const check = useCallback(async () => {
    const token = session?.access_token;
    if (!supabase || !token) return;
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_account_access');
      if (rpcError) throw rpcError;
      if (currentToken.current === token) { setAccess(parseAccountAccess(data)); setVerifiedToken(token); }
    } catch {
      if (currentToken.current === token) { setAccess(null); setError('Не удалось проверить доступ. Проверьте интернет и повторите попытку.'); }
    }
  }, [session?.access_token]);
  useEffect(() => { setAccess(null); setSent(false); void check(); }, [check]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => listener.remove();
  }, [check]);
  const send = async () => {
    if (!supabase || !session?.user.email || busy) return;
    if (Date.now() < retryAt) { setError('Повторное письмо можно запросить через минуту.'); return; }
    setBusy(true); setError(null);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({ email: session.user.email,
        options: { shouldCreateUser: false, emailRedirectTo: ownerConfirmationRedirect } });
      if (sendError) throw sendError;
      setSent(true); setRetryAt(Date.now() + 60_000);
    } catch { setError('Не удалось отправить письмо. Подождите минуту и попробуйте ещё раз.'); }
    finally { setBusy(false); }
  };
  if (!supabase || (!loading && !session)) return children;
  if (!loading && access && verifiedToken === session?.access_token && !access.requiresConfirmation) return children;
  return <Page><Text style={ui.brand}>Папа & Я</Text>
    <Text style={ui.title}>{access?.requiresConfirmation ? 'Подтвердите вход папы' : 'Проверяем доступ'}</Text>
    {access?.requiresConfirmation ? <Card tone="warm">
      <Text style={ui.body}>Роль папы уже закреплена за вашим аккаунтом. Для нового входа нужно подтверждение владельца.</Text>
      <Text style={ui.rowTitle}>{session?.user.email}</Text>
      <Text style={ui.body}>{sent ? 'Письмо отправлено. Откройте его на этом телефоне и нажмите ссылку входа. Приложение откроется автоматически.' : 'Отправим одноразовую ссылку на вашу почту. Откройте письмо на этом телефоне и подтвердите вход.'}</Text>
      <Button label={sent ? 'Отправить письмо ещё раз' : 'Отправить письмо для подтверждения'} busy={busy} onPress={() => void send()} />
    </Card> : null}
    {error || linkError ? <Text accessibilityRole="alert" style={ui.body}>{linkError || error}</Text> : null}
    {session ? <><Button label="Проверить подтверждение" secondary onPress={() => void check()} /><Button label="Войти в другой аккаунт" secondary onPress={() => void signOut()} /></> : null}
  </Page>;
}
