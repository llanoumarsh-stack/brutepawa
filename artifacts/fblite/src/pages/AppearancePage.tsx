import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)" };
type Theme = "clair"|"sombre"|"systeme";
type TextSize = "petite"|"moyenne"|"grande";
const COLORS = ["#22C55E","#3B82F6","#EF4444","#8B5CF6","#F59E0B","#EC4899"];

function ThemeCard({ id, label, icon, active, onClick }:{id:string;label:string;icon:React.ReactNode;active:boolean;onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:"16px 8px 12px", background:active?"#F0FDF4":"#fff", border:`2px solid ${active?C.primary:C.border}`, borderRadius:16, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:8, transition:"all .15s", position:"relative" }}>
      {active && <div style={{ position:"absolute", top:8, right:8, width:18, height:18, borderRadius:"50%", background:C.primary, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>}
      <div style={{ width:52, height:36, borderRadius:10, border:`1.5px solid ${C.border}`, overflow:"hidden", position:"relative" }}>{icon}</div>
      <span style={{ fontSize:12, fontWeight:active?700:500, color:active?C.primary:C.text }}>{label}</span>
    </button>
  );
}

function TextSizeRow({ size, active, onClick }:{size:TextSize;active:boolean;onClick:()=>void}) {
  const labels:Record<TextSize,string> = { petite:"Petite", moyenne:"Moyenne", grande:"Grande" };
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", padding:"13px 16px", width:"100%", background:"none", border:"none", cursor:"pointer", borderBottom:size==="grande"?"none":`1px solid ${C.border}` }}>
      <span style={{ flex:1, fontSize:15, fontWeight:500, color:C.text }}>{labels[size]}</span>
      {active && <svg width="20" height="20" viewBox="0 0 24 24" fill={C.primary}><path d="M20 6L9 17l-5-5" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>}
    </button>
  );
}

export default function AppearancePage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>("clair");
  const [color, setColor] = useState(COLORS[0]);
  const [textSize, setTextSize] = useState<TextSize>("moyenne");

  const LightTheme = <div style={{ background:"#F8FAFC", width:"100%", height:"100%", display:"flex", flexDirection:"column", gap:2, padding:4 }}><div style={{ height:6, background:"#fff", borderRadius:2 }}/><div style={{ height:4, background:"#E5E7EB", borderRadius:2, width:"70%" }}/><div style={{ height:4, background:"#E5E7EB", borderRadius:2, width:"50%" }}/></div>;
  const DarkTheme = <div style={{ background:"#0F172A", width:"100%", height:"100%", display:"flex", flexDirection:"column", gap:2, padding:4 }}><div style={{ height:6, background:"#1E293B", borderRadius:2 }}/><div style={{ height:4, background:"#334155", borderRadius:2, width:"70%" }}/><div style={{ height:4, background:"#475569", borderRadius:2, width:"50%" }}/></div>;
  const SystemTheme = <div style={{ background:"linear-gradient(90deg,#F8FAFC 50%,#0F172A 50%)", width:"100%", height:"100%", display:"flex", flexDirection:"column", gap:2, padding:4 }}><div style={{ height:6, background:"rgba(255,255,255,0.5)", borderRadius:2 }}/><div style={{ height:4, background:"rgba(255,255,255,0.3)", borderRadius:2, width:"70%" }}/></div>;

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Apparence</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      <div style={{ padding:"16px 12px 40px" }}>
        {/* Theme selector */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.secondary, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10, paddingLeft:4 }}>Thème</div>
          <div style={{ display:"flex", gap:10 }}>
            <ThemeCard id="clair" label="Clair" icon={LightTheme} active={theme==="clair"} onClick={()=>setTheme("clair")}/>
            <ThemeCard id="sombre" label="Sombre" icon={DarkTheme} active={theme==="sombre"} onClick={()=>setTheme("sombre")}/>
            <ThemeCard id="systeme" label="Système" icon={SystemTheme} active={theme==="systeme"} onClick={()=>setTheme("systeme")}/>
          </div>
        </div>

        {/* Color picker */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, padding:"16px", marginBottom:12 }}>
          <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:14 }}>Couleur principale</div>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
            {COLORS.map(hex => (
              <button key={hex} onClick={()=>setColor(hex)} style={{ width:38, height:38, borderRadius:"50%", background:hex, border:`3px solid ${color===hex?"#fff":"transparent"}`, outline:color===hex?`3px solid ${hex}`:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .15s, outline .15s", transform:color===hex?"scale(1.12)":"scale(1)" }}>
                {color===hex && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
              </button>
            ))}
          </div>
        </div>

        {/* Text size */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.secondary, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, paddingLeft:4 }}>Taille du texte</div>
          <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
            <TextSizeRow size="petite" active={textSize==="petite"} onClick={()=>setTextSize("petite")}/>
            <TextSizeRow size="moyenne" active={textSize==="moyenne"} onClick={()=>setTextSize("moyenne")}/>
            <TextSizeRow size="grande" active={textSize==="grande"} onClick={()=>setTextSize("grande")}/>
          </div>
        </div>

        {/* Preview */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, padding:"16px" }}>
          <div style={{ fontWeight:600, fontSize:15, color:C.text, marginBottom:10 }}>Aperçu</div>
          <div style={{ background:"#F8FAFC", borderRadius:14, padding:"12px 14px" }}>
            <div style={{ fontWeight:700, fontSize:textSize==="grande"?17:textSize==="petite"?13:15, color:color }}>BrutePawa</div>
            <div style={{ fontSize:textSize==="grande"?14:textSize==="petite"?11:13, color:C.secondary, marginTop:4 }}>Réseau social panafricain — aperçu de la taille du texte.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
