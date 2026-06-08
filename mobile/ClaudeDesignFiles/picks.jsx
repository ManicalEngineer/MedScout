// MedScout — chosen variants, single flow

const ACCENT = "#F97316";
const INK = "#1a1a1a";
const PAPER = "#fafaf6";
const MUTE = "#9a958a";
const SUCCESS = "#22a05a";
const DANGER = "#dc4242";
const VAULT = "#7a55d6";

const Phone = ({ children, label, w = 300, h = 620 }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
    <div style={{
      width: w, height: h,
      background: "#0D1117",
      border: `2.5px solid ${INK}`,
      borderRadius: 32,
      padding: "28px 14px 18px",
      position: "relative",
      boxShadow: "3px 4px 0 rgba(0,0,0,0.08)",
      fontFamily: "'Kalam', cursive",
      color: "#F0F6FC",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
        width: 90, height: 16, background: INK, borderRadius: 10,
      }}></div>
      {children}
    </div>
    {label && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: INK, fontWeight: 700 }}>{label}</div>}
  </div>
);

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

const Box = ({ children, style = {}, accent = false, soft = false }) => (
  <div style={{
    border: `1.5px solid ${accent ? ACCENT : soft ? "#3a4150" : "#5a6070"}`,
    borderRadius: 10,
    padding: "10px 12px",
    background: soft ? "rgba(255,255,255,0.03)" : "transparent",
    ...style,
  }}>{children}</div>
);

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
    border: `1.5px solid ${primary ? ACCENT : "#5a6070"}`,
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

const Scribble = ({ lines = 1 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {[...Array(lines)].map((_, i) => (
      <div key={i} style={{ height: 4, background: "#3a4150", borderRadius: 2, width: `${100 - i * 12}%` }}></div>
    ))}
  </div>
);

const StatusDot = ({ kind = "ok" }) => {
  const map = { ok: SUCCESS, out: DANGER, mute: MUTE, soon: ACCENT };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: map[kind] }}></span>;
};

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

// 1 · Dashboard A
const Dash = () => (
  <Phone label="1 · dashboard">
    <div style={{ borderTop: `1px solid #3a4150`, borderBottom: `1px solid #3a4150`, padding: "6px 4px", margin: "-4px -14px 10px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8B949E" }}>
      <span>⚠ regional shortage active</span><span>×</span>
    </div>
    <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 2 }}>tuesday · adderall xr 20mg</div>
    <div style={{ fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>you're 6 days ahead</div>
    <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 10px" }}>
      <Ring days={6} />
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

// 2 · Dialer A but with C's outline + button (smaller, ring style)
const Dial = () => (
  <Phone label="2 · dialer">
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
    {/* Outline + button from variant C */}
    <div style={{ position: "absolute", right: 18, bottom: 70, width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${ACCENT}`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: "#0D1117" }}>+</div>
    <TabBar active="hunt" />
  </Phone>
);

// 3 · Pre-Flight A
const Pre = () => (
  <Phone label="3 · pre-flight">
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "#8B949E" }}>← back</div>
      <div style={{ fontSize: 12, color: "#8B949E" }}>pre-flight</div>
      <div style={{ fontSize: 12, color: "#8B949E" }}>skip</div>
    </div>
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 24, fontWeight: 700 }}>Walgreens · Main St</div>
    <div style={{ fontSize: 12, color: "#8B949E" }}>(555) 123-4567</div>
    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 10 }}>last call: 2h ago · <span style={{ color: DANGER }}>out</span></div>
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

// 4 · Active call B (floating cards)
const Active = () => (
  <Phone label="4 · active call">
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8B949E" }}>
      <div style={{ width: 60, height: 60, borderRadius: 999, border: `1.5px dashed #5a6070`, marginBottom: 10 }}></div>
      <div style={{ fontSize: 16, color: "#F0F6FC", fontWeight: 700 }}>Walgreens Main</div>
      <div style={{ fontSize: 11 }}>01:08 · on call</div>
    </div>
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
    <div style={{
      position: "absolute", bottom: 30, left: 14, right: 14,
      background: "rgba(34,197,94,0.1)", border: `1.5px solid ${SUCCESS}`,
      borderRadius: 10, padding: "6px 10px", fontSize: 10, color: SUCCESS,
    }}>● transcribing · "...we have 30mg but not 20..."</div>
  </Phone>
);

// 5 · Post-call B (inline strip)
const Post = () => (
  <Phone label="5 · post-call">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700 }}>hunt</div>
    <Box accent style={{ padding: 12, marginTop: 8, marginBottom: 10 }}>
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

// 6 · Call log — both
const LogA = () => (
  <Phone label="6a · log timeline">
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700 }}>hunt</div>
    <DialerSeg active={1} />
    <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>tuesday · today</div>
    {[
      { n: "Walgreens Main", t: "2:14p · 02:34", k: "out", takeaway: "no stock; check back fri" },
      { n: "Corner Rx", t: "1:02p · 01:18", k: "soon", takeaway: "shipment thursday morning" },
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

const LogB = () => (
  <Phone label="6b · transcript expanded">
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

// 7 · Map — all three
const MapA = () => {
  const pins = [
    { x: 40, y: 30, c: SUCCESS, l: "10m" },
    { x: 70, y: 50, c: "#eab308", l: "4h" },
    { x: 30, y: 60, c: DANGER, l: "out" },
    { x: 60, y: 80, c: MUTE, l: "2d" },
    { x: 80, y: 28, c: SUCCESS, l: "30m" },
  ];
  return (
    <Phone label="7a · map + pins">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700 }}>map</div>
        <div style={{ fontSize: 11, color: "#8B949E" }}>92706 · 5mi</div>
      </div>
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
      <div style={{ flex: 1, background: "#0a0e14", border: "1.5px solid #2a2f3a", borderRadius: 12, position: "relative", overflow: "hidden", backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
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
        <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, padding: "4px 8px", background: "#161B22", border: `1.5px solid ${VAULT}`, color: VAULT, borderRadius: 6 }}>🔒 heatmap</div>
      </div>
      <div style={{ fontSize: 10, color: "#8B949E", marginTop: 6, textAlign: "center" }}>● fresh ● 2-24h ● old ● out · verify before driving</div>
      <TabBar active="map" />
    </Phone>
  );
};

const MapB = () => (
  <Phone label="7b · pin sheet">
    <div style={{ flex: 1, background: "#0a0e14", border: "1.5px solid #2a2f3a", borderRadius: 12, position: "relative", overflow: "hidden", backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
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

const MapC = () => (
  <Phone label="7c · heatmap unlock">
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700 }}>regional</div>
      <Pill color={ACCENT}>heatmap on</Pill>
    </div>
    <div style={{ flex: 1, background: "#0a0e14", border: "1.5px solid #2a2f3a", borderRadius: 12, position: "relative", overflow: "hidden" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="blur1"><feGaussianBlur stdDeviation="8"/></filter>
        </defs>
        <ellipse cx="40%" cy="35%" rx="60" ry="40" fill={DANGER} opacity="0.5" filter="url(#blur1)"/>
        <ellipse cx="70%" cy="60%" rx="50" ry="35" fill="#eab308" opacity="0.4" filter="url(#blur1)"/>
        <ellipse cx="30%" cy="70%" rx="40" ry="30" fill={SUCCESS} opacity="0.4" filter="url(#blur1)"/>
      </svg>
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

// 8 · Drawer A
const Drawer = () => (
  <Phone label="8 · script drawer">
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

const App = () => (
  <DesignCanvas
    title="MedScout · chosen variants"
    subtitle="consolidated picks from round 1 · single user flow, top to bottom"
    initialSpacing={36}
  >
    <DCSection id="flow" title="user flow · home → call → confirm" subtitle="">
      <DCArtboard id="p1" label="dashboard" width={300} height={620} background={PAPER}><Dash /></DCArtboard>
      <DCArtboard id="p2" label="dialer" width={300} height={620} background={PAPER}><Dial /></DCArtboard>
      <DCArtboard id="p3" label="script drawer" width={300} height={620} background={PAPER}><Drawer /></DCArtboard>
      <DCArtboard id="p4" label="pre-flight" width={300} height={620} background={PAPER}><Pre /></DCArtboard>
      <DCArtboard id="p5" label="active call" width={300} height={620} background={PAPER}><Active /></DCArtboard>
      <DCArtboard id="p6" label="post-call" width={300} height={620} background={PAPER}><Post /></DCArtboard>
    </DCSection>

    <DCSection id="log" title="call log (both kept)" subtitle="">
      <DCArtboard id="l1" label="timeline" width={300} height={620} background={PAPER}><LogA /></DCArtboard>
      <DCArtboard id="l2" label="transcript" width={300} height={620} background={PAPER}><LogB /></DCArtboard>
    </DCSection>

    <DCSection id="map" title="map (all three kept)" subtitle="">
      <DCArtboard id="m1" label="pins + filters" width={300} height={620} background={PAPER}><MapA /></DCArtboard>
      <DCArtboard id="m2" label="pin sheet" width={300} height={620} background={PAPER}><MapB /></DCArtboard>
      <DCArtboard id="m3" label="heatmap unlock" width={300} height={620} background={PAPER}><MapC /></DCArtboard>
    </DCSection>
  </DesignCanvas>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
