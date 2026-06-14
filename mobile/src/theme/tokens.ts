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
  vault: '#8B5CF6',
  vaultDim: 'rgba(139,92,246,0.14)',
  text: '#F0F6FC',
  textMuted: '#8B949E',
  textDim: '#6E7681',
};

export type StatusKind = 'ok' | 'out' | 'soon' | 'muted';

export const STATUS_COLORS: Record<StatusKind, string> = {
  ok: TOK.success,
  out: TOK.danger,
  soon: TOK.primary,
  muted: TOK.textMuted,
};
