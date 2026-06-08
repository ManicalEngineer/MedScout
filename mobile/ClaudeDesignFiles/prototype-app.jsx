// MedScout hi-fi — App orchestrator (state machine, navigation)

const App = () => {
  // screens: onboard | dashboard | dialer | preflight | active | postcall | map | profile | notif | vault
  const [screen, setScreen] = React.useState("dashboard");
  const [tab, setTab] = React.useState("home");
  const [segment, setSegment] = React.useState("dial");
  const [pharmacy, setPharmacy] = React.useState(PHARMACIES[0]);
  const [showToast, setShowToast] = React.useState(false);
  const [pendingVaultCb, setPendingVaultCb] = React.useState(null);

  const onTabChange = (id) => {
    setTab(id);
    if (id === "home") setScreen("dashboard");
    else if (id === "hunt") setScreen("dialer");
    else if (id === "map") setScreen("map");
    else if (id === "me") setScreen("profile");
  };

  const onCallPharmacy = (p) => { setPharmacy(p); setScreen("preflight"); };

  const handleConfirmPostCall = () => {
    setScreen("dialer");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const handleUnlockVault = (cb) => {
    setPendingVaultCb(() => cb);
    setScreen("vault");
  };

  let inner;
  if (screen === "onboard") {
    inner = <Onboarding onDone={() => setScreen("dashboard")} />;
  } else if (screen === "dashboard") {
    inner = <ScreenWithTab tab="home" onTabChange={onTabChange}><Dashboard onStartHunt={() => { setTab("hunt"); setScreen("dialer"); }}/></ScreenWithTab>;
  } else if (screen === "dialer") {
    inner = (
      <ScreenWithTab tab="hunt" onTabChange={onTabChange}>
        <Dialer onCallPharmacy={onCallPharmacy} segment={segment} onSegmentChange={setSegment}/>
        {showToast && <PostCallToast onDismiss={() => setShowToast(false)}/>}
      </ScreenWithTab>
    );
  } else if (screen === "preflight") {
    inner = <PreFlight pharmacy={pharmacy} onBack={() => setScreen("dialer")} onSkipScript={() => setScreen("active")} onStartCall={() => setScreen("active")} />;
  } else if (screen === "active") {
    inner = <ActiveCall pharmacy={pharmacy} onEnd={() => setScreen("postcall")} />;
  } else if (screen === "postcall") {
    inner = <ScreenWithTab tab="hunt" onTabChange={onTabChange}><PostCall pharmacy={pharmacy} onConfirm={handleConfirmPostCall} onDiscard={() => setScreen("dialer")} onCallPharmacy={onCallPharmacy} onSegmentChange={setSegment}/></ScreenWithTab>;
  } else if (screen === "map") {
    inner = <ScreenWithTab tab="map" onTabChange={onTabChange}><MapScreen onUnlockVault={handleUnlockVault}/></ScreenWithTab>;
  } else if (screen === "profile") {
    inner = <ScreenWithTab tab="me" onTabChange={onTabChange}><Profile/></ScreenWithTab>;
  } else if (screen === "notif") {
    inner = <NotifDeepLink onTapNotif={() => { setPharmacy(PHARMACIES[1]); setScreen("preflight"); }}/>;
  } else if (screen === "vault") {
    inner = <VaultUnlock onUnlock={() => { if (pendingVaultCb) pendingVaultCb(); setPendingVaultCb(null); setScreen("map"); }} onCancel={() => { setPendingVaultCb(null); setScreen("map"); }}/>;
  }

  return (
    <div style={{
      width: "100vw", minHeight: "100vh", background: "#1a1a1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", boxSizing: "border-box",
      fontFamily: "'Lexend', system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Phone time={screen === "notif" ? "9:18" : "9:41"}>{inner}</Phone>
        <FlowNav screen={screen} setScreen={setScreen} />
      </div>
    </div>
  );
};

const ScreenWithTab = ({ tab, onTabChange, children }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const handle = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const span = btn.querySelector("span");
      if (!span) return;
      const label = span.textContent.toLowerCase();
      if (["home","hunt","map","me"].includes(label)) {
        e.stopPropagation();
        onTabChange(label);
      }
    };
    root.addEventListener("click", handle, true);
    return () => root.removeEventListener("click", handle, true);
  }, [onTabChange]);
  return <div ref={ref} style={{ height: "100%" }}>{children}</div>;
};

const FlowNav = ({ screen, setScreen }) => {
  const groups = [
    { l: "Entry", steps: [
      { id: "notif", l: "Notif" },
      { id: "onboard", l: "Onboard" },
    ]},
    { l: "Core flow", steps: [
      { id: "dashboard", l: "1·Dashboard" },
      { id: "dialer", l: "2·Hunt" },
      { id: "preflight", l: "3·Pre-Flight" },
      { id: "active", l: "4·Call" },
      { id: "postcall", l: "5·Post-Call" },
    ]},
    { l: "Other", steps: [
      { id: "map", l: "Map" },
      { id: "vault", l: "Vault" },
      { id: "profile", l: "Me" },
    ]},
  ];
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      maxWidth: 460, padding: "10px 12px",
      background: "rgba(22,27,34,0.6)", border: "1px solid #30363D",
      borderRadius: 14, backdropFilter: "blur(8px)",
    }}>
      {groups.map(g => (
        <div key={g.l} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#6E7681", fontWeight: 600, letterSpacing: 0.6, width: 60 }}>{g.l.toUpperCase()}</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {g.steps.map(s => (
              <button key={s.id} onClick={() => setScreen(s.id)} style={{
                padding: "5px 8px", fontSize: 10, fontWeight: 600,
                background: screen === s.id ? "#F97316" : "transparent",
                color: screen === s.id ? "#0D1117" : "#8B949E",
                border: `1px solid ${screen === s.id ? "#F97316" : "#30363D"}`,
                borderRadius: 6, cursor: "pointer", fontFamily: "'Lexend', system-ui, sans-serif",
              }}>{s.l}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
