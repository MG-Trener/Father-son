export const brandAssets = {
  actions: {
    mood: require('../assets/generated/action-mood.png'),
    news: require('../assets/generated/action-news.png'),
    memories: require('../assets/generated/action-memories.png'),
    timeline: require('../assets/generated/action-timeline.png'),
    yearbook: require('../assets/generated/action-yearbook.png'),
    rituals: require('../assets/generated/action-rituals.png'),
  },
  app: {
    icon: require('../assets/generated/app-icon.png'),
    monochromeIcon: require('../assets/generated/app-icon-monochrome.png'),
    splash: require('../assets/generated/splash-screen.png'),
    familyHero: require('../assets/generated/family-hero.webp'),
  },
  navigation: {
    home: require('../assets/generated/nav-home.png'),
    growth: require('../assets/generated/nav-growth.png'),
    book: require('../assets/generated/nav-book.png'),
    together: require('../assets/generated/nav-together.png'),
    us: require('../assets/generated/nav-us.png'),
  },
  directions: {
    school: require('../assets/generated/direction-school.png'),
    football: require('../assets/generated/direction-football.png'),
    chess: require('../assets/generated/direction-chess.png'),
    english: require('../assets/generated/direction-english.png'),
    leadership: require('../assets/generated/direction-leadership.png'),
  },
  features: {
    home: require('../assets/generated/feature-home.png'),
    path: require('../assets/generated/feature-path.png'),
    book: require('../assets/generated/feature-book.png'),
    together: require('../assets/generated/feature-together.png'),
    family: require('../assets/generated/feature-family.png'),
  },
  utility: {
    letter: require('../assets/generated/utility-letter.png'),
    calendar: require('../assets/generated/utility-calendar.png'),
    voice: require('../assets/generated/utility-voice.png'),
    agreements: require('../assets/generated/utility-agreements.png'),
    goal: require('../assets/generated/utility-goal.png'),
    recognition: require('../assets/generated/utility-recognition.png'),
  },
  badges: {
    school: require('../assets/generated/badge-school.png'),
    football: require('../assets/generated/badge-football.png'),
    chess: require('../assets/generated/badge-chess.png'),
    english: require('../assets/generated/badge-english.png'),
    adventure: require('../assets/generated/badge-adventure.png'),
    team: require('../assets/generated/badge-team.png'),
    courage: require('../assets/generated/badge-courage.png'),
    planner: require('../assets/generated/badge-planner.png'),
  },
  decor: {
    atlas: require('../assets/generated/decor-atlas.png'),
  },
} as const;

export type GrowthDirection = keyof typeof brandAssets.directions;
export type BrandBadge = keyof typeof brandAssets.badges;
