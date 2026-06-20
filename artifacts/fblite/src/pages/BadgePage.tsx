import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)" };

const BENEFITS = [
  { icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#3B82F6" strokeWidth="1.6"/></svg>, title:"Profil vérifié", sub:"Plus de crédibilité" },
  { icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>, title:"Priorité dans la recherche", sub:"Soyez plus visible" },
  { icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, title:"Protection renforcée", sub:"Sécurité avancée" },
];

export default function BadgePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    await new Promise(r=>setTimeout(r,1500));
    setLoading(false);
    setSuccess(true);
  };

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Badge vérifié</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      <div style={{ padding:"24px 12px 100px" }}>
        {/* Badge illustration */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <div style={{ position:"relative" }}>
            <div style={{ width:110, height:110, borderRadius:"50%", background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 0 12px #EFF6FF, 0 8px 32px rgba(59,130,246,0.2)" }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" fill="#3B82F6" opacity=".15"/>
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#3B82F6" strokeWidth="1.4"/>
                <path d="M9 12l2 2 4-4" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {/* Sparkles */}
            <div style={{ position:"absolute", top:-4, right:-4, fontSize:16 }}>✨</div>
            <div style={{ position:"absolute", bottom:4, left:-8, fontSize:12 }}>⭐</div>
          </div>
        </div>

        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontWeight:800, fontSize:22, color:C.text, marginBottom:6 }}>Obtenez votre badge</div>
          <div style={{ fontSize:14, color:C.secondary, lineHeight:1.6 }}>Montrez que vous êtes authentique.</div>
        </div>

        {/* Benefits card */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden", marginBottom:20 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderBottom:i<BENEFITS.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {b.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:15, color:C.text }}>{b.title}</div>
                <div style={{ fontSize:13, color:C.secondary, marginTop:1 }}>{b.sub}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#C4C9D4" strokeWidth="2.2" strokeLinecap="round"/></svg>
            </div>
          ))}
        </div>

        {/* Price info */}
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:13, color:C.secondary }}>Vérification unique</div>
          <div style={{ fontWeight:800, fontSize:28, color:C.text, margin:"4px 0" }}>2 500 <span style={{ fontSize:16, fontWeight:600, color:C.secondary }}>FCFA</span></div>
        </div>
      </div>

      {/* Fixed CTA */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, padding:"12px 16px", paddingBottom:"calc(12px + env(safe-area-inset-bottom,0px))", background:"#fff", borderTop:`1px solid ${C.border}` }}>
        {success ? (
          <div style={{ background:"#DCFCE7", borderRadius:16, padding:"16px", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primaryDark} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontWeight:700, fontSize:15, color:C.primaryDark }}>Badge vérifié activé !</span>
          </div>
        ) : (
          <button onClick={handlePay} disabled={loading} style={{ width:"100%", padding:"16px", borderRadius:16, background:loading?"#A7F3D0":C.primary, border:"none", color:"#fff", fontWeight:700, fontSize:16, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"background .15s" }}>
            {loading ? <><div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", animation:"spin 0.8s linear infinite" }}/> Traitement…</> : "Obtenir pour 2 500 FCFA"}
          </button>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
