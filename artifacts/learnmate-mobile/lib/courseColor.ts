import colors from '@/constants/colors';

// The API returns Tailwind-style colour tokens (e.g. "sky", "amber") for each
// course topic. React Native needs real colour values, so normalize here.
const TAILWIND_TOKEN_HEX: Record<string, string> = {
  sky: '#0EA5E9',
  amber: '#F59E0B',
  green: '#22C55E',
  violet: '#8B5CF6',
  rose: '#F43F5E',
  teal: '#14B8A6',
  blue: '#3B82F6',
  indigo: '#6366F1',
  purple: '#A855F7',
  pink: '#EC4899',
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  lime: '#84CC16',
  emerald: '#10B981',
  cyan: '#06B6D4',
  fuchsia: '#D946EF',
  slate: '#64748B',
  gray: '#6B7280',
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Resolve a course accent colour to a valid 6-digit hex value.
 * Priority: valid hex from API → known Tailwind token from API →
 * local per-slug palette → provided fallback.
 * Always returns a hex string safe for alpha-suffix concatenation (e.g. + '22').
 */
export function resolveCourseColor(
  apiColor: string | undefined,
  slug: string,
  fallback: string,
): string {
  if (apiColor) {
    if (HEX_RE.test(apiColor)) {
      // Expand 3-digit hex so alpha suffixing stays valid
      if (apiColor.length === 4) {
        return (
          '#' +
          apiColor[1] + apiColor[1] +
          apiColor[2] + apiColor[2] +
          apiColor[3] + apiColor[3]
        );
      }
      return apiColor;
    }
    const token = TAILWIND_TOKEN_HEX[apiColor.toLowerCase()];
    if (token) return token;
  }
  return (colors.courses as Record<string, string>)[slug] ?? fallback;
}
