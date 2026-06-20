import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)", danger:"#EF4444" };

type Step = "intro" | "phone" | "code" | "done";

export default function VerifyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("intro");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(["","","","","",""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async () => {
    if (phone.length < 8) { setError("Numéro invalide"); return; }
    setError(""); setLoading(true);
    await new Promise(r=>setTimeout(r,1200));
    setLoading(false); setStep("code");
  };

  const handleVerify = async () => {
    const entered = code.join("");
    if (entered.length < 6) { setError("Code incomplet"); return; }
    setError(""); setLoading(true);
    await new Promise(r=>setTimeout(r,1200));
    setLoading(false); setStep("done");
  };

  const handleCodeInput = (i: number, v: string) => {
    const next = [...code];
    next[i] = v.slice(-1);
    setCode(next);
    if (v && i < 5) {
      const el = document.getElementById(`otp-${i+1}`);
      el?.focus();
    }
  };

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>step==="code"?setStep("phone"):navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Vérification du compte</h1>
        <div style={{ width:44 }}/>
      </div>

      {step === "intro" && (
        <div style={{ padding:"32px 20px", display:"flex", flexDirection:"column", alignItems:"center" }}>
          {/* Shield illustration */}
          <div style={{ width:110, height:110, borderRadius:"50%", background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, boxShadow:"0 0 0 14px #DCFCE7" }}>
            <svg width="58" height="58" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" fill="#22C55E" opacity=".2"/>
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" stroke="#22C55E" strokeWidth="1.8"/>
              <path d="M9 12l2 2 4-4" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontWeight:800, fontSize:22, color:C.text, marginBottom:8, textAlign:"center" }}>Vérifiez votre compte</div>
          <div style={{ fontSize:14, color:C.secondary, textAlign:"center", lineHeight:1.7, marginBottom:32 }}>Protégez votre compte et gagnez la confiance de votre communauté en ajoutant votre numéro de téléphone.</div>

          <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:14, marginBottom:28 }}>
            {[
              { icon:"🔐", title:"Sécurité renforcée", sub:"Ajoutez une couche de protection supplémentaire" },
              { icon:"✅", title:"Récupération de compte", sub:"Retrouvez facilement l'accès si besoin" },
              { icon:"🌍", title:"Confiance de la communauté", sub:"Montrez que vous êtes un vrai membre" },
            ].map((it, i) => (
              <div key={i} style={{ background:C.card, borderRadius:16, padding:"14px 16px", display:"flex", gap:14, alignItems:"center", boxShadow:C.shadow }}>
                <div style={{ fontSize:24, flexShrink:0 }}>{it.icon}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, color:C.text }}>{it.title}</div>
                  <div style={{ fontSize:12, color:C.secondary, marginTop:2 }}>{it.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={()=>setStep("phone")} style={{ width:"100%", padding:"15px", borderRadius:16, background:C.primary, border:"none", color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer", boxShadow:`0 4px 16px rgba(34,197,94,0.3)` }}>
            Ajouter mon numéro
          </button>
        </div>
      )}

      {step === "phone" && (
        <div style={{ padding:"32px 20px" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📱</div>
            <div style={{ fontWeight:700, fontSize:18, color:C.text, marginBottom:6 }}>Votre numéro de téléphone</div>
            <div style={{ fontSize:14, color:C.secondary }}>Nous enverrons un code de vérification à ce numéro.</div>
          </div>

          <div style={{ background:C.card, borderRadius:20, padding:"20px", boxShadow:C.shadow, marginBottom:16 }}>
            <label style={{ fontSize:13, fontWeight:600, color:C.secondary, display:"block", marginBottom:8 }}>NUMÉRO DE TÉLÉPHONE</label>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ background:"#F8FAFC", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"12px 14px", fontWeight:600, color:C.text, fontSize:15, flexShrink:0 }}>🇲🇱 +223</div>
              <input
                type="tel" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))}
                placeholder="XX XX XX XX" maxLength={8}
                style={{ flex:1, background:"#F8FAFC", border:`1.5px solid ${error?C.danger:phone?C.primary:C.border}`, borderRadius:12, padding:"12px 14px", fontSize:16, color:C.text, fontFamily:"Inter,sans-serif", outline:"none", transition:"border .15s" }}
              />
            </div>
            {error && <div style={{ fontSize:12, color:C.danger, marginTop:6, paddingLeft:2 }}>{error}</div>}
          </div>

          <button onClick={handleSendCode} disabled={loading} style={{ width:"100%", padding:"15px", borderRadius:16, background:loading?"#A7F3D0":C.primary, border:"none", color:"#fff", fontWeight:700, fontSize:16, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <><div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", animation:"spin 0.8s linear infinite" }}/> Envoi…</> : "Envoyer le code"}
          </button>
        </div>
      )}

      {step === "code" && (
        <div style={{ padding:"32px 20px" }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔢</div>
            <div style={{ fontWeight:700, fontSize:18, color:C.text, marginBottom:6 }}>Code de vérification</div>
            <div style={{ fontSize:14, color:C.secondary }}>Entrez le code à 6 chiffres envoyé au<br/><strong>+223 {phone}</strong></div>
          </div>

          <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:16 }}>
            {code.map((digit, i) => (
              <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1} value={digit}
                onChange={e=>handleCodeInput(i, e.target.value)}
                onKeyDown={e=>{ if(e.key==="Backspace"&&!code[i]&&i>0){ const el=document.getElementById(`otp-${i-1}`); el?.focus(); } }}
                style={{ width:46, height:56, textAlign:"center", fontSize:24, fontWeight:700, color:C.text, background:digit?"#F0FDF4":"#fff", border:`2px solid ${digit?C.primary:C.border}`, borderRadius:14, outline:"none", fontFamily:"Inter,sans-serif", transition:"border .15s" }}
              />
            ))}
          </div>
          {error && <div style={{ fontSize:12, color:C.danger, textAlign:"center", marginBottom:12 }}>{error}</div>}

          <button onClick={handleVerify} disabled={loading} style={{ width:"100%", padding:"15px", borderRadius:16, background:loading?"#A7F3D0":C.primary, border:"none", color:"#fff", fontWeight:700, fontSize:16, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:12 }}>
            {loading ? <><div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", animation:"spin 0.8s linear infinite" }}/> Vérification…</> : "Vérifier"}
          </button>

          <button style={{ width:"100%", padding:"12px", background:"none", border:"none", color:C.secondary, fontSize:14, cursor:"pointer" }}>
            Renvoyer le code
          </button>
        </div>
      )}

      {step === "done" && (
        <div style={{ padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center" }}>
          <div style={{ width:110, height:110, borderRadius:"50%", background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, boxShadow:"0 0 0 14px #DCFCE7" }}>
            <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke={C.primaryDark} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div style={{ fontWeight:800, fontSize:22, color:C.text, marginBottom:8, textAlign:"center" }}>Compte vérifié ! 🎉</div>
          <div style={{ fontSize:14, color:C.secondary, textAlign:"center", lineHeight:1.7, marginBottom:32 }}>Votre numéro a été vérifié avec succès. Votre compte est maintenant sécurisé.</div>
          <button onClick={()=>navigate("/settings")} style={{ width:"100%", padding:"15px", borderRadius:16, background:C.primary, border:"none", color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer", boxShadow:`0 4px 16px rgba(34,197,94,0.3)` }}>
            Retour aux paramètres
          </button>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
