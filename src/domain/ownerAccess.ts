export type AccountAccess = { isOwner: boolean; requiresConfirmation: boolean };

export function parseAccountAccess(value: unknown): AccountAccess {
  if (!value || typeof value !== 'object' || !('is_owner' in value) || !('requires_confirmation' in value)
    || typeof value.is_owner !== 'boolean' || typeof value.requires_confirmation !== 'boolean') {
    throw new Error('Не удалось проверить доступ к аккаунту. Повторите попытку.');
  }
  return { isOwner: value.is_owner, requiresConfirmation: value.requires_confirmation };
}

export const ownerConfirmationRedirect = 'papaiya://auth-callback';

export function parseOwnerCallback(rawUrl: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== 'papaiya:' || url.hostname !== 'auth-callback' || !['', '/'].includes(url.pathname)) return null;
  const params = new URLSearchParams(url.hash.slice(1));
  if (params.has('error') || params.has('error_code') || url.searchParams.has('error')) {
    throw new Error('Ссылка устарела или уже использована. Запросите новое письмо.');
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}
