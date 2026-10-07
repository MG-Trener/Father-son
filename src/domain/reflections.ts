// Keep PostgreSQL microseconds: converting this cursor to a JS Date would
// skip notes written within the same millisecond at a page boundary.
export function reflectionPageCursor(cursor: { id: string; created_at: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.created_at)
    || Number.isNaN(new Date(cursor.created_at).getTime())) {
    throw new Error('Invalid reflection cursor');
  }
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}
