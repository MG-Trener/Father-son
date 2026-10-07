type Person = { user_id: string; role: 'parent' | 'child'; display_name: string };

export function familyPresentation(members: Person[], me: Person | null, fallbackRole: 'parent' | 'child' = 'parent') {
  const isChild = (me?.role ?? fallbackRole) === 'child';
  const parent = members.find(member => member.role === 'parent');
  const child = members.find(member => member.role === 'child');
  const other = isChild ? parent : child;
  return {
    isChild, parent, child, other,
    myName: me?.display_name || (isChild ? 'сын' : 'папа'),
    otherName: other?.display_name || (isChild ? 'папа' : 'сын'),
    childName: child?.display_name || 'сына',
  };
}

export function localDay(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function moodIsToday(createdAt: string, today = new Date()) {
  const date = new Date(createdAt);
  return !Number.isNaN(date.getTime()) && localDay(date) === localDay(today);
}
