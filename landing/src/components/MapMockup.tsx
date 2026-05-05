const pharmacies = [
  { x: 95,  y: 72,  name: 'CVS Pharmacy',    indicator: 'Stimulant · In Stock',  status: 'high'   },
  { x: 232, y: 48,  name: 'Walgreens',        indicator: 'Stimulant · In Stock',  status: 'high'   },
  { x: 358, y: 112, name: 'CVS Pharmacy',     indicator: '30mg · Limited',        status: 'medium' },
  { x: 155, y: 158, name: 'Rite Aid',         indicator: 'Stimulant · Limited',   status: 'medium' },
  { x: 310, y: 190, name: 'Walgreens',        indicator: 'Shortage Indicator',    status: 'low'    },
  { x: 68,  y: 215, name: 'Target Pharmacy',  indicator: 'Shortage Indicator',    status: 'low'    },
  { x: 395, y: 58,  name: 'Costco Pharmacy',  indicator: '20mg · In Stock',       status: 'high'   },
  { x: 265, y: 235, name: 'CVS Pharmacy',     indicator: '30mg · Limited',        status: 'medium' },
]

const statusConfig = {
  high:   { color: '#22C55E', label: 'In Stock',    ring: 'rgba(34,197,94,0.2)'  },
  medium: { color: '#F59E0B', label: 'Limited',      ring: 'rgba(245,158,11,0.2)' },
  low:    { color: '#EF4444', label: 'Low / None',   ring: 'rgba(239,68,68,0.2)'  },
}

const streetH = [35, 100, 165, 205, 255]
const streetV = [50, 130, 200, 290, 360, 430]

export function MapMockup() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#30363D] bg-[#0D1117]" style={{ width: '100%', maxWidth: 480 }}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#30363D] bg-[#161B22] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full bg-[#22C55E]"
            style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
          />
          <span className="text-xs font-semibold text-[#F0F6FC] tracking-wide">LIVE</span>
          <span className="text-xs text-[#8B949E]">· 02101 · Boston, MA</span>
        </div>
        <span className="text-xs text-[#8B949E]">Updated 4m ago</span>
      </div>

      {/* Map area */}
      <div className="relative bg-[#0D1117]">
        <svg viewBox="0 0 480 280" width="100%" aria-hidden style={{ display: 'block' }}>
          {/* Street grid */}
          {streetH.map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={480} y2={y} stroke="#30363D" strokeWidth={1} />
          ))}
          {streetV.map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={280} stroke="#30363D" strokeWidth={1} />
          ))}

          {/* Street labels */}
          <text x={52}  y={97} fontSize={8} fill="#30363D" fontFamily="monospace">MAIN ST</text>
          <text x={132} y={97} fontSize={8} fill="#30363D" fontFamily="monospace">ELM AVE</text>
          <text x={202} y={97} fontSize={8} fill="#30363D" fontFamily="monospace">PARK RD</text>

          {/* Pharmacy dots */}
          {pharmacies.map((p, i) => {
            const cfg = statusConfig[p.status as keyof typeof statusConfig]
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={14} fill={cfg.ring} />
                <circle cx={p.x} cy={p.y} r={6} fill={cfg.color} />
                <text x={p.x} y={p.y + 22} fontSize={7.5} fill="#8B949E" textAnchor="middle" fontFamily="sans-serif">
                  {p.name.split(' ')[0]}
                </text>
                <text x={p.x} y={p.y + 31} fontSize={7} fill="#8B949E" textAnchor="middle" fontFamily="monospace">
                  {p.indicator}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Filter pills */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5" style={{ maxWidth: 'calc(100% - 1.5rem)' }}>
          <span className="rounded-full border border-[#30363D] bg-[#161B22] px-2.5 py-1 text-[10px] font-medium text-[#F0F6FC]">
            Stimulants
          </span>
          <span className="rounded-full border border-[#30363D] bg-[#161B22] px-2.5 py-1 text-[10px] text-[#8B949E]">
            Short-acting
          </span>
          <span className="rounded-full border border-[#30363D] bg-[#161B22] px-2.5 py-1 text-[10px] text-[#8B949E]">
            Extended
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between border-t border-[#30363D] bg-[#161B22] px-4 py-2">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: cfg.color }} />
            <span className="text-[10px] text-[#8B949E]">{cfg.label}</span>
          </div>
        ))}
        <span className="text-[10px] text-[#8B949E]">8 pharmacies nearby</span>
      </div>
    </div>
  )
}
