import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)" };

const CATEGORIES = [
  { label:"Photos & vidéos", size:"420 Mo", color:"#22C55E", pct:34 },
  { label:"Messages", size:"420 Mo", color:"#3B82F6", pct:34 },
  { label:"Documents", size:"420 Mo", color:"#F59E0B", pct:24 },
  { label:"Cache", size:"120 Mo", color:"#8B5CF6", pct:5 },
  { label:"Autre", size:"80 Mo", color:"#E5E7EB", pct:3 },
];

export default function StoragePage() {
  const navigate = useNavigate();
  const usedGB = 1.24, totalGB = 10;
  const usedPct = Math.round((usedGB/totalGB)*100);
  const r = 60, stroke = 20, circ = 2*Math.PI*r;

  // Build segments for donut
  let offset = circ * 0.25;
  const segments = CATEGORIES.map(cat => {
    const len = circ * (cat.pct / 100);
    const seg = { color:cat.color, dashArray:`${len} ${circ - len}`, offset };
    offset += len;
    return seg;
  });

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Stockage</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      <div style={{ padding:"20px 12px 40px" }}>
        {/* Donut + stats card */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, padding:"24px", marginBottom:12, display:"flex", gap:20, alignItems:"center" }}>
          {/* Donut */}
          <div style={{ position:"relative", width:148, height:148, flexShrink:0 }}>
            <svg width="148" height="148" viewBox="0 0 148 148">
              <circle cx="74" cy="74" r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke}/>
              {segments.map((s, i) => (
                <circle key={i} cx="74" cy="74" r={r} fill="none" stroke={s.color} strokeWidth={stroke}
                  strokeDasharray={s.dashArray} strokeDashoffset={-s.offset} style={{ transition:"all 0.6s ease" }}/>
              ))}
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontWeight:800, fontSize:20, color:C.text, lineHeight:1.1 }}>{usedGB} Go</div>
              <div style={{ fontSize:11, color:C.secondary, fontWeight:500 }}>utilisés</div>
            </div>
          </div>

          {/* Category legend */}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, color:C.secondary, marginBottom:10 }}>/ {totalGB} Go total</div>
            {CATEGORIES.map((cat, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                <span style={{ flex:1, fontSize:12, color:C.secondary }}>{cat.label}</span>
                <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{cat.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categories detail */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden", marginBottom:16 }}>
          {CATEGORIES.slice(0,4).map((cat, i) => (
            <div key={i} style={{ padding:"13px 16px", borderBottom:i<3?`1px solid ${C.border}`:"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:`${cat.color}20`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <div style={{ width:14, height:14, borderRadius:3, background:cat.color }}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:14, color:C.text }}>{cat.label}</div>
                </div>
                <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{cat.size}</span>
              </div>
              <div style={{ height:5, background:"#E5E7EB", borderRadius:999, overflow:"hidden", marginLeft:48 }}>
                <div style={{ height:"100%", width:`${cat.pct}%`, background:cat.color, borderRadius:999, transition:"width 0.8s ease" }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar global */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:13, color:C.secondary }}>Espace utilisé</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.primary }}>{usedPct}%</span>
          </div>
          <div style={{ height:8, background:"#E5E7EB", borderRadius:999, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${usedPct}%`, background:`linear-gradient(90deg,#22C55E,#16A34A)`, borderRadius:999 }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            <span style={{ fontSize:11, color:C.secondary }}>{usedGB} Go utilisé</span>
            <span style={{ fontSize:11, color:C.secondary }}>{totalGB - usedGB} Go libre</span>
          </div>
        </div>

        {/* CTA */}
        <button style={{ width:"100%", padding:"15px", borderRadius:16, background:C.primary, border:"none", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:`0 4px 16px rgba(34,197,94,0.3)` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          Gérer le stockage
        </button>
      </div>
    </div>
  );
}
