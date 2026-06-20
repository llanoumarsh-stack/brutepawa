import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A", text:"#111827", secondary:"#64748B", muted:"#9CA3AF", shadow:"0 8px 30px rgba(0,0,0,0.05)" };
type Theme = "clair"|"sombre"|"systeme";
type Size  = "petite"|"moyenne"|"grande";

function SubHeader({ title, onBack }:{title:string;onBack:()=>void}) {
  return (
    <div style={{ background:"#fff", borderBottom:"1px solid #F1F5F9", height:56, display:"flex", alignItems:"center", padding:"0 6px", position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
      <button onClick={onBack} style={{ width:44,height:44,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <h1 style={{ flex:1,fontWeight:700,fontSize:17,color:C.text,margin:0,letterSpacing:"-0.3px",textAlign:"center" }}>{title}</h1>
      <button style={{ width:44,height:44,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.muted}/><circle cx="12" cy="12" r="1.5" fill={C.muted}/><circle cx="12" cy="19" r="1.5" fill={C.muted}/></svg>
      </button>
    </div>
  );
}

const THEMES: { key:Theme; label:string; bg:string; accent:string; textC:string }[] = [
  { key:"clair",   label:"Clair",   bg:"#F8FAFC", accent:"#22C55E", textC:"#111827" },
  { key:"sombre",  label:"Sombre",  bg:"#111827", accent:"#22C55E", textC:"#F8FAFC" },
  { key:"systeme", label:"Système", bg:"linear-gradient(135deg,#F8FAFC 50%,#111827 50%)", accent:"#22C55E", textC:"#64748B" },
];

const COLORS = [
  { v:"#22C55E", label:"Vert" },
  { v:"#3B82F6", label:"Bleu" },
  { v:"#EF4444", label:"Rouge" },
  { v:"#8B5CF6", label:"Violet" },
  { v:"#F59E0B", label:"Ambre" },
  { v:"#EC4899", label:"Rose" },
];

const SIZES: { key:Size; label:string; size:number }[] = [
  { key:"petite",  label:"Petite",  size:13 },
  { key:"moyenne", label:"Moyenne", size:15 },
  { key:"grande",  label:"Grande",  size:17 },
];

export default function AppearancePage() {
  const navigate = useNavigate();
  const [theme, setTheme]   = useState<Theme>("clair");
  const [color, setColor]   = useState("#22C55E");
  const [size, setSize]     = useState<Size>("moyenne");

  const selTheme = THEMES.find(t=>t.key===theme)!;

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <SubHeader title="Apparence" onBack={()=>navigate("/settings")}/>

      <div style={{ padding:"20px 14px 40px" }}>
        {/* Live preview card */}
        <div style={{ background:selTheme.bg,borderRadius:24,boxShadow:C.shadow,padding:"20px 18px",marginBottom:16,border:"2px solid "+color,transition:"all 400ms ease" }}>
          <div style={{ fontWeight:700,fontSize:13,color:selTheme.textC,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.6px",opacity:.5 }}>Aperçu</div>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:44,height:44,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px "+color+"55",flexShrink:0 }}>
              <span style={{ color:"#fff",fontWeight:800,fontSize:18 }}>B</span>
            </div>
            <div>
              <div style={{ fontWeight:700,fontSize:SIZES.find(s=>s.key===size)!.size,color:selTheme.textC,transition:"font-size 300ms" }}>BrutePawa</div>
              <div style={{ fontSize:12,color:selTheme.textC,opacity:.5 }}>Réseau social panafricain</div>
            </div>
          </div>
          <div style={{ marginTop:14,height:8,background:color,borderRadius:999,opacity:.2 }}/>
          <div style={{ marginTop:6,height:8,background:selTheme.textC,borderRadius:999,opacity:.08,width:"70%" }}/>
          <div style={{ marginTop:6,height:8,background:selTheme.textC,borderRadius:999,opacity:.05,width:"50%" }}/>
        </div>

        {/* Themes */}
        <div style={{ background:C.card,borderRadius:24,boxShadow:C.shadow,padding:"18px",marginBottom:12 }}>
          <div style={{ fontWeight:700,fontSize:14,color:C.text,marginBottom:14 }}>Thème</div>
          <div style={{ display:"flex",gap:10 }}>
            {THEMES.map(t=>(
              <button key={t.key} onClick={()=>setTheme(t.key)} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:10,padding:"14px 8px",borderRadius:18,border:theme===t.key?"2px solid "+color:"1.5px solid #E5E7EB",background:theme===t.key?"#F0FDF4":"#F8FAFC",cursor:"pointer",transition:"all 250ms" }}>
                {/* Mini phone preview */}
                <div style={{ width:48,height:64,borderRadius:10,background:t.bg,border:"1.5px solid #E5E7EB",overflow:"hidden",position:"relative",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ height:10,background:color,opacity:.9 }}/>
                  <div style={{ margin:"6px 5px 0",height:5,background:t.textC,borderRadius:3,opacity:.15 }}/>
                  <div style={{ margin:"4px 5px 0",height:5,background:t.textC,borderRadius:3,opacity:.1,width:"60%" }}/>
                  {t.key==="systeme" && <div style={{ position:"absolute",inset:0,background:"linear-gradient(135deg,transparent 50%,rgba(0,0,0,0.5) 50%)" }}/>}
                </div>
                <span style={{ fontSize:12,fontWeight:theme===t.key?700:500,color:theme===t.key?color:C.secondary }}>{t.label}</span>
                {theme===t.key && <div style={{ width:20,height:20,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>}
              </button>
            ))}
          </div>
        </div>

        {/* Couleur principale */}
        <div style={{ background:C.card,borderRadius:24,boxShadow:C.shadow,padding:"18px",marginBottom:12 }}>
          <div style={{ fontWeight:700,fontSize:14,color:C.text,marginBottom:14 }}>Couleur principale</div>
          <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
            {COLORS.map(cl=>(
              <button key={cl.v} onClick={()=>setColor(cl.v)} title={cl.label}
                style={{ width:42,height:42,borderRadius:"50%",background:cl.v,border:color===cl.v?"3px solid #fff":"2px solid transparent",boxShadow:color===cl.v?"0 0 0 2.5px "+cl.v+",0 4px 12px "+cl.v+"55":"0 2px 6px rgba(0,0,0,0.12)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 200ms",flexShrink:0 }}>
                {color===cl.v && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
              </button>
            ))}
          </div>
        </div>

        {/* Taille du texte */}
        <div style={{ background:C.card,borderRadius:24,boxShadow:C.shadow,padding:"18px" }}>
          <div style={{ fontWeight:700,fontSize:14,color:C.text,marginBottom:4 }}>Taille du texte</div>
          <div style={{ fontSize:12,color:C.muted,marginBottom:14 }}>Choisissez la taille de lecture confortable</div>
          <div style={{ display:"flex",gap:8 }}>
            {SIZES.map(s=>(
              <button key={s.key} onClick={()=>setSize(s.key)}
                style={{ flex:1,padding:"12px 6px",borderRadius:14,border:size===s.key?"2px solid "+color:"1.5px solid #E5E7EB",background:size===s.key?"#F0FDF4":"#F8FAFC",cursor:"pointer",textAlign:"center",transition:"all 200ms" }}>
                <div style={{ fontSize:s.size,fontWeight:700,color:size===s.key?color:C.secondary,transition:"font-size 200ms" }}>Aa</div>
                <div style={{ fontSize:11,color:size===s.key?color:C.muted,fontWeight:size===s.key?700:400,marginTop:4 }}>{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        <button style={{ width:"100%",marginTop:16,padding:"16px",borderRadius:18,background:"linear-gradient(135deg,#16A34A,#22C55E)",border:"none",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",boxShadow:"0 8px 24px rgba(34,197,94,0.3)" }}>
          Appliquer le thème
        </button>
      </div>
    </div>
  );
}
