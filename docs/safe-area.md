# Android safe area policy

`Папа & Я` targets modern Android edge-to-edge layouts. UI content must never depend on fixed status-bar or navigation-bar heights.

Rules:

- The app root is wrapped in `SafeAreaProvider` with `initialWindowMetrics`.
- Tab bar height and bottom padding use `useSafeAreaInsets().bottom`.
- Standalone screens use `SafeAreaView` and include top and bottom edges unless a nested navigator already owns the bottom safe area.
- Tab screens include the top safe area; the bottom safe area is owned by the tab bar.
- Do not hardcode Android status-bar or three-button navigation-bar sizes.
- Keep system bars visible; this app should not use immersive/fullscreen mode for normal screens.
- Test both gesture navigation and three-button navigation before release.
