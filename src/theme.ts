export const colors = {
  navy: '#123B4A',
  navyDeep: '#082B38',
  night: '#071F2A',
  teal: '#1B6774',
  tealBright: '#2C8B8C',
  sand: '#F7F2E8',
  sandWarm: '#F2E8D7',
  paper: '#FFFDF8',
  amber: '#F5AC3C',
  sun: '#FFD76A',
  orange: '#F28A4B',
  coral: '#E96F5F',
  green: '#4A9272',
  mint: '#CFE8D9',
  blue: '#4D8FBD',
  sky: '#CDE7F7',
  purple: '#7569B3',
  lavender: '#DDD7F5',
  red: '#C95851',
  rose: '#F2D4CF',
  text: '#17333C',
  muted: '#6C7E84',
  mutedSoft: '#95A3A6',
  line: '#DDE5E2',
  lineWarm: '#E9DFCF',
  white: '#FFFFFF',
  black: '#000000',
};

export const gradients = {
  team: [colors.night, colors.navy, colors.teal] as const,
  connection: ['#FFCD61', '#F6A33D', '#EF7A56'] as const,
  story: ['#6C62AA', '#9185CE', '#C9C2EC'] as const,
  football: ['#2D8062', '#53A67B'] as const,
  school: ['#4C7EAB', '#77AAD1'] as const,
  chess: ['#514D8E', '#8178BD'] as const,
  english: ['#E9A43D', '#F7C85E'] as const,
  leadership: ['#C96052', '#E8905C'] as const,
};

export const moduleColors = {
  school: { base: '#E0EEF8', strong: colors.blue, glow: '#B9D9EF' },
  football: { base: '#DCEFE4', strong: colors.green, glow: '#BCE2CB' },
  chess: { base: '#E7E2F6', strong: colors.purple, glow: '#CDC4EE' },
  english: { base: '#FFF1C9', strong: '#C98722', glow: '#FFE099' },
  leadership: { base: '#F7DDD5', strong: colors.coral, glow: '#F4B9AA' },
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
};

export const shadows = {
  soft: {
    shadowColor: colors.night,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  lift: {
    shadowColor: colors.night,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 6,
  },
};
