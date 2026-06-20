import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)", premium:"#F4C542" };

const FEATURES = [
  { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.premium} strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>, title:"Stockage 10x plus grand", sub:"Gagnez plus d'espace" },
  { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.premium} strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>, title:"Voir qui visite votre profil", sub:"En illimité" },
  { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.premium} strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>, title:"Monétisation de vos contenus", sub:"Gagnez plus" },
  { icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke={C.premium} strokeWidth="1.6"/></svg>, title:"Badge Premium", sub:"Visibilité maximale" },
];

export default function PremiumPage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<"monthly"|"annual">("monthly");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    await new Promise(r=>setTimeout(r,1500));
    setLoading(false);
    alert("Fonctionnalité de paiement disponible prochainement !");
  };

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Compte Premium</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      {/* Hero banner */}
      <div style={{ background:"linear-gradient(135deg,#064E3B 0%,#065F46 50%,#047857 100%)", padding:"28px 20px 24px", textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
          <div style={{ width:80, height:80, borderRadius:"50%", background:"rgba(244,197,66,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill={C.premium}><path d="M2 20h20v2H2v-2zM4.5 16l-2-8 5 4L12 4l4.5 8 5-4-2 8H4.5z"/></svg>
          </div>
        </div>
        <div style={{ fontWeight:800, fontSize:22, color:"#fff", marginBottom:6 }}>Déverrouillez tout le potentiel</div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,0.8)" }}>Plus de liberté, plus de visibilité.</div>
      </div>

      <div style={{ padding:"16px 12px 100px" }}>
        {/* Plan selector */}
        <div style={{ display:"flex", gap:12, marginBottom:16 }}>
          {/* Monthly */}
          <button onClick={()=>setPlan("monthly")} style={{ flex:1, background:"#fff", border:`2.5px solid ${plan==="monthly"?C.primary:C.border}`, borderRadius:16, padding:"16px 12px", cursor:"pointer", position:"relative", textAlign:"center", boxShadow:plan==="monthly"?`0 4px 16px rgba(34,197,94,0.18)`:"none", transition:"all 0.15s" }}>
            {plan==="monthly" && <div style={{ position:"absolute", top:10, right:10, width:20, height:20, borderRadius:"50%", background:C.primary, display:"flex", alignItems:"center", justifyContent:"center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>}
            <div style={{ fontSize:12, color:C.secondary, fontWeight:500, marginBottom:4 }}>Mensuel</div>
            <div style={{ fontWeight:900, fontSize:22, color:plan==="monthly"?C.primary:C.text }}>2 500</div>
            <div style={{ fontSize:12, color:C.secondary }}>FCFA/mois</div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>Sans engagement</div>
          </button>
          {/* Annual */}
          <button onClick={()=>setPlan("annual")} style={{ flex:1, background:"#fff", border:`2.5px solid ${plan==="annual"?C.primary:C.border}`, borderRadius:16, padding:"16px 12px", cursor:"pointer", position:"relative", textAlign:"center", boxShadow:plan==="annual"?`0 4px 16px rgba(34,197,94,0.18)`:"none", transition:"all 0.15s" }}>
            <div style={{ position:"absolute", top:-10, right:10, background:"#EF4444", borderRadius:10, padding:"2px 8px", fontSize:11, fontWeight:800, color:"#fff" }}>-20%</div>
            {plan==="annual" && <div style={{ position:"absolute", top:10, right:10, width:20, height:20, borderRadius:"50%", background:C.primary, display:"flex", alignItems:"center", justifyContent:"center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>}
            <div style={{ fontSize:12, color:C.secondary, fontWeight:500, marginBottom:4 }}>Annuel</div>
            <div style={{ fontWeight:900, fontSize:22, color:plan==="annual"?C.primary:C.text }}>24 000</div>
            <div style={{ fontSize:12, color:C.secondary }}>FCFA/an</div>
            <div style={{ fontSize:11, color:C.primary, fontWeight:600, marginTop:4 }}>Soit 2 000/mois</div>
          </button>
        </div>

        {/* Features */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderBottom:i<FEATURES.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#FFFDE7", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{f.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:15, color:C.text }}>{f.title}</div>
                <div style={{ fontSize:12, color:C.secondary, marginTop:1 }}>{f.sub}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#C4C9D4" strokeWidth="2.2" strokeLinecap="round"/></svg>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed CTA */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, padding:"12px 16px", paddingBottom:"calc(12px + env(safe-area-inset-bottom,0px))", background:"#fff", borderTop:`1px solid ${C.border}` }}>
        <button onClick={handleSubscribe} disabled={loading} style={{ width:"100%", padding:"16px", borderRadius:16, background:loading?"#A7F3D0":C.premium, border:"none", color:"#1C1917", fontWeight:800, fontSize:16, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"background .15s", boxShadow:`0 4px 16px rgba(244,197,66,0.4)` }}>
          {loading ? <><div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid rgba(0,0,0,0.2)", borderTopColor:"#1C1917", animation:"spin 0.8s linear infinite" }}/> Traitement…</> : <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h20v2H2v-2zM4.5 16l-2-8 5 4L12 4l4.5 8 5-4-2 8H4.5z"/></svg>
            Passer à Premium — {plan==="monthly"?"2 500":"24 000"} FCFA/{plan==="monthly"?"mois":"an"}
          </>}
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
