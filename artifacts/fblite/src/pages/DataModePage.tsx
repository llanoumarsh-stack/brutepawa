import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)" };

function Toggle({ on, onChange }:{on:boolean;onChange:(v:boolean)=>void}) {
  return (
    <div onClick={()=>onChange(!on)} style={{ width:46, height:26, borderRadius:13, background:on?C.primary:"#E5E7EB", position:"relative", cursor:"pointer", transition:"background .2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:on?"calc(100% - 23px)":3, width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.25)", transition:"left .2s" }}/>
    </div>
  );
}

function DataRow({ icon, label, sub, right, last=false }:{icon:React.ReactNode;label:string;sub?:string;right?:React.ReactNode;last?:boolean}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", borderBottom:last?"none":`1px solid ${C.border}` }}>
      <div style={{ color:C.primary, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:500, fontSize:15, color:C.text }}>{label}</div>
        {sub && <div style={{ fontSize:12, color:C.secondary, marginTop:1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export default function DataModePage() {
  const navigate = useNavigate();
  const [saver, setSaver] = useState(true);
  const [mediaWifi, setMediaWifi] = useState(true);
  const pct = saver ? 78 : 42;

  const WifiIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>;
  const VideoIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;

  /* Donut chart */
  const r = 52, stroke = 18, circ = 2*Math.PI*r;
  const dashArray = `${circ*(pct/100)} ${circ*(1-pct/100)}`;

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Mode données</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      <div style={{ padding:"20px 12px 40px" }}>
        {/* Donut chart card */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, padding:"24px 20px", display:"flex", flexDirection:"column", alignItems:"center", marginBottom:12 }}>
          <div style={{ position:"relative", width:140, height:140, marginBottom:16 }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke}/>
              <circle cx="70" cy="70" r={r} fill="none" stroke={C.primary} strokeWidth={stroke}
                strokeDasharray={dashArray} strokeDashoffset={circ*0.25}
                strokeLinecap="round" style={{ transition:"stroke-dasharray 0.8s ease" }}/>
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.secondary, textTransform:"uppercase", letterSpacing:"0.06em" }}>Économiseur</div>
              <div style={{ fontWeight:800, fontSize:26, color:C.primary, lineHeight:1.1 }}>{pct}%</div>
              <div style={{ fontSize:12, color:saver?C.primaryDark:C.secondary, fontWeight:600 }}>{saver?"Activé":"Désactivé"}</div>
            </div>
          </div>
          <div style={{ fontSize:13, color:C.secondary, textAlign:"center" }}>
            {saver ? "Vous économisez des données" : "Mode normal activé"}
          </div>
        </div>

        {/* Settings card */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden", marginBottom:12 }}>
          <DataRow
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="10" width="4" height="10" rx="1"/><rect x="7" y="6" width="4" height="14" rx="1"/><rect x="12" y="2" width="4" height="18" rx="1"/><rect x="17" y="7" width="4" height="13" rx="1"/></svg>}
            label="Économiseur de données" sub={saver?"Actif — réduit la consommation":"Inactif"}
            right={<Toggle on={saver} onChange={setSaver}/>}
          />
          <DataRow icon={WifiIcon} label="Chargement des médias" sub="Wi-Fi uniquement"
            right={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#C4C9D4" strokeWidth="2.2" strokeLinecap="round"/></svg>}/>
          <DataRow icon={VideoIcon} label="Qualité vidéo" sub="Économique" last
            right={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#C4C9D4" strokeWidth="2.2" strokeLinecap="round"/></svg>}/>
        </div>

        {/* Tip card */}
        <div style={{ background:"#F0FDF4", borderRadius:20, padding:"14px 16px", display:"flex", gap:12, alignItems:"flex-start" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={C.primary} style={{ flexShrink:0, marginTop:1 }}><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-4h2v4zm0-6h-2V7h2v4z"/></svg>
          <div style={{ fontSize:13, color:C.primaryDark, lineHeight:1.5 }}>En mode économiseur, les images et vidéos sont chargées en qualité réduite pour économiser votre forfait.</div>
        </div>
      </div>
    </div>
  );
}
