import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)" };

const LANGUAGES = [
  { code:"fr", label:"Français", native:"Français" },
  { code:"en", label:"Anglais", native:"English" },
  { code:"bm", label:"Bambara", native:"Bamanankan" },
  { code:"ha", label:"Haoussa", native:"Hausa" },
  { code:"wo", label:"Wolof", native:"Wolof" },
  { code:"sw", label:"Swahili", native:"Kiswahili" },
];

const REGIONS = [
  { code:"ML", flag:"🇲🇱", label:"Mali" },
  { code:"SN", flag:"🇸🇳", label:"Sénégal" },
  { code:"CI", flag:"🇨🇮", label:"Côte d'Ivoire" },
  { code:"GH", flag:"🇬🇭", label:"Ghana" },
  { code:"NG", flag:"🇳🇬", label:"Nigéria" },
  { code:"CM", flag:"🇨🇲", label:"Cameroun" },
  { code:"BF", flag:"🇧🇫", label:"Burkina Faso" },
  { code:"BJ", flag:"🇧🇯", label:"Bénin" },
];

function CheckIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={C.primary}><path d="M20 6L9 17l-5-5" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>;
}

export default function LanguagePage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState("fr");
  const [region, setRegion] = useState("ML");

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Langue & région</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      <div style={{ padding:"16px 12px 40px" }}>
        {/* Globe illustration */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
          <div style={{ width:96, height:96, borderRadius:"50%", background:"#CFFAFE", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 0 12px #E0F7FA" }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#06B6D4" opacity=".15"/>
              <circle cx="12" cy="12" r="10" stroke="#06B6D4" strokeWidth="1.8"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="#06B6D4" strokeWidth="1.5"/>
              <path d="M4.93 7h14.14M4.93 17h14.14" stroke="#06B6D4" strokeWidth="1.2" opacity=".5"/>
            </svg>
          </div>
        </div>

        {/* Language section */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.secondary, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, paddingLeft:4 }}>Langue</div>
          <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
            {LANGUAGES.map((l, i) => (
              <button key={l.code} onClick={()=>setLang(l.code)} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", width:"100%", background:"none", border:"none", cursor:"pointer", textAlign:"left", borderBottom:i<LANGUAGES.length-1?`1px solid ${C.border}`:"none", transition:"background .12s" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:15, color:C.text }}>{l.label}</div>
                  <div style={{ fontSize:12, color:C.secondary, marginTop:1 }}>{l.native}</div>
                </div>
                {lang===l.code && <CheckIcon/>}
              </button>
            ))}
          </div>
        </div>

        {/* Region section */}
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.secondary, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, paddingLeft:4 }}>Région</div>
          <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
            {REGIONS.map((r, i) => (
              <button key={r.code} onClick={()=>setRegion(r.code)} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", width:"100%", background:"none", border:"none", cursor:"pointer", textAlign:"left", borderBottom:i<REGIONS.length-1?`1px solid ${C.border}`:"none", transition:"background .12s" }}>
                <span style={{ fontSize:22 }}>{r.flag}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:15, color:C.text }}>{r.label}</div>
                  <div style={{ fontSize:12, color:C.secondary, marginTop:1 }}>{r.code}</div>
                </div>
                {region===r.code && <CheckIcon/>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
