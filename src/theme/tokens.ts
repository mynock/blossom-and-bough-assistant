// Mirrors src/theme/tokens.css for use in MUI's createTheme (which can't accept CSS vars).
// Keep in sync when tokens.css changes.

export const moss = {
  950: '#0F1B12',
  900: '#1A2C1F',
  800: '#243C2A',
  700: '#2F5233',
  600: '#3D6A42',
  500: '#4F8455',
  400: '#6B9C72',
  300: '#87A96B',
  200: '#B5C99A',
  100: '#DCE6CA',
  50: '#EFF2E5',
} as const;

export const bark = {
  900: '#2A2018',
  800: '#3A2E1F',
  700: '#4B3D2C',
  600: '#5C4E3D',
} as const;

export const stone = {
  500: '#6B6258',
  400: '#8A8278',
  300: '#A8A095',
  200: '#C9C3B6',
  100: '#E2DDD0',
} as const;

export const paper = {
  parchment: '#F5F1E8',
  mist: '#FAF7EE',
  linen: '#FBFAF4',
  chalk: '#FFFFFF',
} as const;

export const terracotta = {
  700: '#9C4F2E',
  600: '#C2693E',
  500: '#D6825A',
  100: '#F4DDD0',
} as const;

export const honey = {
  600: '#D4A04A',
  100: '#F6E7C4',
} as const;

export const bloom = {
  700: '#8A2E22',
  600: '#A03A2C',
  100: '#F2D7D1',
} as const;

export const sky = {
  700: '#355778',
  600: '#4A6C8C',
  100: '#D8E1EC',
} as const;

export const border = {
  base: 'rgba(58, 46, 31, 0.10)',
  strong: 'rgba(58, 46, 31, 0.18)',
  hairline: 'rgba(58, 46, 31, 0.06)',
} as const;

export const shadow = {
  xs: '0 1px 0 rgba(58,46,31,0.04), 0 1px 2px rgba(58,46,31,0.05)',
  sm: '0 1px 2px rgba(58,46,31,0.05), 0 2px 6px rgba(58,46,31,0.06)',
  md: '0 2px 4px rgba(58,46,31,0.06), 0 8px 16px rgba(58,46,31,0.08)',
  lg: '0 6px 12px rgba(58,46,31,0.08), 0 18px 32px rgba(58,46,31,0.10)',
} as const;

export const fontFamily = {
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;
