// MedScout hi-fi — design tokens, primitives, icons

const TOK = {
  bg: "#0D1117",
  surface: "#161B22",
  surface2: "#1C232C",
  border: "#30363D",
  borderSoft: "#21262D",
  primary: "#F97316",
  primaryGlow: "rgba(249,115,22,0.18)",
  primaryDim: "rgba(249,115,22,0.10)",
  success: "#22C55E",
  successDim: "rgba(34,197,94,0.12)",
  danger: "#EF4444",
  dangerDim: "rgba(239,68,68,0.12)",
  vault: "#8B5CF6",
  vaultDim: "rgba(139,92,246,0.14)",
  text: "#F0F6FC",
  textMuted: "#8B949E",
  textDim: "#6E7681",
};

// ───────── Phone shell (iPhone-ish, dark, MedScout-tuned) ─────────
const Phone = ({ children, w = 390, h = 800, time = "9:41", showStatusBar = true, onTap, dataAttrs = {} }) => (
  <div
    style={{
      width: w, height: h, borderRadius: 48, overflow: "hidden",
      position: "relative", background: "#000",
      boxShadow: "0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 0 8px #1a1a1a",
      fontFamily: "'Lexend', system-ui, sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}
    onClick={onTap}
    {...dataAttrs}
  >
    {/* dynamic island */}
    <div style={{
      position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)",
      width: 120, height: 35, borderRadius: 22, background: "#000", zIndex: 50,
    }} />
    {/* screen content */}
    <div style={{
      position: "absolute", inset: 0,
      background: TOK.bg, color: TOK.text,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {showStatusBar && (
        <div style={{
          height: 54, paddingTop: 18,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 32px 0",
          fontSize: 15, fontWeight: 600, color: TOK.text, letterSpacing: -0.2,
          flexShrink: 0,
        }}>
          <span>{time}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.signal/> <Icon.wifi/> <Icon.battery/>
          </div>
        </div>
      )}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
    </div>
    {/* home indicator */}
    <div style={{
      position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
      width: 134, height: 5, borderRadius: 100, background: "rgba(255,255,255,0.5)", zIndex: 60,
    }} />
  </div>
);

// ───────── Icons (line, 24px) ─────────
const ic = (path, { size = 22, stroke = "currentColor", fill = "none", sw = 1.8, viewBox = "0 0 24 24" } = {}) =>
  <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{path}</svg>;

const Icon = {
  home:    (p={}) => ic(<><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></>, p),
  phone:   (p={}) => ic(<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>, p),
  map:     (p={}) => ic(<><path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3-7 3z"/><path d="M8 3v15M16 6v15"/></>, p),
  user:    (p={}) => ic(<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>, p),
  doc:     (p={}) => ic(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></>, p),
  lock:    (p={}) => ic(<><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>, p),
  plus:    (p={}) => ic(<><path d="M12 5v14M5 12h14"/></>, p),
  bolt:    (p={}) => ic(<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>, { ...p, fill: "currentColor" }),
  check:   (p={}) => ic(<path d="M5 13l4 4L19 7"/>, p),
  x:       (p={}) => ic(<path d="M6 6l12 12M18 6L6 18"/>, p),
  alert:   (p={}) => ic(<><path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>, p),
  back:    (p={}) => ic(<><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></>, p),
  edit:    (p={}) => ic(<><path d="M17 3a2.83 2.83 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></>, p),
  spark:   (p={}) => ic(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></>, p),
  share:   (p={}) => ic(<><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><path d="M16 6l-4-4-4 4M12 2v13"/></>, p),
  clock:   (p={}) => ic(<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>, p),
  pin:     (p={}) => ic(<><path d="M12 22s-7-7-7-13a7 7 0 0114 0c0 6-7 13-7 13z"/><circle cx="12" cy="9" r="2.5"/></>, p),
  filter:  (p={}) => ic(<path d="M3 4h18l-7 9v6l-4 2v-8L3 4z"/>, p),
  signal:  () => <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="#F0F6FC"/><rect x="4.5" y="5" width="3" height="6" rx="1" fill="#F0F6FC"/><rect x="9" y="3" width="3" height="8" rx="1" fill="#F0F6FC"/><rect x="13.5" y="0" width="3" height="11" rx="1" fill="#F0F6FC"/></svg>,
  wifi:    () => <svg width="17" height="12" viewBox="0 0 17 12" fill="#F0F6FC"><path d="M8.5 3.2a8 8 0 015.7 2.3l1-1A9.5 9.5 0 008.5 1.7 9.5 9.5 0 001.8 4.5l1 1a8 8 0 015.7-2.3z"/><path d="M8.5 6.5a4.7 4.7 0 013.4 1.4l1-1a6.2 6.2 0 00-8.8 0l1 1A4.7 4.7 0 018.5 6.5z"/><circle cx="8.5" cy="10" r="1.5"/></svg>,
  battery: () => <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#F0F6FC" strokeOpacity="0.45" fill="none"/><rect x="2" y="2" width="19" height="8" rx="1.6" fill="#F0F6FC"/><rect x="23.5" y="3.5" width="2" height="5" rx="1" fill="#F0F6FC" fillOpacity="0.45"/></svg>,
  drag:    (p={}) => ic(<><circle cx="9" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="18" r="1.5" fill="currentColor"/><circle cx="15" cy="18" r="1.5" fill="currentColor"/></>, { ...p, sw: 0 }),
  minus:   (p={}) => ic(<path d="M5 12h14"/>, p),
  rotate:  (p={}) => ic(<><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/></>, p),
  bell:    (p={}) => ic(<><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></>, p),
  faceid:  (p={}) => ic(<><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><path d="M9 9v1M15 9v1M9 15s1 1.5 3 1.5S15 15 15 15M12 9v3.5h-1"/></>, p),
  pill:    (p={}) => ic(<><rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-30 12 12)"/><path d="M8.5 8.5l7 7" transform="rotate(-30 12 12)"/></>, p),
  flame:   (p={}) => ic(<path d="M12 2s4 4 4 8a4 4 0 11-8 0c0-1 .5-2 1-3 0 0 0 3 2 3s2-2 1-4-2-3-2-4 1-1 2 0z"/>, { ...p, fill: "currentColor" }),
  trophy:  (p={}) => ic(<><path d="M6 4h12v4a6 6 0 01-12 0V4z"/><path d="M6 6H3a3 3 0 003 3M18 6h3a3 3 0 01-3 3M9 17h6M10 17v3h4v-3"/></>, p),
  search:  (p={}) => ic(<><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>, p),
  arrow:   (p={}) => ic(<><path d="M5 12h14M13 6l6 6-6 6"/></>, p),
  star:    (p={}) => ic(<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/>, p),
};

// ───────── Tab bar ─────────
const TabBar = ({ active = "home", onChange = () => {} }) => {
  const tabs = [
    { id: "home", label: "Home", icon: Icon.home },
    { id: "hunt", label: "Hunt", icon: Icon.phone },
    { id: "map",  label: "Map",  icon: Icon.map },
    { id: "me",   label: "Me",   icon: Icon.user },
  ];
  return (
    <div style={{
      borderTop: `0.5px solid ${TOK.border}`,
      background: "rgba(13,17,23,0.92)",
      backdropFilter: "blur(20px)",
      padding: "8px 12px 22px",
      display: "flex", justifyContent: "space-around",
      flexShrink: 0,
    }}>
      {tabs.map(t => {
        const a = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: "none", border: "none", padding: "6px 10px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: a ? TOK.primary : TOK.textMuted,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <t.icon size={24} sw={a ? 2.2 : 1.8}/>
            <span style={{ fontSize: 10, fontWeight: a ? 600 : 500, letterSpacing: 0.1 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ───────── Card primitives ─────────
const Card = ({ children, style = {}, accent = false, danger = false, success = false, onClick }) => (
  <div onClick={onClick} style={{
    background: TOK.surface,
    border: `1px solid ${accent ? TOK.primary : danger ? TOK.danger : success ? TOK.success : TOK.border}`,
    borderRadius: 14,
    padding: 14,
    cursor: onClick ? "pointer" : "default",
    ...style,
  }}>{children}</div>
);

const Btn = ({ children, onClick, variant = "primary", size = "md", full = true, style = {}, disabled = false, dataAttrs = {} }) => {
  const sizes = {
    sm: { padding: "8px 14px", fontSize: 13, h: 36 },
    md: { padding: "12px 18px", fontSize: 15, h: 48 },
    lg: { padding: "16px 20px", fontSize: 16, h: 56 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg: TOK.primary, color: "#0D1117", border: TOK.primary, shadow: `0 4px 16px ${TOK.primaryGlow}` },
    success: { bg: TOK.success, color: "#0D1117", border: TOK.success, shadow: "0 4px 16px rgba(34,197,94,0.2)" },
    ghost:   { bg: "transparent", color: TOK.textMuted, border: TOK.border, shadow: "none" },
    outline: { bg: "transparent", color: TOK.primary, border: TOK.primary, shadow: "none" },
    dark:    { bg: TOK.surface2, color: TOK.text, border: TOK.border, shadow: "none" },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} disabled={disabled} {...dataAttrs} style={{
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
      borderRadius: 12, padding: s.padding, fontSize: s.fontSize, fontWeight: 600,
      minHeight: s.h, width: full ? "100%" : "auto",
      fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, boxShadow: v.shadow,
      letterSpacing: -0.1,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      ...style,
    }}>{children}</button>
  );
};

const Badge = ({ children, kind = "muted", style = {} }) => {
  const kinds = {
    success: { c: TOK.success, bg: TOK.successDim },
    danger:  { c: TOK.danger, bg: TOK.dangerDim },
    primary: { c: TOK.primary, bg: TOK.primaryDim },
    vault:   { c: TOK.vault, bg: TOK.vaultDim },
    muted:   { c: TOK.textMuted, bg: "rgba(139,148,158,0.1)" },
  };
  const k = kinds[kind];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      color: k.c, background: k.bg, letterSpacing: 0.1,
      ...style,
    }}>{children}</span>
  );
};

// Status with text + dot (never color alone — accessibility rule)
const Status = ({ kind = "muted", label, style = {} }) => {
  const map = {
    ok: { c: TOK.success, t: label || "in stock" },
    out: { c: TOK.danger, t: label || "out" },
    soon: { c: TOK.primary, t: label || "check back" },
    muted: { c: TOK.textMuted, t: label || "—" },
  };
  const s = map[kind];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: s.c, fontWeight: 500, ...style }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: s.c }}/>
      {s.t}
    </span>
  );
};

Object.assign(window, { TOK, Phone, Icon, TabBar, Card, Btn, Badge, Status });
