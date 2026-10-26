const SHARED_THEME = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
  radius: { md: 10, lg: 18, pill: 999 },
  fontSize: { caption: 12, body: 16, title: 28, heading: 36 },
  contentMaxWidth: 520,
} as const;

export const LIGHT_THEME = {
  ...SHARED_THEME,
  scheme: "light",
  colors: {
    background: "#FFF8F2",
    topBar: "rgba(255, 248, 242, 0.94)",
    surface: "#FFFFFF",
    surfaceMuted: "#F8EEE7",
    border: "#E5D6CC",
    text: "#24150F",
    muted: "#6B5147",
    icon: "#000000",
    accent: "#CCB91F",
    accentPressed: "#A39419",
    accentText: "#000000",
    disabled: "#D8C9C0",
    live: "#B42318",
    liveSurface: "#FEE4E2",
    success: "#247151",
    warning: "#7A4B00",
    error: "#B42318",
  },
  shadow: {
    color: "#3B1C10",
    opacity: 0.12,
    radius: 18,
    offset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export const DARK_THEME = {
  ...SHARED_THEME,
  scheme: "dark",
  colors: {
    background: "#171311",
    topBar: "rgba(23, 19, 17, 0.94)",
    surface: "#211B18",
    surfaceMuted: "#2B231F",
    border: "#493A33",
    text: "#FFF8F2",
    muted: "#C7B6AD",
    icon: "#CCB91F",
    accent: "#CCB91F",
    accentPressed: "#A39419",
    accentText: "#000000",
    disabled: "#5E5049",
    live: "#FF8A80",
    liveSurface: "#3A1E1D",
    success: "#72D6A5",
    warning: "#FFD078",
    error: "#FF8A80",
  },
  shadow: {
    color: "#000000",
    opacity: 0.32,
    radius: 18,
    offset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export type AppTheme = typeof LIGHT_THEME | typeof DARK_THEME;
