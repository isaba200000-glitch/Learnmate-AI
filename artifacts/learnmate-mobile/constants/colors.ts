/**
 * LearnMate AI – dark navy palette derived from the web app's .dark CSS theme.
 * HSL source values are included as comments so they stay in sync with index.css.
 */

const colors = {
  dark: {
    // Core surfaces
    background: '#080F1E',       // HSL(222, 60%, 7%)
    foreground: '#EDF2FC',       // HSL(210, 40%, 97%)

    // Elevated surfaces
    card: '#0F1929',             // HSL(222, 50%, 11%)
    cardForeground: '#EDF2FC',
    cardBorder: '#1B2D4A',       // HSL(220, 40%, 18%)

    // Primary action – electric blue
    primary: '#4D93F5',          // HSL(217, 91%, 62%)
    primaryForeground: '#080F1E',
    primaryLight: '#7BB3F9',     // lighter tint for glass effects

    // Secondary surfaces
    secondary: '#142133',        // HSL(222, 40%, 15%)
    secondaryForeground: '#CAD5EA',

    // Muted / subdued
    muted: '#142133',
    mutedForeground: '#8FA3BF',  // HSL(220, 20%, 62%)

    // Accent – indigo-violet
    accent: '#6B7EF7',           // HSL(232, 80%, 68%)
    accentForeground: '#080F1E',

    // Destructive
    destructive: '#E53935',
    destructiveForeground: '#FFFFFF',

    // Borders & inputs
    border: '#1B2D4A',
    input: '#142133',

    // Semantic extras
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#4D93F5',

    // Legacy aliases
    text: '#EDF2FC',
    tint: '#4D93F5',
  },

  // Course accent colors
  courses: {
    robotics: '#F59E0B',
    electronics: '#8B5CF6',
    python: '#22C55E',
    cpp: '#3B82F6',
    'ai-ml': '#EC4899',
    'coding-basics': '#F97316',
  } as Record<string, string>,

  // Border radius (px) – matches --radius: 1rem from web CSS
  radius: 14,
};

export default colors;
