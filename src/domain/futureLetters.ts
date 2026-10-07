export type FutureLetterAccess = 'draft-owner' | 'sealed-wait' | 'sealed-open' | 'forbidden';

type LetterMember = { user_id: string; role: string; display_name: string; birth_date: string | null };

// Always show both possibilities; a missing relative is never replaced with the author.
export const futureLetterRecipients = (members: readonly LetterMember[], me: LetterMember | null) => {
  const relativeRole = me?.role === 'child' ? 'parent' : 'child';
  const relative = members.find(member => member.role === relativeRole && member.user_id !== me?.user_id);
  return [
    { id: me?.user_id ?? null, label: 'Себе', name: me?.display_name ?? 'Я в будущем', birthDate: me?.birth_date ?? null, role: me?.role ?? 'parent' },
    { id: relative?.user_id ?? null, label: relativeRole === 'parent' ? 'Папе' : 'Сыну', name: relative?.display_name ?? 'Ещё не подключён', birthDate: relative?.birth_date ?? null, role: relativeRole },
  ] as const;
};

export type FutureLetterAccessInput = {
  status: string;
  unlockAt: string;
  authorUserId: string;
  recipientUserId: string;
};

export const isFutureLetterUnlocked = (
  status: string,
  unlockAt: string,
  nowMs = Date.now(),
): boolean => status === 'sealed' && new Date(unlockAt).getTime() <= nowMs;

export const daysUntilFutureLetterUnlock = (unlockAt: string, nowMs = Date.now()): number => {
  const unlockMs = new Date(unlockAt).getTime();
  if (!Number.isFinite(unlockMs)) return 0;
  return Math.max(0, Math.ceil((unlockMs - nowMs) / 86_400_000));
};

export const futureLetterAccess = (
  letter: FutureLetterAccessInput,
  userId: string | null | undefined,
  nowMs = Date.now(),
): FutureLetterAccess => {
  if (!userId) return 'forbidden';

  if (letter.status === 'draft') {
    return letter.authorUserId === userId ? 'draft-owner' : 'forbidden';
  }

  if (letter.status !== 'sealed') return 'forbidden';
  if (letter.authorUserId !== userId && letter.recipientUserId !== userId) return 'forbidden';
  return isFutureLetterUnlocked(letter.status, letter.unlockAt, nowMs) ? 'sealed-open' : 'sealed-wait';
};
