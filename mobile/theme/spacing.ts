// DESIGN.md spacing system — 4px rhythm base
// space-xs=4, space-sm=8, space-md=12, space-lg=16, space-xl=24, space-2xl=32, space-3xl=48

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
  gutter: 16,
  gutterDesktop: 24,
  margin: 16,
  marginTablet: 24,
  marginDesktop: 32,
};

export const radii = {
  sm: 6,
  DEFAULT: 8,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// DESIGN.md elevation / shadow system
export const elevation = {
  // Level 0 — Canvas base, no shadow
  none: {
    shadowOpacity: 0,
  },
  // Level 1 — Card & module surfaces
  low: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  // Level 2 — Active states & interactive tooltips
  medium: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  // Level 3 — Diagnostic drawers & dialogs
  high: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 5,
  },
};
