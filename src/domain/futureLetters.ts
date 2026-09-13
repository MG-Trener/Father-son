export type FutureLetterAccess = 'draft-owner' | 'sealed-wait' | 'sealed-open' | 'forbidden';

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
