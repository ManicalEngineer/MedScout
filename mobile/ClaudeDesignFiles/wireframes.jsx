// MedScout — Low-fi wireframe sketches
// Hand-drawn vibe, b&w with sparing orange accent, exploring layout variations

const ACCENT = "#F97316";
const INK = "#1a1a1a";
const PAPER = "#fafaf6";
const MUTE = "#9a958a";
const SOFT = "#e8e4d8";
const SUCCESS = "#22a05a";
const DANGER = "#dc4242";
const VAULT = "#7a55d6";

// ============ Phone frame ============
const Phone = ({ children, label, w = 300, h = 620, dark = true }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
    <div style={{
      width: w, height: h,
      background: dark ? "#0D1117" : PAPER,
      border: `2.5px solid ${INK}`,
      borderRadius: 32,
      padding: "28px 14px 18px",
      position: "relative",
      boxShadow: "3px 4px 0 rgba(0,0,0,0.08)",
      fontFamily: "'Kalam', cursive",
      color: dark ? "#F0F6FC" : INK,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Notch */}
      <div style={{
        position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
        width: 90, height: 16, background: INK, borderRadius: 10,
      }}></div>
      {children}
    </div>
    {label && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: INK, fontWeight: 700 }}>{label}</div>}
  </div>
);

// Tab bar shared across screens
const TabBar = ({ active = "home" }) => {
  const tabs = [
    { id: "home", label: "home" },
    { id: "hunt", label: "hunt" },
    { id: "map", label: "map" },
    { id: "me", label: "me" },
  ];
  return (
    <div style={{
      display: "flex", justifyContent: "space-around", alignItems: "center",
      borderTop: `1.5px dashed ${MUTE}`, paddingTop: 8, marginTop: "auto",
      fontFamily: "'Kalam', cursive", fontSize: 13,
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          color: active === t.id ? ACCENT : "#8B949E",
          fontWeight: active === t.id ? 700 : 400,
        }}>
          <div style={{
            width: 22, height: 22, border: `1.5px solid ${active === t.id ? ACCENT : "#8B949E"}`,
            borderRadius: 6,
          }}></div>
          {t.label}
        </div>
      ))}
    </div>
  );
};

// Dashed/scribble box
const Box = ({ children, style = {}, dashed = false, accent = false, danger = false, soft = false }) => (
  <div style={{
    border: `1.5px ${dashed ? "dashed" : "solid"} ${accent ? ACCENT : danger ? DANGER : soft ? "#3a4150" : "#5a6070"}`,
    borderRadius: 10,
    padding: "10px 12px",
    background: soft ? "rgba(255,255,255,0.03)" : "transparent",
    ...style,
  }}>{children}</div>
);

// Scribbled circle progress ring
const Ring = ({ days = 6, size = 130, color = ACCENT }) => {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = Math.min(days / 14, 1);
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#3a4150" strokeWidth="6" strokeDasharray="3 4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="48%" textAnchor="middle" fill="#F0F6FC" fontSize="38" fontFamily="'Caveat', cursive" fontWeight="700">{days}</text>
      <text x="50%" y="65%" textAnchor="middle" fill="#8B949E" fontSize="11" fontFamily="'Kalam', cursive">days left</text>
    </svg>
  );
};

const Pill = ({ children, color = "#5a6070", bg = "transparent", style = {} }) => (
  <span style={{
    border: `1.2px solid ${color}`, color, background: bg,
    padding: "2px 8px", borderRadius: 10, fontSize: 11, fontFamily: "'Kalam', cursive",
    display: "inline-block", whiteSpace: "nowrap", ...style,
  }}>{children}</span>
);

const Btn = ({ children, primary = false, ghost = false, full = true, style = {} }) => (
  <div style={{
    border: `1.5px solid ${primary ? ACCENT : ghost ? "#5a6070" : "#5a6070"}`,
    background: primary ? ACCENT : "transparent",
    color: primary ? "#0D1117" : ghost ? "#8B949E" : "#F0F6FC",
    borderRadius: 12,
    padding: "10px 14px",
    textAlign: "center",
    fontFamily: "'Kalam', cursive",
    fontWeight: 700,
    fontSize: 14,
    width: full ? "100%" : "auto",
    boxShadow: primary ? `2px 3px 0 rgba(249,115,22,0.25)` : "none",
    ...style,
  }}>{children}</div>
);

const Scribble = ({ w = "100%", lines = 1 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {[...Array(lines)].map((_, i) => (
      <div key={i} style={{
        height: 4, background: "#3a4150", borderRadius: 2,
        width: typeof w === "string" ? w : `${w * (1 - i * 0.15)}px`,
      }}></div>
    ))}
  </div>
);

const StatusDot = ({ kind = "ok" }) => {
  const map = { ok: SUCCESS, out: DANGER, mute: MUTE, soon: ACCENT };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: map[kind] }}></span>;
};

// ============ DASHBOARD VARIATIONS ============

const Dash_A = () => (
  <Phone label="A · ring-first">
    {/* alert banner */}
    <div style={{ borderTop: `1px solid #3a4150`, borderBottom: `1px solid #3a4150`, padding: "6px 4px", margin: "-4px -14px 10px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8B949E" }}>
      <span>⚠ regional shortage active</span><span>×</span>
    </div>
    <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 2 }}>tuesday · adderall xr 20mg</div>
    <div style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>you're 6 days ahead</div>

    <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 10px" }}>
      <Ring days={6} color={ACCENT} />
    </div>

    <Btn primary>▶ start today's hunt</Btn>

    <div style={{ marginTop: 14, fontSize: 12, color: "#8B949E", marginBottom: 6 }}>recent calls</div>
    <Box soft style={{ marginBottom: 6, fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Walgreens · Main</span>
        <Pill color={DANGER}>out</Pill>
      </div>
    </Box>
    <Box soft style={{ marginBottom: 6, fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Corner Rx · 5th</span>
        <Pill color={ACCENT}>check back</Pill>
      </div>
    </Box>

    <Box soft accent style={{ marginTop: 6, fontSize: 12 }}>
      <div style={{ color: ACCENT, fontWeight: 700, marginBottom: 2 }}>insight</div>
      <div style={{ color: "#F0F6FC" }}>CVS Main has had stock 3 of 4 weeks</div>
    </Box>

    <TabBar active="home" />
  </Phone>
);

const Dash_B = () => (
  <Phone label="B · status strip">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700 }}>medscout</div>
      <div style={{ fontSize: 11, color: "#8B949E" }}>tue · 6 days</div>
    </div>

    {/* Horizontal stat strip instead of ring */}
    <Box accent style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 36, fontWeight: 700, lineHeight: 1, color: ACCENT }}>6</div>
          <div style={{ fontSize: 11, color: "#8B949E" }}>days of meds left</div>
        </div>
        <div style={{ flex: 1, marginLeft: 14, height: 8, background: "#3a4150", borderRadius: 4, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "40%", background: ACCENT }}></div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#8B949E", marginTop: 8 }}>est. run-out: mon may 12</div>
    </Box>

    <Btn primary>▶ start today's hunt</Btn>

    <div style={{ marginTop: 14, fontSize: 12, color: "#8B949E", marginBottom: 6 }}>3 recent calls</div>
    {[
      { n: "Walgreens · Main", k: "out", t: "2h ago" },
      { n: "Corner Rx", k: "soon", t: "yesterday" },
      { n: "Target Rx", k: "ok", t: "fri" },
    ].map((r, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", borderBottom: `1px dashed #3a4150`, fontSize: 12 }}>
        <span><StatusDot kind={r.k} /> &nbsp;{r.n}</span>
        <span style={{ color: "#8B949E" }}>{r.t}</span>
      </div>
    ))}

    <Box soft style={{ marginTop: 8, fontSize: 11, borderStyle: "dashed" }}>
      <div style={{ color: ACCENT }}>↗ insight · CVS Main: 3/4 wks in stock</div>
    </Box>

    <TabBar active="home" />
  </Phone>
);

const Dash_C = () => (
  <Phone label="C · checklist">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 26, fontWeight: 700 }}>today</div>
    <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 10 }}>tue may 6 · adderall xr 20mg</div>

    {/* combined ring + cta hero */}
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
      <Ring days={6} size={90} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: "#8B949E" }}>refill window opens</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT, fontFamily: "'Caveat', cursive" }}>now</div>
        <div style={{ fontSize: 11, color: "#8B949E" }}>you have 6 days</div>
      </div>
    </div>

    {/* Hunt as a checklist */}
    <Box soft style={{ marginBottom: 10, padding: 0 }}>
      <div style={{ padding: "8px 12px", borderBottom: `1px dashed #3a4150`, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Caveat', cursive", fontWeight: 700 }}>today's hunt list</span>
        <span style={{ fontSize: 11, color: ACCENT }}>3 of 5</span>
      </div>
      {[
        { p: "Walgreens · Main", s: "✗ out", c: DANGER, done: true },
        { p: "Corner Rx · 5th", s: "↻ check back fri", c: ACCENT, done: true },
        { p: "Target · 12th", s: "✓ in stock", c: SUCCESS, done: true },
        { p: "CVS · Elm", s: "next →", c: MUTE, done: false },
      ].map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", fontSize: 12, opacity: r.done ? 0.6 : 1, borderBottom: i < 3 ? "1px dashed #2a2f3a" : "none" }}>
          <span>{r.done ? "☑" : "☐"} &nbsp;{r.p}</span>
          <span style={{ color: r.c }}>{r.s}</span>
        </div>
      ))}
    </Box>

    <Btn primary>continue hunt → CVS Elm</Btn>

    <Box soft accent style={{ marginTop: 8, fontSize: 11 }}>
      <span style={{ color: ACCENT }}>⚡</span> &nbsp;Walgreens Oak gets shipments thursdays
    </Box>

    <TabBar active="home" />
  </Phone>
);

// ============ DIALER VARIATIONS ============

const DialerSeg = ({ active = 0 }) => (
  <div style={{ display: "flex", border: `1.5px solid #3a4150`, borderRadius: 10, padding: 2, marginBottom: 10, fontSize: 12 }}>
    {["dialer", "call log"].map((s, i) => (
      <div key={s} style={{
        flex: 1, textAlign: "center", padding: "6px 0",
        background: active === i ? ACCENT : "transparent",
        color: active === i ? "#0D1117" : "#8B949E",
        borderRadius: 8, fontWeight: 700, fontFamily: "'Kalam', cursive",
      }}>{s}</div>
    ))}
  </div>
);

const Dial_A = () => (
  <Phone label="A · list rows">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 24, fontWeight: 700 }}>hunt</div>
    <DialerSeg active={0} />

    {[
      { n: "Walgreens · Main St", d: "0.4mi", t: "2h ago", s: "out", k: "out", v: false },
      { n: "Corner Pharmacy", d: "0.8mi", t: "yest.", s: "check back", k: "soon", v: false },
      { n: "Target Rx · 12th", d: "1.2mi", t: "fri", s: "in stock", k: "ok", v: false },
      { n: "Family Care Rx", d: "1.6mi", t: "—", s: "no calls", k: "mute", v: true },
      { n: "CVS · Elm", d: "2.1mi", t: "wed", s: "out", k: "out", v: false },
    ].map((r, i) => (
      <Box key={i} soft style={{ marginBottom: 6, padding: "8px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {r.v && <span style={{ color: VAULT }}>🔒 </span>}
              {r.n}
            </div>
            <div style={{ fontSize: 11, color: "#8B949E" }}>{r.d} · {r.t} · <StatusDot kind={r.k}/> {r.s}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 32, height: 32, border: `1.5px solid ${ACCENT}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT }}>☎</div>
            <div style={{ width: 32, height: 32, border: `1.5px solid #5a6070`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#8B949E" }}>📄</div>
          </div>
        </div>
      </Box>
    ))}

    <div style={{ position: "absolute", right: 18, bottom: 70, width: 48, height: 48, borderRadius: 999, background: ACCENT, color: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, boxShadow: "2px 3px 0 rgba(249,115,22,0.3)" }}>+</div>

    <TabBar active="hunt" />
  </Phone>
);

const Dial_B = () => (
  <Phone label="B · big call buttons">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 24, fontWeight: 700 }}>hunt</div>
    <DialerSeg active={0} />
    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>tap to call · long-press for script</div>

    {[
      { n: "Walgreens Main", k: "out", v: false },
      { n: "Corner Rx", k: "soon", v: false },
      { n: "Target Rx", k: "ok", v: false },
      { n: "Family Care", k: "mute", v: true },
    ].map((r, i) => (
      <Box key={i} soft style={{ marginBottom: 8, padding: 0, display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "12px 12px" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{r.v && <span style={{ color: VAULT }}>🔒 </span>}{r.n}</div>
          <div style={{ fontSize: 11, color: "#8B949E", marginTop: 2 }}>
            <StatusDot kind={r.k}/> {r.k === "out" ? "out · 2h" : r.k === "soon" ? "check back · 1d" : r.k === "ok" ? "in stock · fri" : "no calls yet"}
          </div>
        </div>
        <div style={{ width: 60, background: ACCENT, color: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, borderRadius: "0 8px 8px 0" }}>☎</div>
      </Box>
    ))}

    <Btn ghost>+ add a pharmacy</Btn>

    <TabBar active="hunt" />
  </Phone>
);

const Dial_C = () => (
  <Phone label="C · grouped by status">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 24, fontWeight: 700 }}>hunt</div>
    <DialerSeg active={0} />

    {/* group: not yet called today */}
    <div style={{ fontSize: 11, color: ACCENT, marginBottom: 4, fontWeight: 700 }}>↑ try today (3)</div>
    {[
      { n: "Target Rx · 12th", h: "had stock fri" },
      { n: "CVS · Elm", h: "wed: out" },
      { n: "Walgreens Oak", h: "ships thurs" },
    ].map((r, i) => (
      <Box key={i} soft style={{ marginBottom: 5, padding: "7px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{r.n}</div>
            <div style={{ fontSize: 10, color: "#8B949E" }}>{r.h}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ fontSize: 16, color: ACCENT }}>☎</span>
            <span style={{ fontSize: 14, color: MUTE }}>📄</span>
          </div>
        </div>
      </Box>
    ))}

    <div style={{ fontSize: 11, color: "#8B949E", margin: "8px 0 4px" }}>called today (2)</div>
    {[
      { n: "Walgreens Main", s: "out", k: "out" },
      { n: "Corner Rx", s: "back fri", k: "soon" },
    ].map((r, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 4px", fontSize: 11, opacity: 0.65, borderBottom: "1px dashed #2a2f3a" }}>
        <span>{r.n}</span>
        <span style={{ color: r.k === "out" ? DANGER : ACCENT }}><StatusDot kind={r.k}/> {r.s}</span>
      </div>
    ))}

    <div style={{ position: "absolute", right: 18, bottom: 70, width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${ACCENT}`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>+</div>

    <TabBar active="hunt" />
  </Phone>
);

// ============ PRE-FLIGHT ============

const Pre_A = () => (
  <Phone label="A · script center">
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "#8B949E" }}>← back</div>
      <div style={{ fontSize: 12, color: "#8B949E" }}>pre-flight</div>
      <div style={{ fontSize: 12, color: "#8B949E" }}>skip</div>
    </div>

    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 24, fontWeight: 700 }}>Walgreens · Main St</div>
    <div style={{ fontSize: 12, color: "#8B949E" }}>(555) 123-4567</div>
    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 10 }}>last call: 2h ago · <span style={{ color: DANGER }}>out</span></div>

    {/* tone selector */}
    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
      {["short", "polite", "insurance"].map((t, i) => (
        <div key={t} style={{
          flex: 1, fontSize: 10, padding: "6px 4px", textAlign: "center",
          border: `1.5px solid ${i === 1 ? ACCENT : "#3a4150"}`,
          background: i === 1 ? ACCENT : "transparent",
          color: i === 1 ? "#0D1117" : "#8B949E",
          borderRadius: 8, fontWeight: 700,
        }}>{t}</div>
      ))}
    </div>

    {/* script body */}
    <Box accent style={{ padding: 14, marginBottom: 10, minHeight: 130 }}>
      <div style={{ fontSize: 10, color: ACCENT, marginBottom: 6 }}>SCRIPT · POLITE</div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        "Hi, I'm a patient checking if you're able to facilitate a transfer for <span style={{ background: "rgba(249,115,22,0.2)", padding: "0 4px", borderRadius: 3 }}>20mg Adderall XR</span>. Is that something you currently have in stock?"
      </div>
    </Box>

    <Box soft style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginBottom: 10, fontSize: 11 }}>
      <span style={{ color: ACCENT }}>⚡ short version</span>
      <span style={{ color: "#8B949E" }}>○○● off</span>
    </Box>

    <div style={{ marginTop: "auto" }}>
      <Btn primary style={{ marginBottom: 6 }}>☎ start call</Btn>
      <Btn ghost>skip script</Btn>
    </div>
  </Phone>
);

const Pre_B = () => (
  <Phone label="B · header + chips">
    <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 4 }}>← cancel</div>
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700 }}>before you call</div>

    {/* compact pharmacy header */}
    <Box soft style={{ marginTop: 8, marginBottom: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Walgreens Main</div>
          <div style={{ fontSize: 11, color: "#8B949E" }}>(555) 123-4567</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10, color: "#8B949E" }}>
          last call 2h<br/><span style={{ color: DANGER }}>● out</span>
        </div>
      </div>
    </Box>

    <div style={{ display: "flex", gap: 4, fontSize: 10, marginBottom: 8, flexWrap: "wrap" }}>
      <Pill color={ACCENT} bg="rgba(249,115,22,0.1)">tone: polite</Pill>
      <Pill color="#8B949E">⚡ short</Pill>
      <Pill color="#8B949E">+ insurance</Pill>
    </div>

    {/* script in big block */}
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1.5px solid ${ACCENT}`, borderRadius: 12, padding: 14, marginBottom: 10, flex: 1 }}>
      <div style={{ fontSize: 14, lineHeight: 1.55 }}>
        Hi — I'm a patient checking if you can do a transfer for 20mg Adderall XR. Do you have it in stock?
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #3a4150", fontSize: 11, color: "#8B949E" }}>
        details · <span style={{ color: ACCENT }}>adderall xr</span> · <span style={{ color: ACCENT }}>20mg</span> · <span style={{ color: ACCENT }}>30 days</span>
      </div>
    </div>

    <div style={{ display: "flex", gap: 8 }}>
      <Btn ghost full={false} style={{ flex: 1 }}>skip</Btn>
      <Btn primary full={false} style={{ flex: 2 }}>☎ start call</Btn>
    </div>
  </Phone>
);

const Pre_C = () => (
  <Phone label="C · checklist before dial">
    <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 6 }}>← back</div>
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700 }}>ready?</div>
    <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 10 }}>walgreens main · (555) 123-4567</div>

    {/* a 'pre-flight' inspired checklist - very on-theme */}
    <Box soft style={{ padding: 10, marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>your tone</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { l: "short / direct", a: false },
          { l: "polite / patient", a: true },
          { l: "insurance-first", a: false },
        ].map(t => (
          <div key={t.l} style={{
            padding: "6px 10px", borderRadius: 6, fontSize: 12,
            border: `1.2px solid ${t.a ? ACCENT : "#3a4150"}`,
            background: t.a ? "rgba(249,115,22,0.1)" : "transparent",
            color: t.a ? ACCENT : "#F0F6FC",
            fontWeight: t.a ? 700 : 400,
          }}>{t.a ? "●" : "○"} {t.l}</div>
        ))}
      </div>
    </Box>

    <Box soft style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 4 }}>read aloud</div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        "Hi, checking on Adderall XR 20mg — is it in stock today?"
      </div>
      <div style={{ fontSize: 10, color: ACCENT, marginTop: 6 }}>⚡ short version on</div>
    </Box>

    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>
      ☑ med info auto-filled<br/>
      ☑ transcription ready<br/>
      ☐ on speaker (recommended)
    </div>

    <div style={{ marginTop: "auto" }}>
      <Btn primary style={{ marginBottom: 6 }}>☎ dial walgreens</Btn>
      <Btn ghost>skip script</Btn>
    </div>
  </Phone>
);

// ============ ACTIVE CALL OVERLAY ============

const Active_A = () => (
  <Phone label="A · top banner">
    {/* faux native call ui */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8B949E", fontFamily: "'Kalam', cursive" }}>
      <div style={{ width: 80, height: 80, borderRadius: 999, border: `1.5px dashed #5a6070`, marginBottom: 14 }}></div>
      <div style={{ fontSize: 18, color: "#F0F6FC", fontWeight: 700 }}>Walgreens Main</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>00:42 · connected</div>
      <div style={{ fontSize: 10, color: MUTE, marginTop: 30 }}>↑ native call ui ↑</div>
      <div style={{ display: "flex", gap: 16, marginTop: 30 }}>
        {["mute", "kbd", "spkr", "add", "facetime", "end"].slice(0,3).map(c => (
          <div key={c} style={{ width: 44, height: 44, borderRadius: 999, border: "1.5px solid #5a6070", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#8B949E" }}>{c}</div>
        ))}
      </div>
    </div>

    {/* persistent script banner at top */}
    <div style={{
      position: "absolute", top: 36, left: 14, right: 14,
      background: "#161B22", border: `1.5px solid ${ACCENT}`,
      borderRadius: 12, padding: "10px 12px", boxShadow: "0 4px 0 rgba(0,0,0,0.3)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#8B949E", marginBottom: 4 }}>
        <span>● recording · polite</span>
        <span style={{ color: ACCENT }}>⚡ short ○ off</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.4, color: "#F0F6FC" }}>
        "Checking on Adderall XR 20mg — is it in stock today?"
      </div>
    </div>
  </Phone>
);

const Active_B = () => (
  <Phone label="B · floating cards">
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8B949E" }}>
      <div style={{ width: 60, height: 60, borderRadius: 999, border: `1.5px dashed #5a6070`, marginBottom: 10 }}></div>
      <div style={{ fontSize: 16, color: "#F0F6FC", fontWeight: 700 }}>Walgreens Main</div>
      <div style={{ fontSize: 11 }}>01:08 · on call</div>
    </div>

    {/* floating draggable card */}
    <div style={{
      position: "absolute", top: 50, left: 14, right: 14,
      background: "#161B22", border: `1.5px solid ${ACCENT}`,
      borderRadius: 14, padding: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#8B949E", marginBottom: 6 }}>
        <span>::: drag · script</span>
        <span>━ minimize</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, color: "#F0F6FC", marginBottom: 8 }}>
        "Hi, I'm a patient — can you facilitate a transfer for 20mg Adderall XR? Is it in stock?"
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {["short", "polite", "ins."].map((t, i) => (
          <div key={t} style={{
            flex: 1, fontSize: 9, padding: "4px 0", textAlign: "center",
            border: `1.2px solid ${i === 1 ? ACCENT : "#3a4150"}`,
            background: i === 1 ? "rgba(249,115,22,0.15)" : "transparent",
            color: i === 1 ? ACCENT : "#8B949E",
            borderRadius: 6,
          }}>{t}</div>
        ))}
      </div>
    </div>

    {/* live transcribe pill at bottom */}
    <div style={{
      position: "absolute", bottom: 30, left: 14, right: 14,
      background: "rgba(34,197,94,0.1)", border: `1.5px solid ${SUCCESS}`,
      borderRadius: 10, padding: "6px 10px", fontSize: 10, color: SUCCESS,
    }}>● transcribing · "...we have 30mg but not 20..."</div>
  </Phone>
);

const Active_C = () => (
  <Phone label="C · pip thumbnail">
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8B949E", fontSize: 11 }}>
      <div style={{ fontSize: 16, color: "#F0F6FC", fontWeight: 700 }}>Walgreens Main</div>
      <div>02:14</div>
      <div style={{ fontSize: 9, color: MUTE, marginTop: 18 }}>(native ios call ui)</div>
    </div>

    {/* tiny pip */}
    <div style={{
      position: "absolute", top: 50, right: 18,
      width: 110, background: "#161B22", border: `1.5px solid ${ACCENT}`,
      borderRadius: 10, padding: 8,
    }}>
      <div style={{ fontSize: 8, color: ACCENT, marginBottom: 3 }}>SCRIPT · ⚡</div>
      <div style={{ fontSize: 10, lineHeight: 1.3, color: "#F0F6FC" }}>
        "20mg Adderall XR — in stock?"
      </div>
      <div style={{ fontSize: 8, color: "#8B949E", marginTop: 4, textAlign: "right" }}>tap to expand ⤢</div>
    </div>

    {/* swap-tone fab */}
    <div style={{
      position: "absolute", top: 130, right: 18,
      width: 36, height: 36, borderRadius: 999,
      border: `1.5px solid ${ACCENT}`, color: ACCENT,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
      background: "#0D1117",
    }}>⇄</div>
  </Phone>
);

// ============ POST-CALL ============

const Post_A = () => (
  <Phone label="A · big confirm">
    {/* dimmed bg */}
    <div style={{ flex: 1, opacity: 0.3, fontSize: 11, color: "#8B949E" }}>
      <div>recent calls</div>
      <Box soft style={{ marginTop: 6 }}><Scribble lines={2}/></Box>
      <Box soft style={{ marginTop: 6 }}><Scribble lines={2}/></Box>
    </div>

    {/* sheet */}
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "#161B22", border: `1.5px solid #3a4150`, borderTopWidth: 2,
      borderRadius: "20px 20px 0 0", padding: "14px 16px 22px",
    }}>
      <div style={{ width: 36, height: 4, background: "#3a4150", borderRadius: 2, margin: "0 auto 10px" }}></div>
      <div style={{ fontSize: 11, color: "#8B949E" }}>walgreens main · 02:34 call</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700, marginTop: 4 }}>I heard:</div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
        <Pill color={SUCCESS} bg="rgba(34,197,94,0.1)" style={{ fontSize: 13, padding: "4px 10px" }}>● in stock</Pill>
        <Pill color={ACCENT} bg="rgba(249,115,22,0.1)" style={{ fontSize: 13, padding: "4px 10px" }}>20mg XR</Pill>
        <Pill color={ACCENT} bg="rgba(249,115,22,0.1)" style={{ fontSize: 13, padding: "4px 10px" }}>arriving fri</Pill>
      </div>

      <Btn primary style={{ background: SUCCESS, borderColor: SUCCESS, color: "#0D1117", boxShadow: "2px 3px 0 rgba(34,197,94,0.25)" }}>✓ confirm log</Btn>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Btn ghost full={false} style={{ flex: 1 }}>edit</Btn>
        <Btn ghost full={false} style={{ flex: 1 }}>discard</Btn>
      </div>
    </div>
  </Phone>
);

const Post_B = () => (
  <Phone label="B · inline strip">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700 }}>hunt</div>

    {/* card sliding in inline at top of list */}
    <Box accent style={{ padding: 12, marginTop: 8, marginBottom: 10, position: "relative" }}>
      <div style={{ fontSize: 10, color: ACCENT, marginBottom: 4 }}>● JUST CALLED · WALGREENS MAIN</div>
      <div style={{ fontSize: 13, color: "#F0F6FC", lineHeight: 1.4, marginBottom: 8 }}>
        in stock · <span style={{ color: ACCENT }}>20mg XR</span> · arriving <span style={{ color: ACCENT }}>fri</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 2, padding: "8px 0", textAlign: "center", background: SUCCESS, color: "#0D1117", borderRadius: 8, fontWeight: 700, fontSize: 12 }}>✓ confirm</div>
        <div style={{ flex: 1, padding: "8px 0", textAlign: "center", border: "1.5px solid #5a6070", color: "#8B949E", borderRadius: 8, fontSize: 12 }}>edit</div>
        <div style={{ flex: 1, padding: "8px 0", textAlign: "center", border: "1.5px solid #5a6070", color: "#8B949E", borderRadius: 8, fontSize: 12 }}>×</div>
      </div>
    </Box>

    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>earlier today</div>
    {[
      { n: "Corner Rx", t: "1pm · check back fri" },
      { n: "Target Rx", t: "11am · out" },
    ].map((r, i) => (
      <div key={i} style={{ padding: "8px 4px", borderBottom: "1px dashed #3a4150", fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>{r.n}</div>
        <div style={{ color: "#8B949E", fontSize: 11 }}>{r.t}</div>
      </div>
    ))}

    <TabBar active="hunt" />
  </Phone>
);

const Post_C = () => (
  <Phone label="C · two big tap zones">
    <div style={{ flex: 1, opacity: 0.25, fontSize: 11, color: "#8B949E" }}>
      <div>walgreens main</div>
      <Scribble lines={3}/>
    </div>

    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "#161B22", borderTop: `2px solid #3a4150`,
      borderRadius: "20px 20px 0 0", padding: "16px 16px 20px",
    }}>
      <div style={{ fontSize: 10, color: "#8B949E", textAlign: "center", marginBottom: 10 }}>summary · walgreens · 02:14</div>

      {/* the takeaway as the hero */}
      <div style={{ background: "rgba(34,197,94,0.08)", border: `1.5px solid ${SUCCESS}`, borderRadius: 12, padding: 14, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 26, fontWeight: 700, color: SUCCESS, lineHeight: 1.1 }}>in stock</div>
        <div style={{ fontSize: 12, color: "#F0F6FC", marginTop: 6 }}>20mg adderall xr · arriving friday</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, padding: "16px 0", textAlign: "center", background: SUCCESS, color: "#0D1117", borderRadius: 12, fontWeight: 700, fontSize: 16 }}>✓ correct</div>
        <div style={{ flex: 1, padding: "16px 0", textAlign: "center", border: `1.5px solid #5a6070`, color: "#F0F6FC", borderRadius: 12, fontSize: 14 }}>✎ fix it</div>
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#8B949E", textDecoration: "underline" }}>discard</div>
    </div>
  </Phone>
);

// ============ CALL LOG ============

const Log_A = () => (
  <Phone label="A · timeline">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700 }}>hunt</div>
    <DialerSeg active={1} />

    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>tuesday · today</div>
    {[
      { n: "Walgreens Main", t: "2:14p · 02:34", k: "out", takeaway: "no stock; check back fri", v: false },
      { n: "Corner Rx", t: "1:02p · 01:18", k: "soon", takeaway: "shipment thursday morning", v: false },
    ].map((r, i) => (
      <Box key={i} soft style={{ marginBottom: 6, padding: 10, borderLeft: `3px solid ${r.k === "out" ? DANGER : ACCENT}` }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{r.n}</span>
          <span style={{ fontSize: 10, color: "#8B949E" }}>✎ edit</span>
        </div>
        <div style={{ fontSize: 10, color: "#8B949E" }}>{r.t}</div>
        <div style={{ fontSize: 11, color: ACCENT, marginTop: 6, background: "rgba(249,115,22,0.08)", padding: "4px 8px", borderRadius: 6 }}>
          ↗ {r.takeaway}
        </div>
      </Box>
    ))}

    <div style={{ fontSize: 11, color: "#8B949E", margin: "8px 0 6px" }}>monday</div>
    {[
      { n: "Target Rx", t: "fri · 02:01", k: "ok", takeaway: "in stock; will hold til mon" },
      { n: "Family Care 🔒", t: "thu · 00:54", k: "out", takeaway: "out indefinitely" },
    ].map((r, i) => (
      <Box key={i} soft style={{ marginBottom: 6, padding: 10, borderLeft: `3px solid ${r.k === "out" ? DANGER : SUCCESS}` }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.n}</div>
        <div style={{ fontSize: 10, color: "#8B949E" }}>{r.t}</div>
        <div style={{ fontSize: 11, color: ACCENT, marginTop: 4 }}>↗ {r.takeaway}</div>
      </Box>
    ))}

    <TabBar active="hunt" />
  </Phone>
);

const Log_B = () => (
  <Phone label="B · expanded transcript">
    <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 4 }}>← back</div>
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700 }}>walgreens main</div>
    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 10 }}>tue 2:14p · 02:34</div>

    <Box accent style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: ACCENT, marginBottom: 4 }}>KEY TAKEAWAY</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F6FC", lineHeight: 1.3 }}>
        no 20mg in stock · check back friday afternoon
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <Pill color={DANGER}>out</Pill>
        <Pill color={ACCENT}>fri restock</Pill>
        <Pill color="#8B949E">20mg XR</Pill>
      </div>
    </Box>

    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 4 }}>full transcript ✎</div>
    <div style={{ flex: 1, overflow: "hidden" }}>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: "#F0F6FC", padding: "4px 0" }}>
        <div style={{ color: "#8B949E", fontSize: 9, marginBottom: 1 }}>YOU</div>
        Hi — checking on 20mg Adderall XR, do you have it?
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: "#F0F6FC", padding: "4px 0", borderTop: "1px dashed #2a2f3a" }}>
        <div style={{ color: "#8B949E", fontSize: 9, marginBottom: 1 }}>RX</div>
        We don't have 20s right now. <span style={{ background: "rgba(249,115,22,0.2)" }}>Shipment friday afternoon</span>, you can call back then.
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: "#F0F6FC", padding: "4px 0", borderTop: "1px dashed #2a2f3a" }}>
        <div style={{ color: "#8B949E", fontSize: 9, marginBottom: 1 }}>YOU</div>
        Will you hold one if I call early?
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: "#F0F6FC", padding: "4px 0", borderTop: "1px dashed #2a2f3a" }}>
        <div style={{ color: "#8B949E", fontSize: 9, marginBottom: 1 }}>RX</div>
        Can't hold controls. First-come.
      </div>
    </div>

    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <Btn ghost full={false} style={{ flex: 1, fontSize: 12 }}>✎ correct</Btn>
      <Btn primary full={false} style={{ flex: 1, fontSize: 12 }}>↗ share to community</Btn>
    </div>
  </Phone>
);

// ============ MAP ============

const Map_A = () => {
  const pins = [
    { x: 40, y: 30, c: SUCCESS, l: "10m" },
    { x: 70, y: 50, c: "#eab308", l: "4h" },
    { x: 30, y: 60, c: DANGER, l: "out" },
    { x: 60, y: 80, c: MUTE, l: "2d" },
    { x: 80, y: 28, c: SUCCESS, l: "30m" },
  ];
  return (
    <Phone label="A · pins + filter bar">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700 }}>map</div>
        <div style={{ fontSize: 11, color: "#8B949E" }}>92706 · 5mi</div>
      </div>

      {/* filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {[
          { l: "my logs", a: false },
          { l: "community", a: true },
          { l: "official", a: true },
        ].map(t => (
          <div key={t.l} style={{
            flex: 1, fontSize: 10, padding: "5px 0", textAlign: "center",
            border: `1.2px solid ${t.a ? ACCENT : "#3a4150"}`,
            background: t.a ? "rgba(249,115,22,0.12)" : "transparent",
            color: t.a ? ACCENT : "#8B949E",
            borderRadius: 6, fontWeight: 700,
          }}>{t.l}</div>
        ))}
      </div>

      {/* fake map area */}
      <div style={{ flex: 1, background: "#0a0e14", border: "1.5px solid #2a2f3a", borderRadius: 12, position: "relative", overflow: "hidden", backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
        {/* squiggle 'roads' */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <path d="M 0 80 Q 80 60 160 100 T 280 80" stroke="#2a2f3a" strokeWidth="2" fill="none" />
          <path d="M 60 0 Q 80 100 60 200 T 80 400" stroke="#2a2f3a" strokeWidth="2" fill="none" />
        </svg>
        {pins.map((p, i) => (
          <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%)" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: p.c, border: "1.5px solid #0D1117" }}></div>
            <div style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", fontSize: 8, background: "#161B22", color: p.c, padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap", border: `1px solid ${p.c}` }}>{p.l}</div>
          </div>
        ))}

        {/* heatmap toggle */}
        <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, padding: "4px 8px", background: "#161B22", border: `1.5px solid ${VAULT}`, color: VAULT, borderRadius: 6 }}>🔒 heatmap</div>
      </div>

      <div style={{ fontSize: 10, color: "#8B949E", marginTop: 6, textAlign: "center" }}>● fresh ● 2-24h ● old ● out · verify before driving</div>

      <TabBar active="map" />
    </Phone>
  );
};

const Map_B = () => (
  <Phone label="B · pin sheet open">
    <div style={{ flex: 1, background: "#0a0e14", border: "1.5px solid #2a2f3a", borderRadius: 12, position: "relative", overflow: "hidden", backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px", marginBottom: 0 }}>
      <div style={{ position: "absolute", left: "50%", top: "30%", transform: "translate(-50%, -100%)" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: SUCCESS, border: "2px solid #F0F6FC", boxShadow: "0 0 0 4px rgba(34,197,94,0.2)" }}></div>
      </div>
      {[
        { x: 20, y: 20, c: "#eab308" },
        { x: 75, y: 60, c: DANGER },
        { x: 30, y: 75, c: MUTE },
      ].map((p, i) => (
        <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: 14, height: 14, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg) translate(-50%,-100%)", background: p.c, opacity: 0.6 }}></div>
      ))}
    </div>

    {/* sheet */}
    <div style={{
      background: "#161B22", border: "1.5px solid #3a4150", borderTopWidth: 2,
      borderRadius: "16px 16px 0 0", padding: 14, margin: "-14px -14px -18px",
    }}>
      <div style={{ width: 36, height: 4, background: "#3a4150", borderRadius: 2, margin: "0 auto 10px" }}></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Westside Pharmacy</div>
          <div style={{ fontSize: 11, color: "#8B949E" }}>0.7mi · community</div>
        </div>
        <Pill color={SUCCESS} bg="rgba(34,197,94,0.1)">verified 10m</Pill>
      </div>
      <div style={{ fontSize: 12, color: "#F0F6FC", margin: "10px 0", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
        20mg XR reported in stock by <span style={{ color: ACCENT }}>3 contributors</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn primary full={false} style={{ flex: 2, fontSize: 12 }}>☎ call now</Btn>
        <Btn ghost full={false} style={{ flex: 1, fontSize: 12 }}>directions</Btn>
      </div>
    </div>
  </Phone>
);

const Map_C = () => (
  <Phone label="C · heatmap unlock">
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700 }}>regional</div>
      <Pill color={ACCENT}>heatmap on</Pill>
    </div>

    <div style={{ flex: 1, background: "#0a0e14", border: "1.5px solid #2a2f3a", borderRadius: 12, position: "relative", overflow: "hidden" }}>
      {/* fake choropleth blobs */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="blur1"><feGaussianBlur stdDeviation="8"/></filter>
        </defs>
        <ellipse cx="40%" cy="35%" rx="60" ry="40" fill={DANGER} opacity="0.5" filter="url(#blur1)"/>
        <ellipse cx="70%" cy="60%" rx="50" ry="35" fill="#eab308" opacity="0.4" filter="url(#blur1)"/>
        <ellipse cx="30%" cy="70%" rx="40" ry="30" fill={SUCCESS} opacity="0.4" filter="url(#blur1)"/>
      </svg>

      {/* lock overlay (since user hasn't contributed) */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(13,17,23,0.55)", backdropFilter: "blur(2px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>🔓</div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700, marginTop: 6 }}>unlock regional view</div>
        <div style={{ fontSize: 11, color: "#8B949E", marginTop: 4, lineHeight: 1.4 }}>submit your fill status<br/>(takes 10 seconds)</div>
        <Btn primary style={{ marginTop: 12, width: "auto", padding: "8px 16px" }}>↗ contribute now</Btn>
      </div>
    </div>

    <div style={{ fontSize: 10, color: "#8B949E", marginTop: 6, textAlign: "center" }}>red = low fill rate · green = healthy</div>

    <TabBar active="map" />
  </Phone>
);

// ============ SCRIPT DRAWER ============

const Drawer_A = () => (
  <Phone label="A · drawer with chips">
    <div style={{ flex: 1, opacity: 0.3, fontSize: 11 }}>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700 }}>hunt</div>
      <Box soft style={{ marginTop: 6 }}><Scribble lines={2}/></Box>
      <Box soft style={{ marginTop: 6 }}><Scribble lines={2}/></Box>
    </div>

    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "#161B22", borderTop: `2px solid #3a4150`,
      borderRadius: "20px 20px 0 0", padding: "12px 16px 18px",
    }}>
      <div style={{ width: 36, height: 4, background: "#3a4150", borderRadius: 2, margin: "0 auto 10px" }}></div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>your script</div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[
          { l: "short", a: false },
          { l: "polite", a: true },
          { l: "insurance", a: false },
        ].map(t => (
          <div key={t.l} style={{
            flex: 1, fontSize: 11, padding: "6px 0", textAlign: "center",
            borderBottom: `2px solid ${t.a ? ACCENT : "transparent"}`,
            color: t.a ? ACCENT : "#8B949E",
            fontWeight: 700,
          }}>{t.l}</div>
        ))}
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.5, color: "#F0F6FC", marginBottom: 10 }}>
        "Hi, I'm a patient checking if you can do a transfer for 20mg Adderall XR. Is that something you have in stock today?"
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        <Pill color={ACCENT} bg="rgba(249,115,22,0.1)" style={{ fontSize: 11, padding: "3px 8px" }}>adderall xr ✎</Pill>
        <Pill color={ACCENT} bg="rgba(249,115,22,0.1)" style={{ fontSize: 11, padding: "3px 8px" }}>20mg ✎</Pill>
        <Pill color="#8B949E" style={{ fontSize: 11, padding: "3px 8px" }}>+ add insurance</Pill>
      </div>

      <Box soft style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", fontSize: 12, alignItems: "center" }}>
        <span>⚡ grumpy pharmacist mode</span>
        <span style={{ color: "#8B949E" }}>○─●</span>
      </Box>
    </div>
  </Phone>
);

const Drawer_B = () => (
  <Phone label="B · grumpy mode on">
    <div style={{ flex: 1, opacity: 0.3 }}>
      <Scribble lines={3}/>
    </div>

    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "#161B22", borderTop: `2px solid ${ACCENT}`,
      borderRadius: "20px 20px 0 0", padding: "14px 16px 20px",
    }}>
      <div style={{ width: 36, height: 4, background: "#3a4150", borderRadius: 2, margin: "0 auto 10px" }}></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700 }}>⚡ short version</div>
        <div style={{ fontSize: 10, padding: "3px 8px", background: ACCENT, color: "#0D1117", borderRadius: 999, fontWeight: 700 }}>ON</div>
      </div>

      {/* big single-line script — easy to read while phone is ringing */}
      <div style={{ background: "rgba(249,115,22,0.1)", border: `1.5px solid ${ACCENT}`, borderRadius: 12, padding: "16px 14px", marginBottom: 10 }}>
        <div style={{ fontSize: 18, lineHeight: 1.35, color: "#F0F6FC", fontWeight: 700, fontFamily: "'Lexend', sans-serif" }}>
          "Do you have 20mg Adderall XR in stock?"
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>tap to switch tone</div>
      <div style={{ display: "flex", gap: 6 }}>
        {["short", "polite", "insurance"].map((t, i) => (
          <div key={t} style={{
            flex: 1, fontSize: 11, padding: "8px 0", textAlign: "center",
            border: `1.2px solid ${i === 0 ? ACCENT : "#3a4150"}`,
            background: i === 0 ? "rgba(249,115,22,0.1)" : "transparent",
            color: i === 0 ? ACCENT : "#8B949E",
            borderRadius: 8, fontWeight: 700,
          }}>{t}</div>
        ))}
      </div>
    </div>
  </Phone>
);

// ============ MAIN APP ============

const App = () => (
  <DesignCanvas
    title="MedScout · wireframe sketches"
    subtitle="low-fi exploration · ADHD med-shortage tracker · dark-mode utility app"
    initialSpacing={36}
  >
    <DCSection id="dashboard" title="1 · Dashboard / Home" subtitle="answers 'where do I stand?' in under 2 seconds">
      <DCArtboard id="d-a" label="A · ring-first" width={300} height={620} background={PAPER}><Dash_A /></DCArtboard>
      <DCArtboard id="d-b" label="B · status strip" width={300} height={620} background={PAPER}><Dash_B /></DCArtboard>
      <DCArtboard id="d-c" label="C · checklist" width={300} height={620} background={PAPER}><Dash_C /></DCArtboard>
    </DCSection>

    <DCSection id="dialer" title="2 · Pharmacy Dialer" subtitle="hunt tab default · curated list of pharmacies to call">
      <DCArtboard id="dial-a" label="A · list rows" width={300} height={620} background={PAPER}><Dial_A /></DCArtboard>
      <DCArtboard id="dial-b" label="B · big call buttons" width={300} height={620} background={PAPER}><Dial_B /></DCArtboard>
      <DCArtboard id="dial-c" label="C · grouped by status" width={300} height={620} background={PAPER}><Dial_C /></DCArtboard>
    </DCSection>

    <DCSection id="preflight" title="3 · Pre-Flight (before dial)" subtitle="full-screen prep · script + tone + start call">
      <DCArtboard id="pre-a" label="A · script center" width={300} height={620} background={PAPER}><Pre_A /></DCArtboard>
      <DCArtboard id="pre-b" label="B · header + chips" width={300} height={620} background={PAPER}><Pre_B /></DCArtboard>
      <DCArtboard id="pre-c" label="C · checklist" width={300} height={620} background={PAPER}><Pre_C /></DCArtboard>
    </DCSection>

    <DCSection id="active" title="4 · Active call · live script overlay" subtitle="must coexist with native call UI">
      <DCArtboard id="act-a" label="A · top banner" width={300} height={620} background={PAPER}><Active_A /></DCArtboard>
      <DCArtboard id="act-b" label="B · floating cards" width={300} height={620} background={PAPER}><Active_B /></DCArtboard>
      <DCArtboard id="act-c" label="C · pip thumbnail" width={300} height={620} background={PAPER}><Active_C /></DCArtboard>
    </DCSection>

    <DCSection id="post" title="5 · Post-call confirmation" subtitle="appears immediately after hangup · one-tap close-the-loop">
      <DCArtboard id="post-a" label="A · sheet" width={300} height={620} background={PAPER}><Post_A /></DCArtboard>
      <DCArtboard id="post-b" label="B · inline strip" width={300} height={620} background={PAPER}><Post_B /></DCArtboard>
      <DCArtboard id="post-c" label="C · two big tap zones" width={300} height={620} background={PAPER}><Post_C /></DCArtboard>
    </DCSection>

    <DCSection id="log" title="6 · Call log / transcription" subtitle="hunt tab · second segment">
      <DCArtboard id="log-a" label="A · timeline list" width={300} height={620} background={PAPER}><Log_A /></DCArtboard>
      <DCArtboard id="log-b" label="B · expanded transcript" width={300} height={620} background={PAPER}><Log_B /></DCArtboard>
    </DCSection>

    <DCSection id="map" title="7 · Availability map" subtitle="community + official data, recency-coded pins">
      <DCArtboard id="map-a" label="A · pins + filter bar" width={300} height={620} background={PAPER}><Map_A /></DCArtboard>
      <DCArtboard id="map-b" label="B · pin sheet open" width={300} height={620} background={PAPER}><Map_B /></DCArtboard>
      <DCArtboard id="map-c" label="C · heatmap unlock" width={300} height={620} background={PAPER}><Map_C /></DCArtboard>
    </DCSection>

    <DCSection id="drawer" title="8 · Script drawer (bottom sheet)" subtitle="three tones + grumpy-pharmacist short version">
      <DCArtboard id="drw-a" label="A · drawer w/ chips" width={300} height={620} background={PAPER}><Drawer_A /></DCArtboard>
      <DCArtboard id="drw-b" label="B · grumpy mode" width={300} height={620} background={PAPER}><Drawer_B /></DCArtboard>
    </DCSection>
  </DesignCanvas>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
