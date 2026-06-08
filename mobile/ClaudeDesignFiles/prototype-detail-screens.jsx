// MedScout hi-fi — high-priority detail screens
// PharmacyDetail · AddPharmacy · Refill · EditMedication · CommunityContribute

// ═══════════════════════════════════════════════════════════════
// PHARMACY DETAIL
// ═══════════════════════════════════════════════════════════════
const PharmacyDetail = ({ pharmacy, onBack, onCall }) => {
  const p = pharmacy || PHARMACIES[0];
  const history = [
    { d: "Tue 2:14p", k: "out", note: "No 20mg; new shipment Friday" },
    { d: "Fri 11:02a", k: "ok", note: "In stock, 30 ct available" },
    { d: "Wed 9:30a", k: "soon", note: "Out — restock Monday" },
    { d: "Mon 4:15p", k: "out", note: "Supplier delay" },
    { d: "Last week", k: "ok", note: "In stock" },
  ];
  return (
    <div data-screen-label="11 Pharmacy Detail" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 6px" }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, background: TOK.surface, border: `1px solid ${TOK.borderSoft}`, color: TOK.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon.back size={16}/></button>
        <button style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 6, display: "flex" }}><Icon.share size={18}/></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        <div style={{ marginBottom: 4, fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6 }}>PHARMACY · 0.4 MI</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "4px 0 6px", letterSpacing: -0.4 }}>{p.n}</h1>
        <div style={{ fontSize: 14, color: TOK.textMuted, marginBottom: 4 }}>(555) 123-4567 · 1421 Main St</div>
        <Status kind={p.k} label={p.label} style={{ fontSize: 13 }}/>

        <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 18 }}>
          <Btn variant="primary" size="md" full={false} style={{ flex: 2 }} onClick={() => onCall(p)}>
            <Icon.phone size={16}/> Call
          </Btn>
          <Btn variant="dark" size="md" full={false} style={{ flex: 1 }}><Icon.pin size={15}/> Map</Btn>
          <Btn variant="dark" size="md" full={false} style={{ flex: 1 }}><Icon.bolt size={15}/> Primary</Btn>
        </div>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>HOURS</div>
        <Card style={{ padding: 0, marginBottom: 16 }}>
          {[
            { d: "Today (Tue)", h: "8a–10p", open: true },
            { d: "Wed", h: "8a–10p" },
            { d: "Thu", h: "8a–10p" },
            { d: "Fri", h: "8a–9p" },
            { d: "Sat", h: "9a–6p" },
            { d: "Sun", h: "10a–5p", last: true },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: !r.last ? `0.5px solid ${TOK.borderSoft}` : "none", fontSize: 13 }}>
              <span style={{ color: r.open ? TOK.success : TOK.textMuted, fontWeight: r.open ? 600 : 500 }}>{r.d}</span>
              <span style={{ color: TOK.text }}>{r.h}</span>
            </div>
          ))}
        </Card>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>POLICIES</div>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}><span style={{ color: TOK.textMuted }}>Holds C-II</span><span style={{ color: TOK.danger, fontWeight: 600 }}>No</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}><span style={{ color: TOK.textMuted }}>Accepts transfers</span><span style={{ color: TOK.success, fontWeight: 600 }}>Yes</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}><span style={{ color: TOK.textMuted }}>Insurance</span><span style={{ color: TOK.text }}>BlueCross, Aetna</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}><span style={{ color: TOK.textMuted }}>Typical wait</span><span style={{ color: TOK.text }}>15 min</span></div>
        </Card>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>CALL HISTORY · {history.length}</div>
        <Card style={{ padding: 0 }}>
          {history.map((h, i) => (
            <div key={i} style={{ padding: "11px 14px", borderBottom: i < history.length - 1 ? `0.5px solid ${TOK.borderSoft}` : "none", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: h.k === "ok" ? TOK.success : h.k === "out" ? TOK.danger : TOK.primary, marginTop: 6, flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: TOK.textMuted, marginBottom: 2 }}>{h.d}</div>
                <div style={{ fontSize: 13, color: TOK.text }}>{h.note}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ADD PHARMACY
// ═══════════════════════════════════════════════════════════════
const AddPharmacy = ({ onBack, onAdd }) => {
  const [tab, setTab] = React.useState("search"); // search | manual
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState([]);
  const NEAR = [
    { n: "Walmart Pharmacy", dist: "1.8mi", addr: "3500 W First St" },
    { n: "Sav-On · 4th", dist: "2.1mi", addr: "120 4th Ave" },
    { n: "Costco Rx", dist: "2.4mi", addr: "Auto Center Dr" },
    { n: "Rite Aid · Bristol", dist: "2.9mi", addr: "200 Bristol Pl" },
    { n: "Vons Pharmacy", dist: "3.2mi", addr: "880 Tustin Ave" },
    { n: "Ralphs Rx", dist: "3.7mi", addr: "1000 N Main" },
  ];
  const filtered = NEAR.filter(p => !query || p.n.toLowerCase().includes(query.toLowerCase()));
  return (
    <div data-screen-label="12 Add Pharmacy" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: 4 }}>Cancel</button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Add Pharmacy</div>
        <button disabled={picked.length === 0} onClick={() => onAdd(picked)} style={{ background: "none", border: "none", color: picked.length ? TOK.primary : TOK.textDim, cursor: picked.length ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 600, fontFamily: "inherit", padding: 4 }}>Add{picked.length ? ` (${picked.length})` : ""}</button>
      </div>
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ display: "flex", background: TOK.surface, borderRadius: 10, padding: 3, marginBottom: 12, border: `1px solid ${TOK.borderSoft}` }}>
          {[{id:"search",l:"Nearby"},{id:"manual",l:"Enter Manually"}].map(s => (
            <button key={s.id} onClick={() => setTab(s.id)} style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600, background: tab === s.id ? TOK.primary : "transparent", color: tab === s.id ? "#0D1117" : TOK.textMuted, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>{s.l}</button>
          ))}
        </div>
      </div>
      {tab === "search" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "0 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10, marginBottom: 10 }}>
            <Icon.search size={16} stroke={TOK.textMuted}/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or ZIP" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: TOK.text, fontFamily: "inherit" }}/>
          </div>
          <div style={{ flex: 1, overflowY: "auto", marginRight: -4, paddingRight: 4 }}>
            {filtered.map((p, i) => {
              const sel = picked.includes(p.n);
              return (
                <button key={i} onClick={() => setPicked(s => sel ? s.filter(x => x !== p.n) : [...s, p.n])} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: sel ? TOK.primaryDim : TOK.surface, border: `1px solid ${sel ? TOK.primary : TOK.borderSoft}`, borderRadius: 10, marginBottom: 6, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <Icon.pin size={18} stroke={sel ? TOK.primary : TOK.textMuted}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TOK.text }}>{p.n}</div>
                    <div style={{ fontSize: 11, color: TOK.textDim, marginTop: 2 }}>{p.dist} · {p.addr}</div>
                  </div>
                  {sel ? <Icon.check size={18} stroke={TOK.primary}/> : <Icon.plus size={18} stroke={TOK.textMuted}/>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: "0 16px 16px", overflowY: "auto" }}>
          {[
            { l: "NAME", ph: "Corner Pharmacy" },
            { l: "PHONE", ph: "(555) 123-4567" },
            { l: "ADDRESS", ph: "1421 Main St" },
            { l: "ZIP", ph: "92706" },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 6 }}>{f.l}</div>
              <input placeholder={f.ph} style={{ width: "100%", padding: "12px 14px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10, color: TOK.text, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}/>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", marginTop: 4, background: TOK.vaultDim, border: `1px solid rgba(139,92,246,0.4)`, borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TOK.text }}>Vaulted</div>
              <div style={{ fontSize: 11, color: TOK.textMuted, marginTop: 2 }}>Hide from community contributions</div>
            </div>
            <Toggle on={true}/>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REFILL — log a successful pickup
// ═══════════════════════════════════════════════════════════════
const Refill = ({ onBack, onConfirm }) => {
  const [pharm, setPharm] = React.useState(PHARMACIES[2].n);
  const [date, setDate] = React.useState("today");
  const [count, setCount] = React.useState(30);
  const [notes, setNotes] = React.useState("");
  return (
    <div data-screen-label="13 Refill" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: 4 }}>Cancel</button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Log Refill</div>
        <div style={{ width: 50 }}/>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 16px" }}>
        <Card success style={{ marginBottom: 18, background: TOK.successDim, borderColor: TOK.success, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 42, height: 42, borderRadius: 999, background: "rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon.check size={22} stroke={TOK.success}/>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: TOK.text }}>Picked up successfully</div>
            <div style={{ fontSize: 12, color: TOK.textMuted, marginTop: 2 }}>This resets your ring to {count} days.</div>
          </div>
        </Card>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>FILLED AT</div>
        <Card style={{ padding: 0, marginBottom: 16 }}>
          {PHARMACIES.slice(0, 4).map((p, i) => (
            <button key={p.id} onClick={() => setPharm(p.n)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: i < 3 ? `0.5px solid ${TOK.borderSoft}` : "none", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <div style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${pharm === p.n ? TOK.primary : TOK.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pharm === p.n && <div style={{ width: 9, height: 9, borderRadius: 999, background: TOK.primary }}/>}
              </div>
              <span style={{ flex: 1, fontSize: 14, color: TOK.text }}>{p.n}</span>
              <span style={{ fontSize: 11, color: TOK.textDim }}>{p.sub.split(" · ")[1]}</span>
            </button>
          ))}
        </Card>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>WHEN</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[{id:"today",l:"Today"},{id:"yest",l:"Yesterday"},{id:"pick",l:"Pick date"}].map(d => (
            <button key={d.id} onClick={() => setDate(d.id)} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: `1px solid ${date === d.id ? TOK.primary : TOK.border}`, background: date === d.id ? TOK.primaryDim : "transparent", color: date === d.id ? TOK.primary : TOK.textMuted, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>{d.l}</button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>DAYS DISPENSED</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10, marginBottom: 16 }}>
          <button onClick={() => setCount(Math.max(1, count - 1))} style={{ width: 32, height: 32, borderRadius: 8, background: TOK.surface2, border: `1px solid ${TOK.border}`, color: TOK.text, cursor: "pointer", fontSize: 18 }}>−</button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600 }}>{count} <span style={{ fontSize: 13, color: TOK.textMuted, fontWeight: 400 }}>days</span></div>
          <button onClick={() => setCount(count + 1)} style={{ width: 32, height: 32, borderRadius: 8, background: TOK.surface2, border: `1px solid ${TOK.border}`, color: TOK.text, cursor: "pointer", fontSize: 18 }}>+</button>
        </div>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>NOTES <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="e.g. switched to generic, $25 with insurance" style={{ width: "100%", padding: "12px 14px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10, color: TOK.text, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", resize: "none" }}/>

        <div style={{ marginTop: 18 }}>
          <Btn variant="success" size="lg" onClick={onConfirm}><Icon.check size={18}/> Confirm refill</Btn>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// EDIT MEDICATION
// ═══════════════════════════════════════════════════════════════
const EditMedication = ({ onBack, onAddNew }) => {
  const meds = [
    { brand: "Adderall XR", form: "ER cap", dose: "20mg", supply: "30 days", primary: true, active: true },
    { brand: "Vyvanse", form: "cap", dose: "30mg", supply: "30 days", active: false },
  ];
  return (
    <div data-screen-label="14 Edit Medication" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 0" }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 10, background: TOK.surface, border: `1px solid ${TOK.borderSoft}`, color: TOK.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon.back size={16}/></button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Medications</div>
        <button onClick={onAddNew} style={{ background: "none", border: "none", color: TOK.primary, cursor: "pointer", padding: 6, display: "flex" }}><Icon.plus size={20}/></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {meds.map((m, i) => (
          <Card key={i} style={{ marginBottom: 12, padding: 0 }}>
            <div style={{ padding: 14, borderBottom: `0.5px solid ${TOK.borderSoft}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: TOK.text }}>{m.brand}</span>
                  {m.primary && <Badge kind="primary">Primary</Badge>}
                  {!m.active && <Badge kind="muted">Inactive</Badge>}
                </div>
                <div style={{ fontSize: 12, color: TOK.textMuted }}>{m.form} · {m.dose} · {m.supply}</div>
              </div>
              <button style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 6, display: "flex" }}><Icon.edit size={16}/></button>
            </div>
            <div style={{ padding: "8px 14px", display: "flex", gap: 6 }}>
              {!m.primary && <Btn variant="ghost" size="sm" full={false}>Set primary</Btn>}
              <Btn variant="ghost" size="sm" full={false}>{m.active ? "Mark inactive" : "Reactivate"}</Btn>
              <Btn variant="ghost" size="sm" full={false} style={{ color: TOK.danger, borderColor: "rgba(239,68,68,0.3)" }}>Remove</Btn>
            </div>
          </Card>
        ))}

        <Btn variant="outline" size="md" onClick={onAddNew} style={{ marginTop: 8 }}><Icon.plus size={16}/> Add another medication</Btn>

        <div style={{ marginTop: 24, padding: 14, background: TOK.surface, border: `1px solid ${TOK.borderSoft}`, borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 6 }}>WHY ADD MORE?</div>
          <div style={{ fontSize: 13, color: TOK.textMuted, lineHeight: 1.45 }}>Track multiple meds independently — afternoon booster, sleep aid, or a kid's prescription. Each gets its own ring + hunt list.</div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// COMMUNITY CONTRIBUTE — give-to-unlock
// ═══════════════════════════════════════════════════════════════
const CommunityContribute = ({ onBack, onSubmit }) => {
  const [pharm, setPharm] = React.useState("");
  const [status, setStatus] = React.useState(null); // ok | out | soon
  const [confidence, setConfidence] = React.useState("called");
  return (
    <div data-screen-label="15 Contribute" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", fontSize: 14, fontFamily: "inherit", padding: 4 }}>Cancel</button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Contribute</div>
        <div style={{ width: 50 }}/>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <Card style={{ marginBottom: 18, background: TOK.vaultDim, borderColor: "rgba(139,92,246,0.4)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TOK.vault, fontWeight: 700, letterSpacing: 0.6, marginBottom: 6 }}>
            <Icon.lock size={13} stroke={TOK.vault}/> GIVE-TO-GET
          </div>
          <div style={{ fontSize: 13, color: TOK.text, lineHeight: 1.45 }}>
            Share one stock report → unlock the community heatmap for <strong style={{ color: TOK.vault }}>24 hours</strong>. Your name and meds stay private.
          </div>
        </Card>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>WHICH PHARMACY?</div>
        <Card style={{ padding: 0, marginBottom: 16 }}>
          {PHARMACIES.slice(0, 3).map((p, i) => (
            <button key={p.id} onClick={() => setPharm(p.n)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < 2 ? `0.5px solid ${TOK.borderSoft}` : "none", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <div style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${pharm === p.n ? TOK.primary : TOK.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pharm === p.n && <div style={{ width: 9, height: 9, borderRadius: 999, background: TOK.primary }}/>}
              </div>
              <span style={{ flex: 1, fontSize: 14, color: TOK.text }}>{p.n}</span>
            </button>
          ))}
        </Card>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>WHAT DID YOU FIND?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {[
            { id: "ok", l: "In stock", c: TOK.success },
            { id: "soon", l: "Restocking soon", c: TOK.primary },
            { id: "out", l: "Out of stock", c: TOK.danger },
          ].map(s => (
            <button key={s.id} onClick={() => setStatus(s.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: `1px solid ${status === s.id ? s.c : TOK.borderSoft}`, background: status === s.id ? `${s.c}1a` : TOK.surface, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: s.c }}/>
              <span style={{ fontSize: 14, fontWeight: 500, color: status === s.id ? s.c : TOK.text }}>{s.l}</span>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>HOW DID YOU CONFIRM?</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[{id:"called",l:"Called"},{id:"visited",l:"In person"},{id:"app",l:"Their app"}].map(c => (
            <button key={c.id} onClick={() => setConfidence(c.id)} style={{ flex: 1, padding: "9px 4px", fontSize: 12, fontWeight: 600, border: `1px solid ${confidence === c.id ? TOK.primary : TOK.border}`, background: confidence === c.id ? TOK.primaryDim : "transparent", color: confidence === c.id ? TOK.primary : TOK.textMuted, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>{c.l}</button>
          ))}
        </div>

        <Card style={{ marginBottom: 16, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <Icon.lock size={18} stroke={TOK.textMuted}/>
          <div style={{ flex: 1, fontSize: 12, color: TOK.textMuted, lineHeight: 1.4 }}>
            We share <strong style={{ color: TOK.text }}>medication class only</strong> — not your specific drug or dose.
          </div>
        </Card>

        <Btn variant="primary" size="lg" disabled={!pharm || !status} onClick={onSubmit}>
          <Icon.spark size={16}/> Submit & unlock heatmap
        </Btn>
      </div>
    </div>
  );
};

Object.assign(window, { PharmacyDetail, AddPharmacy, Refill, EditMedication, CommunityContribute });
