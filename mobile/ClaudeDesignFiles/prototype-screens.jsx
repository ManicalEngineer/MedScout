// MedScout hi-fi — screen components

// ═══════════════════════════════════════════════════════════════
// 1. DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({ onStartHunt }) => {
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const days = 6;
  const ringColor = days > 10 ? TOK.success : days >= 5 ? TOK.primary : TOK.danger;

  const recentCalls = [
    { n: "Walgreens · Main St", t: "2h ago", k: "out" },
    { n: "Corner Pharmacy", t: "Yesterday", k: "soon", label: "back Fri" },
    { n: "Target Rx", t: "Friday", k: "ok" },
    { n: "CVS · Main", t: "Thu", k: "ok" },
    { n: "Rite Aid · Pine", t: "Wed", k: "out" },
    { n: "Walmart Rx", t: "Tue", k: "soon", label: "back Sun" },
    { n: "Sav-On · 4th", t: "Mon", k: "ok" },
    { n: "Costco Pharmacy", t: "Last week", k: "out" },
    { n: "Walgreens · 5th", t: "Last week", k: "ok" },
  ];

  return (
    <div data-screen-label="01 Dashboard" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Fixed header region */}
      <div style={{ padding: "8px 16px 0", flexShrink: 0 }}>
        {!bannerDismissed && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: TOK.dangerDim, border: `1px solid rgba(239,68,68,0.3)`,
            borderRadius: 10, padding: "9px 12px", marginBottom: 16, fontSize: 12,
          }}>
            <Icon.alert size={16} stroke={TOK.danger}/>
            <span style={{ flex: 1, color: TOK.text }}>Regional shortage: <span style={{ color: TOK.textMuted }}>34% lower fills this week</span></span>
            <button onClick={() => setBannerDismissed(true)} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 2, display: "flex" }}>
              <Icon.x size={14}/>
            </button>
          </div>
        )}

        <div style={{ marginBottom: 4, fontSize: 13, color: TOK.textMuted }}>Adderall XR · 20mg</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 16px", letterSpacing: -0.6, lineHeight: 1.15 }}>You're 6 days ahead</h1>

        {/* Ring */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Ring days={days} color={ringColor}/>
        </div>

        <Btn variant="primary" size="lg" onClick={onStartHunt}>
          <Icon.phone size={18}/> Start today's hunt
        </Btn>

        <div style={{ marginTop: 12, marginBottom: 16, fontSize: 11, color: TOK.textDim, textAlign: "center", letterSpacing: 0.3 }}>5 PHARMACIES SAVED · 0 CALLED TODAY</div>
      </div>

      {/* Scrollable region: insight + recent calls */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px 16px", WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 20px), transparent)", maskImage: "linear-gradient(to bottom, black calc(100% - 20px), transparent)" }}>
        {/* Insight card */}
        <Card accent style={{ background: TOK.primaryDim, borderColor: "rgba(249,115,22,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TOK.primary, fontWeight: 600, letterSpacing: 0.6, marginBottom: 6 }}>
            <Icon.spark size={13} stroke={TOK.primary}/> INSIGHT
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: TOK.text }}>
            CVS Main has had stock <strong style={{ color: TOK.primary }}>3 of the last 4 weeks</strong> — your best near-term bet.
          </div>
        </Card>

        <div style={{ marginTop: 22, marginBottom: 8, fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6 }}>RECENT CALLS</div>
        <Card style={{ padding: 0 }}>
          {recentCalls.map((r, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px",
              borderBottom: i < recentCalls.length - 1 ? `0.5px solid ${TOK.borderSoft}` : "none",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{r.n}</div>
                <div style={{ fontSize: 11, color: TOK.textMuted, marginTop: 2 }}>{r.t}</div>
              </div>
              <Status kind={r.k} label={r.label}/>
            </div>
          ))}
        </Card>
      </div>
      <TabBar active="home"/>
    </div>
  );
};

// Animated progress ring
const Ring = ({ days, color }) => {
  const size = 168, stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(days / 14, 1);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={TOK.surface} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 12px ${color}80)`, transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, color: TOK.text, letterSpacing: -1.5 }}>{days}</div>
        <div style={{ fontSize: 10, color: TOK.textMuted, marginTop: 4, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 500 }}>days remaining</div>
        <div style={{ fontSize: 10, color: TOK.textDim, marginTop: 4 }}>est. May 12</div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 2. DIALER
// ═══════════════════════════════════════════════════════════════
const PHARMACIES = [
  { id: "wal-main", n: "Walgreens", sub: "Main St · 0.4mi", t: "2h ago", k: "out", v: false },
  { id: "corner", n: "Corner Pharmacy", sub: "Pine Ave · 0.8mi", t: "Yesterday", k: "soon", label: "back Fri", v: false },
  { id: "target", n: "Target Rx", sub: "12th St · 1.2mi", t: "Friday", k: "ok", v: false },
  { id: "family", n: "Family Care Rx", sub: "Oak St · 1.6mi", t: "—", k: "muted", label: "no calls", v: true },
  { id: "cvs-elm", n: "CVS", sub: "Elm Ave · 2.1mi", t: "Wed", k: "out", v: false },
];

const Dialer = ({ onCallPharmacy, segment, onSegmentChange }) => (
  <div data-screen-label="02 Dialer" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ padding: "4px 16px 0" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 4px", letterSpacing: -0.6 }}>Hunt</h1>
      <div style={{ fontSize: 13, color: TOK.textMuted, marginBottom: 16 }}>5 saved pharmacies · sorted by distance</div>

      {/* segmented control */}
      <div style={{ display: "flex", background: TOK.surface, borderRadius: 10, padding: 3, marginBottom: 16, border: `1px solid ${TOK.borderSoft}` }}>
        {[{id:"dial",l:"Dialer"},{id:"log",l:"Call Log"}].map(s => (
          <button key={s.id} onClick={() => onSegmentChange(s.id)} style={{
            flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600,
            background: segment === s.id ? TOK.primary : "transparent",
            color: segment === s.id ? "#0D1117" : TOK.textMuted,
            border: "none", borderRadius: 8,
            cursor: "pointer", fontFamily: "inherit",
          }}>{s.l}</button>
        ))}
      </div>
    </div>

    {segment === "dial" ? <DialerList onCallPharmacy={onCallPharmacy}/> : <CallLog/>}

    <TabBar active="hunt"/>
  </div>
);

const DialerList = ({ onCallPharmacy }) => (
  <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px", position: "relative" }}>
    <Card style={{ padding: 0 }}>
      {PHARMACIES.map((p, i) => (
        <div key={p.id} style={{
          display: "flex", alignItems: "center", padding: "14px",
          borderBottom: i < PHARMACIES.length - 1 ? `0.5px solid ${TOK.borderSoft}` : "none",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
              {p.v && <Icon.lock size={13} stroke={TOK.vault}/>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.n}</span>
            </div>
            <div style={{ fontSize: 11, color: TOK.textMuted, marginBottom: 4 }}>{p.sub} · {p.t}</div>
            <Status kind={p.k} label={p.label}/>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
            <button
              onClick={() => onCallPharmacy(p)}
              style={{
                width: 44, height: 44, borderRadius: 10,
                background: TOK.primaryDim, border: `1px solid ${TOK.primary}`,
                color: TOK.primary, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
              aria-label={`Call ${p.n}`}
            ><Icon.phone size={18} stroke={TOK.primary}/></button>
            <button style={{
              width: 44, height: 44, borderRadius: 10,
              background: "transparent", border: `1px solid ${TOK.border}`,
              color: TOK.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }} aria-label="View script"><Icon.doc size={18}/></button>
          </div>
        </div>
      ))}
    </Card>

    {/* Outline + add button (variant C styling) */}
    <button style={{
      position: "absolute", right: 20, bottom: 20,
      width: 52, height: 52, borderRadius: 999,
      background: TOK.bg, border: `1.5px solid ${TOK.primary}`,
      color: TOK.primary, display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", boxShadow: `0 4px 16px ${TOK.primaryGlow}`,
    }} aria-label="Add pharmacy"><Icon.plus size={22}/></button>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 3. CALL LOG
// ═══════════════════════════════════════════════════════════════
const LOG_ENTRIES = [
  { day: "TUESDAY · TODAY", items: [
    { n: "Walgreens · Main", t: "2:14p · 02:34", k: "out", takeaway: "No 20mg in stock; new shipment Friday afternoon" },
    { n: "Corner Pharmacy", t: "1:02p · 01:18", k: "soon", takeaway: "Shipment Thursday morning — call back early" },
  ]},
  { day: "MONDAY", items: [
    { n: "Target Rx", t: "Fri · 02:01", k: "ok", takeaway: "In stock; will not hold controlled substances" },
    { n: "Family Care Rx", t: "Thu · 00:54", k: "out", takeaway: "Out indefinitely — supplier issue", v: true },
  ]},
];

const CallLog = () => (
  <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
    {LOG_ENTRIES.map(group => (
      <div key={group.day}>
        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, margin: "12px 0 8px" }}>{group.day}</div>
        {group.items.map((r, i) => (
          <Card key={i} style={{
            marginBottom: 8, padding: 0,
            borderLeft: `3px solid ${r.k === "out" ? TOK.danger : r.k === "ok" ? TOK.success : TOK.primary}`,
            borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
          }}>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
                  {r.v && <Icon.lock size={12} stroke={TOK.vault}/>}
                  {r.n}
                </div>
                <button style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 4, display: "flex" }}><Icon.edit size={14}/></button>
              </div>
              <div style={{ fontSize: 11, color: TOK.textDim, marginTop: 2 }}>{r.t}</div>
              <div style={{
                marginTop: 10, padding: "8px 10px",
                background: TOK.primaryDim, borderRadius: 8,
                fontSize: 12, color: TOK.text, lineHeight: 1.4,
                display: "flex", gap: 6, alignItems: "flex-start",
              }}>
                <Icon.spark size={12} stroke={TOK.primary} sw={2.4}/>
                <span><span style={{ color: TOK.primary, fontWeight: 600 }}>Key takeaway · </span>{r.takeaway}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 4. PRE-FLIGHT
// ═══════════════════════════════════════════════════════════════
const TONES = [
  { id: "short", label: "Short", body: 'Hi — do you have 20mg Adderall XR in stock today?' },
  { id: "polite", label: "Polite", body: 'Hi, I\'m a patient checking if you\'re able to facilitate a transfer for 20mg Adderall XR. Is that something you currently have in stock?' },
  { id: "ins", label: "Insurance-first", body: 'Hi, I need to check stock and whether you accept BlueCross for a controlled substance transfer — 20mg Adderall XR.' },
];

const PreFlight = ({ pharmacy, onStartCall, onBack, onSkipScript }) => {
  const [tone, setTone] = React.useState("polite");
  const [grumpy, setGrumpy] = React.useState(false);
  const t = TONES.find(x => x.id === tone);
  const body = grumpy ? "Got 20mg Adderall XR?" : t.body;
  return (
    <div data-screen-label="03 Pre-Flight" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "8px 18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 10,
          background: TOK.surface, border: `1px solid ${TOK.borderSoft}`,
          color: TOK.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }} aria-label="Back"><Icon.back size={16}/></button>
        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.8 }}>PRE-FLIGHT</div>
        <button onClick={onSkipScript} style={{
          background: "none", border: "none", color: TOK.textMuted, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500,
        }}>Skip</button>
      </div>

      {/* Pharmacy header */}
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 4px", letterSpacing: -0.4 }}>{pharmacy.n}</h1>
      <div style={{ fontSize: 14, color: TOK.textMuted }}>(555) 123-4567</div>
      <div style={{ fontSize: 12, color: TOK.textDim, marginTop: 4, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
        Last call · 2h ago · <Status kind={pharmacy.k} label={pharmacy.label}/>
      </div>

      {/* Tone selector */}
      <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>TONE</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TONES.map(x => (
          <button key={x.id} onClick={() => setTone(x.id)} style={{
            flex: 1, padding: "9px 4px", fontSize: 12, fontWeight: 600,
            border: `1px solid ${tone === x.id ? TOK.primary : TOK.border}`,
            background: tone === x.id ? TOK.primaryDim : "transparent",
            color: tone === x.id ? TOK.primary : TOK.textMuted,
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>{x.label}</button>
        ))}
      </div>

      {/* Script — collapsible header with edit/regen */}
      <Card accent style={{ marginBottom: 12, background: TOK.surface, borderColor: TOK.primary, padding: 0, minHeight: 130, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `0.5px solid ${TOK.borderSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: TOK.primary, fontWeight: 700, letterSpacing: 0.8 }}>
            <Icon.spark size={12} stroke={TOK.primary}/> READ ALOUD
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 4, display: "flex", borderRadius: 6 }} aria-label="Edit"><Icon.edit size={14}/></button>
            <button style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 4, display: "flex", borderRadius: 6 }} aria-label="Regenerate"><Icon.rotate size={14}/></button>
          </div>
        </div>
        <div style={{ padding: 14, fontSize: 17, lineHeight: 1.45, color: TOK.text, fontWeight: 400 }}>
          "{body.split(/(20mg Adderall XR|BlueCross)/g).map((part, i) =>
            (part === "20mg Adderall XR" || part === "BlueCross")
              ? <span key={i} style={{ background: TOK.primaryDim, color: TOK.primary, padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>{part}</span>
              : <span key={i}>{part}</span>
          )}"
        </div>
      </Card>

      {/* Grumpy toggle */}
      <button onClick={() => setGrumpy(g => !g)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", marginBottom: 18,
        background: grumpy ? TOK.primaryDim : TOK.surface,
        border: `1px solid ${grumpy ? TOK.primary : TOK.borderSoft}`,
        borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, color: grumpy ? TOK.primary : TOK.text, fontSize: 13, fontWeight: 600 }}>
          <Icon.bolt size={14}/> Short version
        </span>
        <Toggle on={grumpy}/>
      </button>

      <div style={{ marginTop: "auto" }}>
        <Btn variant="primary" size="lg" onClick={onStartCall} style={{ marginBottom: 8 }}>
          <Icon.phone size={18}/> Start call
        </Btn>
        <Btn variant="ghost" onClick={onSkipScript}>Skip script</Btn>
      </div>
    </div>
  );
};

const Toggle = ({ on }) => (
  <div style={{
    width: 38, height: 22, borderRadius: 999,
    background: on ? TOK.primary : TOK.border,
    position: "relative", transition: "background 200ms",
  }}>
    <div style={{
      position: "absolute", top: 2, left: on ? 18 : 2,
      width: 18, height: 18, borderRadius: 999, background: "#fff",
      transition: "left 200ms",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    }}/>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 5. ACTIVE CALL (variant B — floating cards)
// ═══════════════════════════════════════════════════════════════
const ActiveCall = ({ pharmacy, onEnd }) => {
  const [duration, setDuration] = React.useState(8);
  const [tone, setTone] = React.useState("polite");
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    const id = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const t = TONES.find(x => x.id === tone);

  return (
    <div data-screen-label="04 Active Call" style={{ position: "relative", height: "100%", overflow: "hidden", background: "linear-gradient(180deg, #0D1117 0%, #1C232C 100%)" }}>
      {/* Native-call-UI mock (subtle, dimmed to show overlay coexists) */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 90, color: TOK.textMuted }}>
        <div style={{ width: 110, height: 110, borderRadius: 999, background: TOK.surface, border: `1px solid ${TOK.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: TOK.textMuted, marginBottom: 14 }}>
          <Icon.phone size={42}/>
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: TOK.text, marginBottom: 4 }}>{pharmacy.n}</div>
        <div style={{ fontSize: 14, color: TOK.success, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: TOK.success, boxShadow: `0 0 8px ${TOK.success}` }}/>
          Connected · {fmt(duration)}
        </div>
        <div style={{ fontSize: 10, color: TOK.textDim, marginTop: 28, fontStyle: "italic" }}>↑ native call UI ↑</div>

        {/* Call controls (mute / speaker / end) */}
        <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, display: "flex", justifyContent: "space-around", padding: "0 40px" }}>
          {[
            { i: "mic", label: "mute" },
            { i: "spk", label: "speaker" },
          ].map(c => (
            <div key={c.i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 60, height: 60, borderRadius: 999, background: TOK.surface, border: `1px solid ${TOK.border}` }}/>
              <span style={{ fontSize: 11, color: TOK.textMuted }}>{c.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <button onClick={onEnd} style={{
              width: 60, height: 60, borderRadius: 999, background: TOK.danger, border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(239,68,68,0.4)",
            }}>
              <Icon.phone size={22} stroke="#fff"/>
            </button>
            <span style={{ fontSize: 11, color: TOK.textMuted }}>end</span>
          </div>
        </div>
      </div>

      {/* Floating script card — collapses to pill */}
      {collapsed ? (
        <button onClick={() => setCollapsed(false)} style={{
          position: "absolute", top: 18, left: 14,
          background: "rgba(22,27,34,0.96)", backdropFilter: "blur(20px)",
          border: `1px solid ${TOK.primary}`, borderRadius: 999, padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "inherit",
          color: TOK.primary, fontSize: 12, fontWeight: 600,
          boxShadow: `0 4px 16px ${TOK.primaryGlow}`,
        }}>
          <Icon.spark size={14} stroke={TOK.primary}/> Script
        </button>
      ) : (
      <div style={{
        position: "absolute", top: 18, left: 14, right: 14,
        background: "rgba(22,27,34,0.96)", backdropFilter: "blur(20px)",
        border: `1px solid ${TOK.primary}`, borderRadius: 16, padding: 14,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 4px ${TOK.primaryGlow}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 10, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: TOK.textMuted }}>
            <Icon.drag size={14} stroke={TOK.textMuted}/> SCRIPT · DRAG
          </span>
          <button onClick={() => setCollapsed(true)} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 2, display: "flex" }}>
            <Icon.minus size={14}/>
          </button>
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.4, color: TOK.text, marginBottom: 10 }}>"{t.body}"</div>
        <div style={{ display: "flex", gap: 4 }}>
          {TONES.map(x => (
            <button key={x.id} onClick={() => setTone(x.id)} style={{
              flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 600,
              border: `1px solid ${tone === x.id ? TOK.primary : TOK.border}`,
              background: tone === x.id ? TOK.primaryDim : "transparent",
              color: tone === x.id ? TOK.primary : TOK.textMuted,
              borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
            }}>{x.label.split("/")[0]}</button>
          ))}
        </div>
      </div>
      )}

      {/* Live transcribe pill */}
      <div style={{
        position: "absolute", bottom: 24, left: 14, right: 14,
        background: TOK.successDim, border: `1px solid ${TOK.success}`,
        borderRadius: 10, padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 11, color: TOK.success, fontWeight: 500,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: TOK.success, animation: "pulse 1.4s infinite" }}/>
        <span style={{ flex: 1, color: TOK.text, fontWeight: 400, fontSize: 12, fontStyle: "italic" }}>"...we have 30mg but not 20..."</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 6. POST-CALL (variant B — inline strip in dialer)
// ═══════════════════════════════════════════════════════════════
const PostCall = ({ pharmacy, onConfirm, onDiscard, onCallPharmacy, onSegmentChange }) => (
  <div data-screen-label="05 Post-Call" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ padding: "4px 16px 0" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 4px", letterSpacing: -0.6 }}>Hunt</h1>
      <div style={{ fontSize: 13, color: TOK.textMuted, marginBottom: 16 }}>5 saved pharmacies · sorted by distance</div>
      <div style={{ display: "flex", background: TOK.surface, borderRadius: 10, padding: 3, marginBottom: 16, border: `1px solid ${TOK.borderSoft}` }}>
        {[{id:"dial",l:"Dialer"},{id:"log",l:"Call Log"}].map(s => (
          <button key={s.id} onClick={() => onSegmentChange(s.id)} style={{
            flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600,
            background: s.id === "dial" ? TOK.primary : "transparent",
            color: s.id === "dial" ? "#0D1117" : TOK.textMuted,
            border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
          }}>{s.l}</button>
        ))}
      </div>
    </div>

    <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
      {/* Just-called card */}
      <Card accent style={{
        marginBottom: 12, background: TOK.surface,
        borderColor: TOK.primary, boxShadow: `0 0 0 4px ${TOK.primaryGlow}`,
        animation: "slideDown 350ms ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: TOK.primary, fontWeight: 700, letterSpacing: 0.8, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: TOK.primary }}/>
          JUST CALLED · {pharmacy.n.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: TOK.textDim, marginBottom: 8 }}>I heard:</div>
        <div style={{ fontSize: 15, lineHeight: 1.4, color: TOK.text, marginBottom: 12 }}>
          <Status kind="ok" label="In stock" style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}/>
          · 20mg XR · arriving <strong style={{ color: TOK.primary }}>Friday</strong>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="success" size="sm" full={false} style={{ flex: 2 }} onClick={onConfirm}>
            <Icon.check size={16}/> Confirm
          </Btn>
          <Btn variant="ghost" size="sm" full={false} style={{ flex: 1 }}>
            <Icon.edit size={14}/> Edit
          </Btn>
          <Btn variant="ghost" size="sm" full={false} style={{ flex: 1 }} onClick={onDiscard}>
            Discard
          </Btn>
        </div>
      </Card>

      <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, margin: "12px 0 8px" }}>EARLIER TODAY</div>
      <Card style={{ padding: 0 }}>
        {PHARMACIES.slice(1, 4).map((p, i) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", padding: "12px 14px",
            borderBottom: i < 2 ? `0.5px solid ${TOK.borderSoft}` : "none",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                {p.v && <Icon.lock size={12} stroke={TOK.vault}/>}
                {p.n}
              </div>
              <div style={{ fontSize: 11, color: TOK.textMuted, marginTop: 2 }}>{p.t}</div>
            </div>
            <Status kind={p.k} label={p.label}/>
          </div>
        ))}
      </Card>

      <Btn variant="ghost" style={{ marginTop: 16 }} onClick={() => onCallPharmacy(PHARMACIES[1])}>
        <Icon.phone size={16}/> Continue hunt — Corner Pharmacy
      </Btn>
    </div>
    <TabBar active="hunt"/>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 7. MAP
// ═══════════════════════════════════════════════════════════════
const PINS = [
  { x: 35, y: 28, c: TOK.success, l: "10m", n: "Westside Pharmacy", reps: 3 },
  { x: 68, y: 42, c: "#eab308", l: "4h", n: "Mile End Rx", reps: 1 },
  { x: 28, y: 58, c: TOK.danger, l: "out", n: "Walgreens · Main", reps: 2 },
  { x: 58, y: 72, c: TOK.textMuted, l: "2d", n: "CVS · Elm", reps: 1 },
  { x: 78, y: 25, c: TOK.success, l: "30m", n: "Target Rx", reps: 4 },
];

const MapScreen = ({ onUnlockVault }) => {
  const [filter, setFilter] = React.useState({ logs: false, comm: true, off: true });
  const [selectedPin, setSelectedPin] = React.useState(null);
  const [vaultUnlocked, setVaultUnlocked] = React.useState(false);
  const [showG2G, setShowG2G] = React.useState(false);
  const handleHeatmap = () => {
    if (vaultUnlocked) return;
    setShowG2G(true);
  };
  return (
    <div data-screen-label="06 Map" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 0", letterSpacing: -0.6 }}>Map</h1>
          <span style={{ fontSize: 12, color: TOK.textMuted }}>92706 · 5mi</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { id: "logs", l: "My Logs" },
            { id: "comm", l: "Community" },
            { id: "off", l: "Official" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(s => ({ ...s, [f.id]: !s[f.id] }))} style={{
              flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600,
              border: `1px solid ${filter[f.id] ? TOK.primary : TOK.border}`,
              background: filter[f.id] ? TOK.primaryDim : "transparent",
              color: filter[f.id] ? TOK.primary : TOK.textMuted,
              borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Map area */}
      <div style={{ flex: 1, margin: "0 16px 12px", borderRadius: 16, position: "relative", overflow: "hidden", background: "#0a0e14", border: `1px solid ${TOK.border}` }}>
        {/* fake map grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}/>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <path d="M 0 60% Q 30% 40% 60% 70% T 100% 50%" stroke="#1f2530" strokeWidth="3" fill="none"/>
          <path d="M 30% 0 Q 35% 40% 30% 100%" stroke="#1f2530" strokeWidth="3" fill="none"/>
          <path d="M 70% 0 Q 65% 50% 75% 100%" stroke="#1f2530" strokeWidth="3" fill="none"/>
        </svg>

        {PINS.map((p, i) => (
          <button key={i} onClick={() => setSelectedPin(p)} style={{
            position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
            transform: "translate(-50%, -100%)",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50% 50% 50% 0",
              transform: "rotate(-45deg)", background: p.c, border: "2px solid #0D1117",
              boxShadow: `0 2px 8px ${p.c}80`,
            }}/>
            <div style={{
              position: "absolute", top: 26, left: "50%", transform: "translateX(-50%)",
              fontSize: 9, padding: "2px 6px", borderRadius: 4,
              background: TOK.surface, color: p.c, fontWeight: 600,
              whiteSpace: "nowrap", border: `1px solid ${p.c}`,
            }}>{p.l}</div>
          </button>
        ))}

        {/* heatmap toggle */}
        <button onClick={handleHeatmap} style={{
          position: "absolute", top: 12, right: 12,
          background: vaultUnlocked ? TOK.vaultDim : TOK.surface,
          border: `1px solid ${TOK.vault}`,
          color: TOK.vault, borderRadius: 10, padding: "8px 10px",
          display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          {vaultUnlocked ? <Icon.spark size={13} stroke={TOK.vault}/> : <Icon.lock size={13} stroke={TOK.vault}/>}
          Heatmap
        </button>

        {/* Heatmap overlay (when unlocked) */}
        {vaultUnlocked && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(circle at 35% 28%, rgba(34,197,94,0.25), transparent 18%), radial-gradient(circle at 78% 25%, rgba(34,197,94,0.25), transparent 18%), radial-gradient(circle at 68% 42%, rgba(234,179,8,0.22), transparent 16%), radial-gradient(circle at 28% 58%, rgba(239,68,68,0.22), transparent 14%)",
            mixBlendMode: "screen",
          }}/>
        )}

        {/* Give-to-get prompt */}
        {showG2G && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(13,17,23,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <Card style={{ borderColor: TOK.vault, background: TOK.surface, padding: 18, width: "100%", maxWidth: 320 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: TOK.vault, fontWeight: 700, fontSize: 11, letterSpacing: 0.8 }}>
                <Icon.lock size={14} stroke={TOK.vault}/> COMMUNITY HEATMAP
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Give to get</div>
              <div style={{ fontSize: 13, color: TOK.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
                Log <strong style={{ color: TOK.vault }}>1 verified call</strong> from your hunt this week to unlock the community heatmap for 7 days. Your data stays anonymous.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" size="sm" full={false} style={{ flex: 1 }} onClick={() => setShowG2G(false)}>Later</Btn>
                <Btn variant="primary" size="sm" full={false} style={{ flex: 2, background: TOK.vault, borderColor: TOK.vault }} onClick={() => { setShowG2G(false); if (onUnlockVault) onUnlockVault(() => setVaultUnlocked(true)); else setVaultUnlocked(true); }}>
                  <Icon.faceid size={14}/> Unlock with Face ID
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* legend */}
        <div style={{
          position: "absolute", bottom: 12, left: 12, right: 12,
          background: "rgba(22,27,34,0.9)", backdropFilter: "blur(8px)",
          border: `1px solid ${TOK.borderSoft}`, borderRadius: 10, padding: "8px 12px",
          display: "flex", justifyContent: "space-between", fontSize: 10, color: TOK.textMuted, fontWeight: 500,
        }}>
          <span>● <span style={{ color: TOK.success }}>fresh</span></span>
          <span>● <span style={{ color: "#eab308" }}>2-24h</span></span>
          <span>● <span style={{ color: TOK.textMuted }}>old</span></span>
          <span>● <span style={{ color: TOK.danger }}>out</span></span>
        </div>

        {/* Pin sheet */}
        {selectedPin && (
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            background: TOK.surface, borderTop: `1px solid ${TOK.border}`,
            borderRadius: "16px 16px 0 0", padding: 16,
            animation: "slideUp 250ms ease",
          }}>
            <div style={{ width: 40, height: 4, background: TOK.border, borderRadius: 2, margin: "0 auto 12px" }}/>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedPin.n}</div>
                <div style={{ fontSize: 11, color: TOK.textMuted, marginTop: 2 }}>0.7mi · community</div>
              </div>
              <Badge kind="success">Verified {selectedPin.l}</Badge>
            </div>
            <div style={{ fontSize: 13, color: TOK.text, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 12 }}>
              20mg XR reported in stock by <span style={{ color: TOK.primary, fontWeight: 600 }}>{selectedPin.reps} contributors</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" size="sm" full={false} style={{ flex: 2 }}>
                <Icon.phone size={15}/> Call now
              </Btn>
              <Btn variant="ghost" size="sm" full={false} style={{ flex: 1 }} onClick={() => setSelectedPin(null)}>Close</Btn>
            </div>
          </div>
        )}
      </div>
      <TabBar active="map"/>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PROFILE — vault, streak, contribution stats
// ═══════════════════════════════════════════════════════════════
const Profile = () => (
  <div data-screen-label="07 Profile" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 16px" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 16px", letterSpacing: -0.6 }}>Me</h1>

      <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: TOK.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon.user size={24} stroke={TOK.textMuted}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Alex Chen</div>
          <div style={{ fontSize: 12, color: TOK.textMuted }}>Adderall XR · 20mg · 30/mo</div>
        </div>
        <Badge kind="primary">Contributor</Badge>
      </Card>

      {/* Streak + contribution stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <Card style={{ padding: "12px 10px", textAlign: "center" }}>
          <Icon.flame size={20} stroke={TOK.primary}/>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: TOK.primary }}>7</div>
          <div style={{ fontSize: 10, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.4, marginTop: 2 }}>DAY STREAK</div>
        </Card>
        <Card style={{ padding: "12px 10px", textAlign: "center" }}>
          <Icon.share size={20} stroke={TOK.success}/>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: TOK.success }}>23</div>
          <div style={{ fontSize: 10, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.4, marginTop: 2 }}>CONTRIBUTED</div>
        </Card>
        <Card style={{ padding: "12px 10px", textAlign: "center" }}>
          <Icon.trophy size={20} stroke={TOK.vault}/>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: TOK.vault }}>L3</div>
          <div style={{ fontSize: 10, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.4, marginTop: 2 }}>SCOUT TIER</div>
        </Card>
      </div>

      {/* Vault card */}
      <Card style={{ marginBottom: 16, background: TOK.vaultDim, borderColor: "rgba(139,92,246,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: TOK.vault, fontWeight: 700, letterSpacing: 0.6 }}>
            <Icon.lock size={13} stroke={TOK.vault}/> VAULT
          </div>
          <Badge kind="vault">Locked</Badge>
        </div>
        <div style={{ fontSize: 14, color: TOK.text, lineHeight: 1.4, marginBottom: 10 }}>1 pharmacy stored privately · last unlocked Mon</div>
        <Btn variant="outline" size="sm" style={{ borderColor: TOK.vault, color: TOK.vault }}><Icon.faceid size={14} stroke={TOK.vault}/> Unlock with Face ID</Btn>
      </Card>

      <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, margin: "8px 0 8px" }}>SETTINGS</div>
      <Card style={{ padding: 0 }}>
        {[
          { l: "Refill setup", v: "30 days · last fill Apr 12" },
          { l: "Pharmacies", v: "5 saved · 1 vaulted" },
          { l: "Notifications", v: "Quiet 10p–8a" },
          { l: "Privacy & Vault", v: "Face ID required" },
          { l: "Subscription", v: "Free", last: true },
        ].map((r, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px", borderBottom: !r.last ? `0.5px solid ${TOK.borderSoft}` : "none",
            cursor: "pointer",
          }}>
            <div style={{ fontSize: 15 }}>{r.l}</div>
            <div style={{ fontSize: 12, color: TOK.textMuted }}>{r.v} ›</div>
          </div>
        ))}
      </Card>
    </div>
    <TabBar active="me"/>
  </div>
);

Object.assign(window, { Dashboard, Dialer, PreFlight, ActiveCall, PostCall, MapScreen, Profile, PHARMACIES });
