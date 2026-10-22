export const TOK = {
  bg: '#0D1117',
  surface: '#161B22',
  surface2: '#1C232C',
  border: '#30363D',
  borderSoft: '#21262D',
  primary: '#F97316',
  primaryGlow: 'rgba(249,115,22,0.18)',
  primaryDim: 'rgba(249,115,22,0.10)',
  success: '#22C55E',
  successDim: 'rgba(34,197,94,0.12)',
  danger: '#EF4444',
  dangerDim: 'rgba(239,68,68,0.12)',
  // Lightened from the original #8B5CF6/#6E7681 2026-10 -- both were below
  // WCAG AA's 4.5:1 minimum for normal-size text against surface2, the
  // darkest of the three backgrounds these sit on (vault was 4.47:1,
  // textDim as low as 3.45:1 at the 9-13px sizes it's actually used at).
  // Minimal lightness-only adjustment, same hue, verified >=4.5:1 against
  // bg/surface/surface2 all three.
  vault: '#996FF7',
  vaultDim: 'rgba(139,92,246,0.14)',
  text: '#F0F6FC',
  textMuted: '#8B949E',
  textDim: '#828A94',
};

export type StatusKind = 'ok' | 'out' | 'soon' | 'muted';

export const STATUS_COLORS: Record<StatusKind, string> = {
  ok: TOK.success,
  out: TOK.danger,
  soon: TOK.primary,
  muted: TOK.textMuted,
};
