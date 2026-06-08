// MedScout hi-fi — additional screens (onboarding, vault, notification, polished post-call etc.)

// ═══════════════════════════════════════════════════════════════
// ADHD MEDICATION CATALOG — current US-prescribed meds (2025/26)
// ═══════════════════════════════════════════════════════════════
const ADHD_MEDS = [
  // ─── Amphetamine-class stimulants ───
  { brand: "Adderall",     form: "IR",       generic: "mixed amphetamine salts",     cls: "stim-amp", doses: ["5mg","7.5mg","10mg","12.5mg","15mg","20mg","30mg"] },
  { brand: "Adderall XR",  form: "ER cap",   generic: "mixed amphetamine salts",     cls: "stim-amp", doses: ["5mg","10mg","15mg","20mg","25mg","30mg"] },
  { brand: "Mydayis",      form: "ER cap",   generic: "mixed amphetamine salts",     cls: "stim-amp", doses: ["12.5mg","25mg","37.5mg","50mg"] },
  { brand: "Vyvanse",      form: "cap",      generic: "lisdexamfetamine",            cls: "stim-amp", doses: ["10mg","20mg","30mg","40mg","50mg","60mg","70mg"] },
  { brand: "Vyvanse",      form: "chewable", generic: "lisdexamfetamine",            cls: "stim-amp", doses: ["10mg","20mg","30mg","40mg","50mg","60mg"] },
  { brand: "Dexedrine",    form: "IR",       generic: "dextroamphetamine",           cls: "stim-amp", doses: ["5mg","10mg"] },
  { brand: "Dexedrine",    form: "Spansule", generic: "dextroamphetamine ER",        cls: "stim-amp", doses: ["5mg","10mg","15mg"] },
  { brand: "Zenzedi",      form: "IR",       generic: "dextroamphetamine",           cls: "stim-amp", doses: ["2.5mg","5mg","7.5mg","10mg","15mg","20mg","30mg"] },
  { brand: "Evekeo",       form: "IR",       generic: "amphetamine sulfate",         cls: "stim-amp", doses: ["5mg","10mg"] },
  { brand: "Evekeo ODT",   form: "ODT",      generic: "amphetamine sulfate",         cls: "stim-amp", doses: ["5mg","10mg","15mg","20mg"] },
  { brand: "Dyanavel XR",  form: "liquid",   generic: "amphetamine ER",              cls: "stim-amp", doses: ["2.5mg/mL"] },
  { brand: "Dyanavel XR",  form: "chewable", generic: "amphetamine ER",              cls: "stim-amp", doses: ["5mg","10mg","15mg","20mg"] },
  { brand: "Adzenys XR-ODT", form: "ODT",    generic: "amphetamine ER",              cls: "stim-amp", doses: ["3.1mg","6.3mg","9.4mg","12.5mg","15.7mg","18.8mg"] },
  { brand: "Xelstrym",     form: "patch",    generic: "dextroamphetamine TD",        cls: "stim-amp", doses: ["4.5mg","9mg","13.5mg","18mg"] },

  // ─── Methylphenidate-class stimulants ───
  { brand: "Ritalin",      form: "IR",       generic: "methylphenidate",             cls: "stim-mph", doses: ["5mg","10mg","20mg"] },
  { brand: "Ritalin LA",   form: "ER cap",   generic: "methylphenidate",             cls: "stim-mph", doses: ["10mg","20mg","30mg","40mg","60mg"] },
  { brand: "Concerta",     form: "ER tab",   generic: "methylphenidate",             cls: "stim-mph", doses: ["18mg","27mg","36mg","54mg"] },
  { brand: "Methylin",     form: "IR",       generic: "methylphenidate",             cls: "stim-mph", doses: ["5mg","10mg","20mg"] },
  { brand: "Metadate CD",  form: "ER cap",   generic: "methylphenidate",             cls: "stim-mph", doses: ["10mg","20mg","30mg","40mg","50mg","60mg"] },
  { brand: "Metadate ER",  form: "ER tab",   generic: "methylphenidate",             cls: "stim-mph", doses: ["10mg","20mg"] },
  { brand: "Aptensio XR",  form: "ER cap",   generic: "methylphenidate",             cls: "stim-mph", doses: ["10mg","15mg","20mg","30mg","40mg","50mg","60mg"] },
  { brand: "Jornay PM",    form: "evening ER", generic: "methylphenidate",           cls: "stim-mph", doses: ["20mg","40mg","60mg","80mg","100mg"] },
  { brand: "Quillivant XR", form: "liquid",  generic: "methylphenidate",             cls: "stim-mph", doses: ["25mg/5mL"] },
  { brand: "QuilliChew ER", form: "chewable", generic: "methylphenidate",            cls: "stim-mph", doses: ["20mg","30mg","40mg"] },
  { brand: "Cotempla XR-ODT", form: "ODT",   generic: "methylphenidate",             cls: "stim-mph", doses: ["8.6mg","17.3mg","25.9mg"] },
  { brand: "Daytrana",     form: "patch",    generic: "methylphenidate TD",          cls: "stim-mph", doses: ["10mg","15mg","20mg","30mg"] },
  { brand: "Focalin",      form: "IR",       generic: "dexmethylphenidate",          cls: "stim-mph", doses: ["2.5mg","5mg","10mg"] },
  { brand: "Focalin XR",   form: "ER cap",   generic: "dexmethylphenidate",          cls: "stim-mph", doses: ["5mg","10mg","15mg","20mg","25mg","30mg","35mg","40mg"] },
  { brand: "Azstarys",     form: "ER cap",   generic: "serdex/dexmethylphenidate",   cls: "stim-mph", doses: ["26.1/5.2mg","39.2/7.8mg","52.3/10.4mg"] },
  { brand: "Relexxii",     form: "ER tab",   generic: "methylphenidate",             cls: "stim-mph", doses: ["18mg","27mg","36mg","54mg","63mg","72mg"] },

  // ─── Nonstimulants ───
  { brand: "Strattera",    form: "cap",      generic: "atomoxetine",                 cls: "non",      doses: ["10mg","18mg","25mg","40mg","60mg","80mg","100mg"] },
  { brand: "Qelbree",      form: "ER cap",   generic: "viloxazine",                  cls: "non",      doses: ["100mg","150mg","200mg"] },
  { brand: "Intuniv",      form: "ER tab",   generic: "guanfacine",                  cls: "non",      doses: ["1mg","2mg","3mg","4mg"] },
  { brand: "Kapvay",       form: "ER tab",   generic: "clonidine",                   cls: "non",      doses: ["0.1mg","0.2mg"] },
  { brand: "Onyda XR",     form: "liquid",   generic: "clonidine ER",                cls: "non",      doses: ["0.1mg/5mL"] },

  // ─── Generics (commonly dispensed unbranded) ───
  { brand: "Amphetamine salts", form: "IR",       generic: "generic Adderall",           cls: "stim-amp", isGeneric: true, doses: ["5mg","7.5mg","10mg","12.5mg","15mg","20mg","30mg"] },
  { brand: "Amphetamine salts", form: "ER cap",   generic: "generic Adderall XR",        cls: "stim-amp", isGeneric: true, doses: ["5mg","10mg","15mg","20mg","25mg","30mg"] },
  { brand: "Lisdexamfetamine",  form: "cap",      generic: "generic Vyvanse",            cls: "stim-amp", isGeneric: true, doses: ["10mg","20mg","30mg","40mg","50mg","60mg","70mg"] },
  { brand: "Dextroamphetamine", form: "IR",       generic: "generic Dexedrine",          cls: "stim-amp", isGeneric: true, doses: ["5mg","10mg"] },
  { brand: "Dextroamphetamine", form: "ER cap",   generic: "generic Dexedrine Spansule", cls: "stim-amp", isGeneric: true, doses: ["5mg","10mg","15mg"] },
  { brand: "Methylphenidate",   form: "IR",       generic: "generic Ritalin",            cls: "stim-mph", isGeneric: true, doses: ["5mg","10mg","20mg"] },
  { brand: "Methylphenidate",   form: "ER tab",   generic: "generic Concerta",           cls: "stim-mph", isGeneric: true, doses: ["18mg","27mg","36mg","54mg"] },
  { brand: "Methylphenidate",   form: "ER cap",   generic: "generic Ritalin LA",         cls: "stim-mph", isGeneric: true, doses: ["10mg","20mg","30mg","40mg","60mg"] },
  { brand: "Methylphenidate",   form: "patch",    generic: "generic Daytrana",           cls: "stim-mph", isGeneric: true, doses: ["10mg","15mg","20mg","30mg"] },
  { brand: "Dexmethylphenidate", form: "IR",      generic: "generic Focalin",            cls: "stim-mph", isGeneric: true, doses: ["2.5mg","5mg","10mg"] },
  { brand: "Dexmethylphenidate", form: "ER cap",  generic: "generic Focalin XR",         cls: "stim-mph", isGeneric: true, doses: ["5mg","10mg","15mg","20mg","25mg","30mg","35mg","40mg"] },
  { brand: "Atomoxetine",       form: "cap",      generic: "generic Strattera",          cls: "non",      isGeneric: true, doses: ["10mg","18mg","25mg","40mg","60mg","80mg","100mg"] },
  { brand: "Guanfacine",        form: "ER tab",   generic: "generic Intuniv",            cls: "non",      isGeneric: true, doses: ["1mg","2mg","3mg","4mg"] },
  { brand: "Clonidine",         form: "ER tab",   generic: "generic Kapvay",             cls: "non",      isGeneric: true, doses: ["0.1mg","0.2mg"] },
];

const CLS_LABELS = {
  "stim-amp": { label: "Amphetamine", color: "#F97316" },
  "stim-mph": { label: "Methylphenidate", color: "#3B82F6" },
  "non":      { label: "Non-stimulant", color: "#22C55E" },
};

// ═══════════════════════════════════════════════════════════════
// ONBOARDING — 4-step flow
// ═══════════════════════════════════════════════════════════════
const Onboarding = ({ onDone }) => {
  const [step, setStep] = React.useState(0);
  const [selectedMed, setSelectedMed] = React.useState(ADHD_MEDS[1]); // Adderall XR default
  const [dose, setDose] = React.useState("20mg");
  const [count, setCount] = React.useState(30);
  const [saved, setSaved] = React.useState(["Walgreens · Main", "Corner Pharmacy"]);
  const [query, setQuery] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const med = `${selectedMed.brand}${selectedMed.form && !selectedMed.brand.includes(selectedMed.form) ? ` (${selectedMed.form})` : ""}`;
  const [pickerFilter, setPickerFilter] = React.useState("all"); // all | brand | generic
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return ADHD_MEDS.filter(m => {
      if (pickerFilter === "brand" && m.isGeneric) return false;
      if (pickerFilter === "generic" && !m.isGeneric) return false;
      if (!q) return true;
      return m.brand.toLowerCase().includes(q) ||
        m.generic.toLowerCase().includes(q) ||
        m.form.toLowerCase().includes(q);
    });
  }, [query, pickerFilter]);
  const next = () => step < 3 ? setStep(step + 1) : onDone();
  const titles = ["Welcome", "Your medication", "Save pharmacies", "You're set"];
  return (
    <div data-screen-label="00 Onboarding" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px 20px 22px" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? TOK.primary : TOK.border, transition: "background 200ms" }}/>
        ))}
      </div>
      <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>STEP {step + 1} OF 4</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px", letterSpacing: -0.6, lineHeight: 1.15 }}>{titles[step]}</h1>

      {step === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 8px" }}>
          <div style={{ width: 92, height: 92, borderRadius: 999, background: TOK.primaryDim, border: `2px solid ${TOK.primary}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Icon.pill size={46} stroke={TOK.primary}/>
          </div>
          <div style={{ fontSize: 16, color: TOK.text, lineHeight: 1.5, marginBottom: 14 }}>Find your meds without the dread.</div>
          <div style={{ fontSize: 13, color: TOK.textMuted, lineHeight: 1.5 }}>MedScout helps you call pharmacies efficiently, log results, and find stock from the community — without sharing more than you want to.</div>
        </div>
      )}

      {step === 1 && !pickerOpen && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontSize: 14, color: TOK.textMuted, marginBottom: 22 }}>What are you tracking? You can add more later.</div>
          <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>MEDICATION</div>
          <button onClick={() => setPickerOpen(true)} style={{ width: "100%", padding: "12px 14px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10, color: TOK.text, fontSize: 15, fontFamily: "inherit", marginBottom: 16, boxSizing: "border-box", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{selectedMed.brand}<span style={{ color: TOK.textMuted, fontWeight: 500 }}> · {selectedMed.form}</span></div>
              <div style={{ fontSize: 11, color: TOK.textDim }}>{selectedMed.generic}</div>
            </div>
            <Icon.search size={16} stroke={TOK.textMuted}/>
          </button>
          <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>DOSE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {selectedMed.doses.map(d => (
              <button key={d} onClick={() => setDose(d)} style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, border: `1px solid ${dose === d ? TOK.primary : TOK.border}`, background: dose === d ? TOK.primaryDim : "transparent", color: dose === d ? TOK.primary : TOK.textMuted, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>{d}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6, marginBottom: 8 }}>SUPPLY</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10 }}>
            <button onClick={() => setCount(Math.max(1, count - 1))} style={{ width: 32, height: 32, borderRadius: 8, background: TOK.surface2, border: `1px solid ${TOK.border}`, color: TOK.text, cursor: "pointer", fontSize: 18 }}>−</button>
            <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600 }}>{count} <span style={{ fontSize: 13, color: TOK.textMuted, fontWeight: 400 }}>days/refill</span></div>
            <button onClick={() => setCount(count + 1)} style={{ width: 32, height: 32, borderRadius: 8, background: TOK.surface2, border: `1px solid ${TOK.border}`, color: TOK.text, cursor: "pointer", fontSize: 18 }}>+</button>
          </div>
        </div>
      )}

      {step === 1 && pickerOpen && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setPickerOpen(false)} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 6, display: "flex", fontFamily: "inherit", fontSize: 13 }}>← Back</button>
            <div style={{ fontSize: 11, color: TOK.textDim, fontWeight: 600, letterSpacing: 0.6 }}>SELECT MEDICATION</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10, marginBottom: 10 }}>
            <Icon.search size={16} stroke={TOK.textMuted}/>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search brand, generic, or form…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: TOK.text, fontFamily: "inherit" }}/>
            {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 2, display: "flex" }}><Icon.x size={14}/></button>}
          </div>
          <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
            {[{id:"all",l:"All"},{id:"brand",l:"Brand"},{id:"generic",l:"Generic"}].map(f => (
              <button key={f.id} onClick={() => setPickerFilter(f.id)} style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600, border: `1px solid ${pickerFilter === f.id ? TOK.primary : TOK.border}`, background: pickerFilter === f.id ? TOK.primaryDim : "transparent", color: pickerFilter === f.id ? TOK.primary : TOK.textMuted, borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>{f.l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", marginRight: -4, paddingRight: 4 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: 32, fontSize: 13, color: TOK.textMuted }}>No matches.<br/><span style={{ fontSize: 11, color: TOK.textDim }}>Try "Concerta" or "atomoxetine"</span></div>
            )}
            {filtered.map((m, i) => {
              const isSel = m.brand === selectedMed.brand && m.form === selectedMed.form;
              const cl = CLS_LABELS[m.cls];
              return (
                <button key={`${m.brand}-${m.form}-${i}`} onClick={() => { setSelectedMed(m); setDose(m.doses[Math.floor(m.doses.length/2)]); setPickerOpen(false); setQuery(""); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", background: isSel ? TOK.primaryDim : TOK.surface, border: `1px solid ${isSel ? TOK.primary : TOK.borderSoft}`, borderRadius: 10, marginBottom: 5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <div style={{ width: 4, height: 36, background: cl.color, borderRadius: 2, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TOK.text, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.brand} <span style={{ color: TOK.textMuted, fontWeight: 500, fontSize: 12 }}>· {m.form}</span></span>
                      {m.isGeneric && <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: TOK.textMuted, padding: "2px 5px", borderRadius: 3, border: `1px solid ${TOK.border}`, flexShrink: 0 }}>GENERIC</span>}
                    </div>
                    <div style={{ fontSize: 11, color: TOK.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.generic} · {m.doses.length} dose{m.doses.length > 1 ? "s" : ""}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: cl.color, padding: "3px 6px", borderRadius: 4, background: `${cl.color}1f`, flexShrink: 0 }}>{cl.label.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: TOK.textDim, marginTop: 8, textAlign: "center" }}>{filtered.length} of {ADHD_MEDS.length}</div>
        </div>
      )}

      {step === 2 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontSize: 14, color: TOK.textMuted, marginBottom: 16 }}>We'll start with pharmacies near 92706. Tap to save.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", background: TOK.surface, border: `1px solid ${TOK.border}`, borderRadius: 10, marginBottom: 12 }}>
            <Icon.search size={16} stroke={TOK.textMuted}/>
            <span style={{ flex: 1, fontSize: 13, color: TOK.textMuted }}>Search by name or ZIP</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", marginRight: -4, paddingRight: 4 }}>
            {["Walgreens · Main", "Corner Pharmacy", "Target Rx", "CVS · Elm", "Family Care Rx", "Sav-On · 4th", "Costco Rx"].map(name => {
              const isSaved = saved.includes(name);
              return (
                <div key={name} onClick={() => setSaved(s => isSaved ? s.filter(x => x !== name) : [...s, name])} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: TOK.surface, border: `1px solid ${isSaved ? TOK.primary : TOK.borderSoft}`, borderRadius: 10, marginBottom: 6, cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
                    <div style={{ fontSize: 11, color: TOK.textMuted, marginTop: 2 }}>{(0.4 + Math.random() * 2).toFixed(1)}mi</div>
                  </div>
                  {isSaved ? <Icon.check size={18} stroke={TOK.primary}/> : <Icon.plus size={18} stroke={TOK.textMuted}/>}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: TOK.textDim, marginTop: 8, textAlign: "center" }}>{saved.length} saved</div>
        </div>
      )}

      {step === 3 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 8px" }}>
          <div style={{ width: 92, height: 92, borderRadius: 999, background: TOK.successDim, border: `2px solid ${TOK.success}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Icon.check size={46} stroke={TOK.success}/>
          </div>
          <div style={{ fontSize: 18, color: TOK.text, lineHeight: 1.4, marginBottom: 8, fontWeight: 600 }}>{med} · {dose} · {count}-day supply</div>
          <div style={{ fontSize: 14, color: TOK.textMuted, lineHeight: 1.5, marginBottom: 24 }}>{saved.length} pharmacies saved. We'll remind you 7 days before run-out.</div>
          <Card style={{ background: TOK.vaultDim, borderColor: "rgba(139,92,246,0.4)", padding: 14, width: "100%", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TOK.vault, fontWeight: 700, letterSpacing: 0.6, marginBottom: 4 }}>
              <Icon.lock size={13} stroke={TOK.vault}/> VAULT IS PRIVATE
            </div>
            <div style={{ fontSize: 12, color: TOK.text, lineHeight: 1.4 }}>Your medication and call logs never leave your device unless you contribute to community.</div>
          </Card>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <Btn variant="primary" size="lg" onClick={next}>{step === 3 ? "Open MedScout" : "Continue"}</Btn>
        {step > 0 && step < 3 && <Btn variant="ghost" style={{ marginTop: 8 }} onClick={() => setStep(step - 1)}>Back</Btn>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// VAULT UNLOCK — Face ID gate
// ═══════════════════════════════════════════════════════════════
const VaultUnlock = ({ onUnlock, onCancel }) => {
  const [state, setState] = React.useState("idle"); // idle | scanning | success
  const trigger = () => {
    setState("scanning");
    setTimeout(() => { setState("success"); setTimeout(onUnlock, 600); }, 1300);
  };
  return (
    <div data-screen-label="08 Vault Unlock" style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(13,17,23,0.96)", backdropFilter: "blur(20px)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px" }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 6, display: "flex", fontFamily: "inherit", fontSize: 14 }}>Cancel</button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <div style={{
          width: 130, height: 130, borderRadius: 28,
          background: state === "success" ? TOK.successDim : TOK.vaultDim,
          border: `2px solid ${state === "success" ? TOK.success : TOK.vault}`,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28,
          position: "relative", transition: "all 300ms",
        }}>
          {state === "success"
            ? <Icon.check size={64} stroke={TOK.success}/>
            : <Icon.faceid size={72} stroke={TOK.vault} sw={1.4}/>}
          {state === "scanning" && (
            <div style={{ position: "absolute", inset: -6, borderRadius: 32, border: `2px solid ${TOK.vault}`, animation: "pulse 1.4s ease-in-out infinite" }}/>
          )}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: -0.4 }}>
          {state === "success" ? "Unlocked" : state === "scanning" ? "Scanning…" : "Unlock Vault"}
        </div>
        <div style={{ fontSize: 14, color: TOK.textMuted, lineHeight: 1.5, maxWidth: 280, marginBottom: 32 }}>
          {state === "idle" && "Confirm your identity to view community pharmacies and contribute reports."}
          {state === "scanning" && "Hold your phone steady…"}
          {state === "success" && "Welcome back."}
        </div>
        {state === "idle" && (
          <Btn variant="outline" onClick={trigger} style={{ borderColor: TOK.vault, color: TOK.vault }}>
            <Icon.faceid size={18} stroke={TOK.vault}/> Use Face ID
          </Btn>
        )}
      </div>
      <div style={{ padding: "0 32px 32px", textAlign: "center", fontSize: 11, color: TOK.textDim }}>
        Your vault is encrypted on this device.
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION DEEP LINK — lock screen banner that opens pre-flight
// ═══════════════════════════════════════════════════════════════
const NotifDeepLink = ({ onTapNotif }) => {
  const [t, setT] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setT(x => x + 1), 1000); return () => clearInterval(id); }, []);
  return (
    <div data-screen-label="09 Notification" style={{ height: "100%", position: "relative", background: "linear-gradient(160deg, #1a1410 0%, #0d0a08 60%, #000 100%)", overflow: "hidden" }}>
      {/* Time/date */}
      <div style={{ paddingTop: 50, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 16, fontWeight: 500, opacity: 0.8 }}>Tuesday, May 6</div>
        <div style={{ fontSize: 80, fontWeight: 200, marginTop: 4, letterSpacing: -2, lineHeight: 1 }}>9:41</div>
      </div>

      {/* Notification banner */}
      <div onClick={onTapNotif} style={{
        position: "absolute", top: 230, left: 12, right: 12,
        background: "rgba(28,35,44,0.85)", backdropFilter: "blur(40px)",
        border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 18,
        padding: 14, cursor: "pointer",
        animation: "slideDown 400ms ease",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: TOK.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon.pill size={20} stroke="#0D1117"/>
          </div>
          <div style={{ flex: 1, color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>MedScout</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>now</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Walgreens Main is restocking — call now</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2, lineHeight: 1.35 }}>Community reported 20mg XR back in stock 8 minutes ago. Tap to start your script.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={(e) => { e.stopPropagation(); onTapNotif(); }} style={{ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.08)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon.phone size={14} stroke="#fff"/> Call now
          </button>
          <button onClick={(e) => e.stopPropagation()} style={{ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 500, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
            Snooze 30m
          </button>
        </div>
      </div>

      {/* Lock screen footer */}
      <div style={{ position: "absolute", bottom: 50, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <Icon.lock size={16}/>
        <div>Swipe up to open</div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// POST-CALL TOAST OVERLAY — sliding bottom toast on confirm
// ═══════════════════════════════════════════════════════════════
const PostCallToast = ({ onDismiss }) => (
  <div style={{ position: "absolute", left: 12, right: 12, bottom: 80, zIndex: 100, animation: "slideUp 350ms ease" }}>
    <div style={{ background: TOK.surface, border: `1px solid ${TOK.success}`, borderRadius: 14, padding: 14, boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 4px rgba(34,197,94,0.15)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: TOK.successDim, border: `1px solid ${TOK.success}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon.check size={18} stroke={TOK.success}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: TOK.text }}>Logged · Walgreens Main</div>
          <div style={{ fontSize: 12, color: TOK.textMuted }}>Streak +1 · 7 days · contribution +5pts</div>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: TOK.textMuted, cursor: "pointer", padding: 4, display: "flex" }}><Icon.x size={16}/></button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="ghost" size="sm" full={false} style={{ flex: 1, fontSize: 11 }}><Icon.share size={13}/> Share to community</Btn>
        <Btn variant="ghost" size="sm" full={false} style={{ flex: 1, fontSize: 11 }}><Icon.rotate size={13}/> Refresh insights</Btn>
      </div>
    </div>
  </div>
);

Object.assign(window, { Onboarding, VaultUnlock, NotifDeepLink, PostCallToast });
