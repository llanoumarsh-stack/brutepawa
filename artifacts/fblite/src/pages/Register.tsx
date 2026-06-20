import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiRegister, saveFbUser, setBpToken } from "../lib/api";
import { detectRegion, detectRegionFast, getLanguageForRegion } from "../services/regionService";
import { getPopularLanguages, searchLanguages, type Language } from "../services/languageService";

/* ─── Constants ─────────────────────────────────────────────── */
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const CY = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CY - 5 - i);
const DAYS  = Array.from({ length: 31 }, (_, i) => i + 1);

const USERNAME_SUGGESTIONS = (phone: string) => {
  const base = phone.replace(/\D/g, "").slice(-4);
  return [`@user${base}`, `@bp${base}`, `@pawa${base}`];
};

const PW_CHECKS = [
  { label: "Au moins 8 caractères",       test: (p: string) => p.length >= 8 },
  { label: "Inclure une majuscule",        test: (p: string) => /[A-Z]/.test(p) },
  { label: "Inclure un chiffre",           test: (p: string) => /\d/.test(p) },
  { label: "Inclure un caractère spécial", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

const BENEFITS = [
  { icon: "🤝", label: "Connectez-vous avec vos amis" },
  { icon: "📢", label: "Partagez vos idées" },
  { icon: "💼", label: "Développez votre réseau" },
  { icon: "🌍", label: "Découvrez du contenu inspirant" },
];

/* ─── Shared Styles ─────────────────────────────────────────── */
const CSS = `
  @keyframes fadeInUp { from { opacity:0;transform:translateY(18px); } to { opacity:1;transform:none; } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes spin     { to { transform:rotate(360deg); } }
  @keyframes glowPulse { 0%,100%{opacity:.7;} 50%{opacity:1;} }
  @keyframes floatPt  { 0%,100%{transform:translateY(0);opacity:.55;} 50%{transform:translateY(-9px);opacity:1;} }
  @keyframes arcMove  { 0%,100%{transform:translateX(0) rotate(-28deg);} 50%{transform:translateX(10px) rotate(-26deg);} }
  @keyframes confettiDrop { 0%{transform:translateY(-40px) rotate(0deg);opacity:1;} 100%{transform:translateY(110vh) rotate(720deg);opacity:0;} }
  @keyframes checkPop { 0%{transform:scale(0) rotate(-45deg);opacity:0;} 60%{transform:scale(1.2) rotate(5deg);} 100%{transform:scale(1) rotate(0deg);opacity:1;} }
  @keyframes slideUpSheet { from{transform:translateY(100%);} to{transform:translateY(0);} }
  @keyframes countDown { from{stroke-dashoffset:0;} to{stroke-dashoffset:251;} }

  .rg-field {
    width:100%; box-sizing:border-box;
    height:54px; padding:0 14px 0 48px;
    background:rgba(255,255,255,0.04);
    border:1.5px solid rgba(255,255,255,0.1);
    border-radius:16px; font-size:15px; color:#fff;
    font-family:inherit; outline:none;
    transition:border-color .2s,box-shadow .2s;
  }
  .rg-field::placeholder { color:#6B7280; }
  .rg-field:focus { border-color:rgba(34,197,94,.6); box-shadow:0 0 0 3px rgba(34,197,94,.12); }

  .rg-select {
    width:100%; box-sizing:border-box;
    height:54px; padding:0 36px 0 14px;
    background:rgba(255,255,255,0.04);
    border:1.5px solid rgba(255,255,255,0.1);
    border-radius:16px; font-size:15px; color:#fff;
    font-family:inherit; outline:none; appearance:none;
    cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 12px center;
    transition:border-color .2s,box-shadow .2s;
  }
  .rg-select:focus { border-color:rgba(34,197,94,.6); box-shadow:0 0 0 3px rgba(34,197,94,.12); }
  .rg-select option { background:#0D1A12; color:#fff; }

  .rg-btn {
    width:100%; height:56px; border:none; border-radius:18px; cursor:pointer;
    background:linear-gradient(135deg,#22C55E 0%,#16A34A 100%);
    color:#fff; font-size:17px; font-weight:800; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:10px;
    box-shadow:0 0 24px rgba(34,197,94,.4), 0 4px 16px rgba(0,0,0,.3);
    transition:transform .15s,box-shadow .15s;
  }
  .rg-btn:hover:not(:disabled) { transform:translateY(-2px) scale(1.02); box-shadow:0 0 32px rgba(34,197,94,.55),0 6px 20px rgba(0,0,0,.4); }
  .rg-btn:active:not(:disabled) { transform:scale(.97); }
  .rg-btn:disabled { background:linear-gradient(135deg,#166534,#14532d); box-shadow:none; cursor:not-allowed; }

  .rg-btn-outline {
    width:100%; height:52px; border:1.5px solid rgba(255,255,255,.12); border-radius:16px; cursor:pointer;
    background:rgba(255,255,255,.03); color:rgba(255,255,255,.8);
    font-size:15px; font-weight:600; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:background .15s,border-color .15s;
  }
  .rg-btn-outline:hover { background:rgba(255,255,255,.06); border-color:rgba(34,197,94,.35); }

  .otp-input {
    width:44px; height:54px; text-align:center; font-size:22px; font-weight:700; color:#fff;
    background:rgba(255,255,255,.05); border:1.5px solid rgba(255,255,255,.12);
    border-radius:14px; font-family:inherit; outline:none; caret-color:#22C55E;
    transition:border-color .2s,box-shadow .2s;
  }
  .otp-input:focus { border-color:#22C55E; box-shadow:0 0 0 3px rgba(34,197,94,.18); }
  .otp-input.filled { border-color:rgba(34,197,94,.6); background:rgba(34,197,94,.08); }
`;

/* ─── Shared Background ─────────────────────────────────────── */
function RegBackground() {
  return (
    <>
      {/* Radial glows */}
      <div style={{ position:"fixed", top:-60, right:-40, width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle,rgba(34,197,94,.2) 0%,transparent 70%)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", top:90, right:20, width:160, height:160, borderRadius:"50%", background:"radial-gradient(circle,rgba(74,222,128,.1) 0%,transparent 70%)", pointerEvents:"none", zIndex:0 }} />
      {/* Giant "B" */}
      <div style={{ position:"fixed", top:"-6%", left:"-8%", fontSize:"130vw", fontWeight:900, lineHeight:1, color:"rgba(34,197,94,0.06)", pointerEvents:"none", zIndex:0, userSelect:"none", fontFamily:"Arial Black,sans-serif", letterSpacing:"-0.05em" }}>B</div>
      {/* Neon arc */}
      <div style={{ position:"fixed", top:"16%", right:"-4%", width:"55%", height:3, background:"linear-gradient(90deg,transparent,rgba(34,197,94,.55),rgba(74,222,128,.25),transparent)", borderRadius:2, transform:"rotate(-28deg)", animation:"arcMove 6s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />
      {/* Particles */}
      {[[10,24,1.6],[88,42,1.2],[18,62,1.8],[74,28,1.4],[50,14,1.0],[36,78,1.5]].map(([x,y,s],i) => (
        <div key={i} style={{ position:"fixed", left:`${x}%`, top:`${y}%`, width:s, height:s, borderRadius:"50%", background:"#22C55E", boxShadow:`0 0 ${s*3}px rgba(34,197,94,.8)`, animation:`floatPt ${3+i*.5}s ease-in-out infinite`, animationDelay:`${i*.4}s`, pointerEvents:"none", zIndex:0 }} />
      ))}
      {/* Globe */}
      <div style={{ position:"fixed", bottom:-10, left:"50%", transform:"translateX(-50%)", width:"115%", zIndex:0, pointerEvents:"none", opacity:0.85 }}>
        <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:"100%", height:"auto", display:"block" }}>
          <ellipse cx="200" cy="310" rx="185" ry="185" stroke="rgba(34,197,94,.22)" strokeWidth="1"/>
          {[255,290,325,360].map((y,i) => { const r=Math.sqrt(Math.max(0,185*185-(y-310)*(y-310))); return r>0?<ellipse key={i} cx="200" cy={y} rx={r} ry={r*.28} stroke="rgba(34,197,94,.16)" strokeWidth=".8"/>:null; })}
          {[-70,-35,0,35,70].map((a,i) => <ellipse key={i} cx="200" cy="310" rx={185*Math.abs(Math.cos(a*Math.PI/180))+1} ry="185" stroke="rgba(34,197,94,.13)" strokeWidth=".7" style={{ transform:`rotate(${a}deg)`, transformOrigin:"200px 310px" }}/>)}
          {[[80,262],[130,248],[175,238],[225,238],[270,245],[310,258],[60,285],[110,272],[160,262],[200,258],[250,262],[300,273],[100,300],[155,285],[200,280],[248,286],[295,300],[150,305],[200,302],[245,306]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="2.5" fill="#22C55E" fillOpacity={.7-i*.02}/>)}
          {[[80,262,130,248],[130,248,175,238],[175,238,225,238],[225,238,270,245],[270,245,310,258],[60,285,110,272],[110,272,160,262],[160,262,200,258],[200,258,250,262],[250,262,300,273],[100,300,155,285],[155,285,200,280],[200,280,248,286],[130,248,110,272],[175,238,160,262],[225,238,200,258],[200,258,200,280]].map(([x1,y1,x2,y2],i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22C55E" strokeOpacity=".3" strokeWidth=".8"/>)}
          {[[175,238],[200,258]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="5" fill="none" stroke="#22C55E" strokeOpacity=".4" strokeWidth="1"><animate attributeName="r" values="3;8;3" dur={`${2+i*.8}s`} repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".5;0;.5" dur={`${2+i*.8}s`} repeatCount="indefinite"/></circle>)}
        </svg>
      </div>
    </>
  );
}

/* ─── Progress dots ─────────────────────────────────────────── */
function ProgressDots({ step }: { step: number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"center", marginBottom:18 }}>
      {Array.from({length:7},(_,i) => (
        <div key={i} style={{ height:4, borderRadius:2, transition:"all .35s", background: i < step ? "#22C55E" : "rgba(255,255,255,.15)", width: i === step-1 ? 28 : 10 }} />
      ))}
    </div>
  );
}

/* ─── Glass Card ─────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      width:"88%", borderRadius:28,
      background:"rgba(0,0,0,0.30)", backdropFilter:"blur(40px)", WebkitBackdropFilter:"blur(40px)",
      border:"1px solid rgba(255,255,255,.1)",
      boxShadow:"0 0 40px rgba(34,197,94,.07), 0 8px 32px rgba(0,0,0,.5)",
      padding:"22px 20px 20px",
      animation:"fadeInUp .5s cubic-bezier(.16,1,.3,1)",
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── Back Button ─────────────────────────────────────────────── */
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ position:"absolute", top:16, left:16, width:38, height:38, borderRadius:"50%", background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:5, transition:"background .15s" }}
      onMouseEnter={e => (e.currentTarget.style.background="rgba(255,255,255,.12)")}
      onMouseLeave={e => (e.currentTarget.style.background="rgba(255,255,255,.06)")}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

/* ─── Step Icon ─────────────────────────────────────────────── */
function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(34,197,94,.12)", border:"1.5px solid rgba(34,197,94,.25)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", boxShadow:"0 0 24px rgba(34,197,94,.2)" }}>
      {children}
    </div>
  );
}

/* ─── Error Banner ─────────────────────────────────────────────── */
function ErrorBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{ background:"rgba(220,38,38,.1)", border:"1px solid rgba(220,38,38,.3)", borderRadius:12, padding:"10px 14px", color:"#FCA5A5", fontSize:13, display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#FCA5A5" strokeWidth="1.3"/><path d="M7 4v3" stroke="#FCA5A5" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7" cy="9.5" r=".6" fill="#FCA5A5"/></svg>
      {msg}
    </div>
  );
}

/* ─── Language Sheet ─────────────────────────────────────────── */
function LangSheet({ current, onSelect, onClose, regionFlag, regionName }: {
  current: Language; onSelect: (l:Language) => void; onClose: () => void;
  regionFlag?: string; regionName?: string;
}) {
  const [q, setQ] = useState("");
  const results = q.trim() ? searchLanguages(q) : getPopularLanguages();
  return createPortal(
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9000, background:"rgba(0,0,0,.7)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" }} />
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:9001, background:"#0D1A12", border:"1px solid rgba(34,197,94,.15)", borderRadius:"28px 28px 0 0", maxHeight:"75vh", display:"flex", flexDirection:"column", animation:"slideUpSheet .3s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 0" }}><div style={{ width:40, height:4, background:"rgba(255,255,255,.15)", borderRadius:99 }} /></div>
        <div style={{ padding:"12px 18px 8px", fontSize:16, fontWeight:700, color:"#fff" }}>Choisir une langue</div>
        <div style={{ padding:"0 14px 10px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.06)", borderRadius:12, padding:"0 14px", height:40, border:"1px solid rgba(255,255,255,.08)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="#6B7280" strokeWidth="1.5"/><path d="M10 10l3 3" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher..." style={{ flex:1, background:"none", border:"none", outline:"none", fontSize:14, color:"#fff", fontFamily:"inherit" }}/>
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"0 8px 8px" }}>
          {results.map(l => (
            <button key={l.code} onClick={() => { onSelect(l); onClose(); }} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, height:52, padding:"0 12px", borderRadius:12, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
              <span style={{ fontSize:22 }}>{l.flag}</span>
              <span style={{ flex:1, fontSize:15, fontWeight:500, color:"#E5E7EB", textAlign:"left" }}>{l.nameNative}</span>
              {l.code===current.code && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4L13 4" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
        {(regionFlag || regionName) && (
          <div style={{ padding:"10px 16px 28px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, border:"1px solid rgba(34,197,94,0.15)", borderRadius:12, padding:"11px 14px", background:"rgba(34,197,94,0.06)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.3C5.12 1.3 3.6 2.82 3.6 4.7c0 2.84 3.4 7.6 3.4 7.6s3.4-4.76 3.4-7.6C10.4 2.82 8.88 1.3 7 1.3z" stroke="#22C55E" strokeWidth="1.2"/>
                <circle cx="7" cy="4.7" r="1.1" stroke="#22C55E" strokeWidth="1.2"/>
              </svg>
              <span style={{ fontSize:12, color:"#6B7280", fontWeight:500 }}>Pays détecté</span>
              <span style={{ marginLeft:"auto", fontSize:14, fontWeight:700, color:"#22C55E" }}>{regionFlag} {regionName}</span>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

/* ─── Confetti ─────────────────────────────────────────────── */
function Confetti() {
  const items = Array.from({length:40},(_,i) => ({
    x: Math.random()*100, delay: Math.random()*2, dur: 2.5+Math.random()*2,
    color: i%3===0?"#22C55E":i%3===1?"#fff":"#4ADE80",
    size: 6+Math.random()*8, shape: i%2===0?"rect":"circle",
  }));
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:50, overflow:"hidden" }}>
      {items.map((c,i) => (
        <div key={i} style={{
          position:"absolute", left:`${c.x}%`, top:0,
          width:c.size, height:c.shape==="rect"?c.size*.5:c.size,
          borderRadius:c.shape==="circle"?"50%":2,
          background:c.color, opacity:0,
          animation:`confettiDrop ${c.dur}s ${c.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  /* Form state */
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("BJ");
  const [otpCode, setOtpCode] = useState(["","","","","",""]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [day, setDay]     = useState("1");
  const [month, setMonth] = useState("1");
  const [year, setYear]   = useState(String(CY-20));
  const [gender, setGender] = useState("Homme");
  const [username, setUsername] = useState("");
  const [usernameOk, setUsernameOk] = useState<boolean|null>(null);
  const [password, setPw]   = useState("");
  const [pwConfirm, setPwC] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwC, setShowPwC] = useState(false);
  const [photo, setPhoto]   = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  /* ── Fast sync init: timezone → instant region display ── */
  const _fast = detectRegionFast();
  const [lang, setLang]     = useState<Language>(() => getLanguageForRegion(_fast));
  const [regionFlag, setRegionFlag] = useState<string>(_fast.countryFlag || "🌍");
  const [regionName, setRegionName] = useState<string>(_fast.countryName || "");
  const [showLang, setShowLang] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showConfetti, setShowConfetti] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(60);

  const otpRefs = useRef<(HTMLInputElement|null)[]>([]);
  const fileRef  = useRef<HTMLInputElement>(null);

  /* ── Async refine: IP-based / Cloudflare ── */
  useEffect(() => {
    detectRegion(false).then(r => {
      if (r.source !== "timezone" && r.source !== "browser") {
        setLang(getLanguageForRegion(r));
        setRegionFlag(r.countryFlag || "🌍");
        setRegionName(r.countryName || "");
        const c = COUNTRIES.find(x => x.code === r.countryCode);
        if (c) setCountryCode(c.code);
      } else {
        const c = COUNTRIES.find(x => x.code === r.countryCode);
        if (c) setCountryCode(c.code);
      }
    }).catch(() => {});
  }, []);

  /* SMS countdown */
  useEffect(() => {
    if (step !== 2) return;
    setSmsCountdown(60);
    const t = setInterval(() => setSmsCountdown(c => Math.max(0, c-1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  /* Welcome countdown */
  useEffect(() => {
    if (step !== 7) return;
    setShowConfetti(true);
    setCountdown(5);
    const t = setInterval(() => setCountdown(c => { if(c<=1){clearInterval(t); navigate("/"); return 0;} return c-1; }), 1000);
    return () => clearInterval(t);
  }, [step, navigate]);

  /* Username debounce check */
  useEffect(() => {
    if (!username || username.length < 3) { setUsernameOk(null); return; }
    setUsernameOk(null);
    const t = setTimeout(() => setUsernameOk(username.length >= 4), 600);
    return () => clearTimeout(t);
  }, [username]);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];

  const pwScore = PW_CHECKS.filter(c => c.test(password)).length;
  const pwStrength = pwScore <= 1 ? "Faible" : pwScore <= 2 ? "Moyen" : pwScore <= 3 ? "Bon" : "Fort";
  const pwColor    = pwScore <= 1 ? "#ef4444" : pwScore <= 2 ? "#f97316" : pwScore <= 3 ? "#eab308" : "#22C55E";

  const next = () => { setError(""); setStep(s => s+1); };
  const back = () => { setError(""); setStep(s => s-1); };

  /* OTP input handling */
  const handleOtp = useCallback((i: number, val: string) => {
    const digit = val.replace(/\D/g,"").slice(-1);
    setOtpCode(prev => { const next=[...prev]; next[i]=digit; return next; });
    if (digit && i < 5) setTimeout(() => otpRefs.current[i+1]?.focus(), 0);
    if (!digit && i > 0) setTimeout(() => otpRefs.current[i-1]?.focus(), 0);
  }, []);

  /* Final submit */
  const handleSubmit = async () => {
    const email = `${phone.replace(/\D/g,"")}@bp.phone`;
    const dob   = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    setLoading(true); setError("");
    try {
      const { token, user } = await apiRegister({ firstName, lastName, email, password, phone, countryCode, gender, dateOfBirth: dob, username });
      setBpToken(token); saveFbUser(user);
      next();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création du compte.");
    } finally { setLoading(false); }
  };

  /* Photo handling */
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setPhoto(ev.target?.result as string); r.readAsDataURL(f);
  };

  /* STEPS content */
  const renderStep = () => {
    /* ── STEP 1 — Téléphone ── */
    if (step === 1) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", paddingBottom:"clamp(90px,16vh,110px)" }}>
        {/* Language pill — top left */}
        <div style={{ width:"88%", display:"flex", justifyContent:"flex-start", marginTop:"clamp(20px,4vh,36px)", marginBottom:12 }}>
          <button onClick={() => setShowLang(true)} style={{ display:"flex", alignItems:"center", gap:7, height:44, padding:"0 14px", background:"rgba(0,0,0,.45)", backdropFilter:"blur(30px)", WebkitBackdropFilter:"blur(30px)", border:"1px solid rgba(255,255,255,.12)", borderRadius:22, color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#22C55E" strokeWidth="1.3"/><ellipse cx="8" cy="8" rx="2.8" ry="6.5" stroke="#22C55E" strokeWidth="1.3"/><path d="M1.5 6h13M1.5 10h13" stroke="#22C55E" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <span>{lang.flag} {lang.nameNative}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Logo */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:12 }}>
          <img src="/logo.png" alt="BrutePawa" style={{ width:"clamp(60px,13vw,78px)", height:"clamp(60px,13vw,78px)", objectFit:"contain", filter:"drop-shadow(0 0 14px rgba(34,197,94,.5))", animation:"glowPulse 3s ease-in-out infinite" }} />
          <div style={{ marginTop:6, fontSize:"clamp(16px,4vw,20px)", fontWeight:800 }}>
            <span style={{ color:"#fff" }}>Brute</span><span style={{ color:"#22C55E" }}>Pawa</span>
          </div>
        </div>

        <Card>
          <ProgressDots step={step} />
          <h2 style={{ margin:"0 0 4px", color:"#fff", fontSize:"clamp(20px,5vw,24px)", fontWeight:800, textAlign:"center" }}>Créer votre <span style={{ color:"#22C55E" }}>compte</span></h2>
          <p style={{ margin:"0 0 16px", color:"#9CA3AF", fontSize:14, textAlign:"center" }}>Entrez votre numéro de téléphone pour commencer.</p>

          <ErrorBanner msg={error} />

          {/* Country selector */}
          <div style={{ marginBottom:10 }}>
            <select className="rg-select" value={countryCode} onChange={e => setCountryCode(e.target.value)}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.phone})</option>)}
            </select>
          </div>

          {/* Phone input */}
          <div style={{ position:"relative", marginBottom:6 }}>
            <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#22C55E", fontSize:14, fontWeight:600 }}>{selectedCountry.phone}</div>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="12 34 56 78"
              style={{ width:"100%", boxSizing:"border-box", height:54, paddingLeft: selectedCountry.phone.length*9+20, paddingRight:14, background:"rgba(255,255,255,.04)", border:"1.5px solid rgba(255,255,255,.1)", borderRadius:16, fontSize:17, color:"#fff", fontFamily:"inherit", outline:"none", letterSpacing:2 }}
              onFocus={e => { e.target.style.borderColor="rgba(34,197,94,.6)"; e.target.style.boxShadow="0 0 0 3px rgba(34,197,94,.12)"; }}
              onBlur={e => { e.target.style.borderColor="rgba(255,255,255,.1)"; e.target.style.boxShadow="none"; }}
            />
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:16 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#22C55E" strokeWidth="1.2"/><path d="M5 6.5l1.5 1.5 2.5-3" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize:12, color:"#6B7280" }}>Nous détectons automatiquement votre région.</span>
          </div>

          <button className="rg-btn" onClick={() => { if (!phone.trim()) return setError("Veuillez entrer votre numéro."); next(); }}>
            Continuer <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9h10M9 4l5 5-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <p style={{ margin:"12px 0 0", fontSize:12, color:"#6B7280", textAlign:"center" }}>Nous ne partagerons jamais votre numéro.</p>
        </Card>
      </div>
    );

    /* ── STEP 2 — SMS ── */
    if (step === 2) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", paddingTop:"clamp(50px,9vh,80px)", paddingBottom:"clamp(60px,10vh,80px)" }}>
        <Card style={{ position:"relative" }}>
          <BackBtn onClick={back} />
          <ProgressDots step={step} />
          <StepIcon>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="3" y="7" width="22" height="14" rx="3" stroke="#22C55E" strokeWidth="1.8"/><path d="M8 13h3M13 13h7" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/><circle cx="21" cy="21" r="5" fill="#0D1A12" stroke="#22C55E" strokeWidth="1.5"/><path d="M21 19.5v2l1 1" stroke="#22C55E" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </StepIcon>
          <h2 style={{ margin:"0 0 4px", color:"#fff", fontSize:"clamp(20px,5vw,24px)", fontWeight:800, textAlign:"center" }}>Vérifiez votre numéro</h2>
          <p style={{ margin:"0 0 4px", color:"#9CA3AF", fontSize:14, textAlign:"center" }}>Nous avons envoyé un code de vérification par SMS au numéro</p>
          <p style={{ margin:"0 0 18px", color:"#22C55E", fontSize:15, fontWeight:700, textAlign:"center" }}>{selectedCountry.phone} {phone}</p>

          <ErrorBanner msg={error} />

          {/* OTP boxes */}
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:18 }}>
            {otpCode.map((v,i) => (
              <input key={i} ref={el => { otpRefs.current[i]=el; }} className={`otp-input${v?" filled":""}`} type="text" inputMode="numeric" maxLength={1} value={v}
                onChange={e => handleOtp(i, e.target.value)}
                onKeyDown={e => { if(e.key==="Backspace"&&!v&&i>0) otpRefs.current[i-1]?.focus(); }}
              />
            ))}
          </div>

          <button className="rg-btn" onClick={() => { if(otpCode.join("").length<6) return setError("Veuillez entrer le code à 6 chiffres."); next(); }}>
            Vérifier le code
          </button>

          <div style={{ textAlign:"center", marginTop:14 }}>
            {smsCountdown > 0
              ? <span style={{ fontSize:13, color:"#6B7280" }}>Renvoyer le code dans <span style={{ color:"#22C55E", fontWeight:600 }}>{smsCountdown}s</span></span>
              : <button onClick={() => setSmsCountdown(60)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, fontWeight:700, color:"#22C55E", fontFamily:"inherit" }}>Renvoyer par SMS</button>
            }
          </div>
        </Card>
      </div>
    );

    /* ── STEP 3 — Informations ── */
    if (step === 3) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", paddingTop:"clamp(40px,7vh,70px)", paddingBottom:"clamp(60px,10vh,80px)" }}>
        <Card style={{ position:"relative" }}>
          <BackBtn onClick={back} />
          <ProgressDots step={step} />
          <StepIcon>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="10" r="5" stroke="#22C55E" strokeWidth="1.8"/><path d="M5 24c0-4.97 4.03-8 9-8s9 3.03 9 8" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </StepIcon>
          <h2 style={{ margin:"0 0 4px", color:"#fff", fontSize:"clamp(18px,5vw,22px)", fontWeight:800, textAlign:"center" }}>Vos informations</h2>
          <p style={{ margin:"0 0 16px", color:"#9CA3AF", fontSize:14, textAlign:"center" }}>Renseignez vos informations personnelles.</p>

          <ErrorBanner msg={error} />

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* First name */}
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="7" r="3" stroke="#22C55E" strokeWidth="1.4"/><path d="M3 16c0-3 2.5-5 6-5s6 2 6 5" stroke="#22C55E" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <input className="rg-field" type="text" placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)}/>
            </div>
            {/* Last name */}
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="7" r="3" stroke="#22C55E" strokeWidth="1.4"/><path d="M3 16c0-3 2.5-5 6-5s6 2 6 5" stroke="#22C55E" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <input className="rg-field" type="text" placeholder="Nom de famille" value={lastName} onChange={e => setLastName(e.target.value)}/>
            </div>
            {/* Birthdate */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1.3fr", gap:8 }}>
              <select className="rg-select" value={day} onChange={e => setDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="rg-select" value={month} onChange={e => setMonth(e.target.value)}>
                {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="rg-select" value={year} onChange={e => setYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* Gender */}
            <select className="rg-select" value={gender} onChange={e => setGender(e.target.value)}>
              <option value="Homme">Homme</option>
              <option value="Femme">Femme</option>
              <option value="Autre">Autre / Non précisé</option>
            </select>
          </div>

          <button className="rg-btn" style={{ marginTop:16 }} onClick={() => { if(!firstName.trim()||!lastName.trim()) return setError("Veuillez entrer votre prénom et votre nom."); next(); }}>
            Continuer <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9h10M9 4l5 5-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </Card>
      </div>
    );

    /* ── STEP 4 — Username ── */
    if (step === 4) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", paddingTop:"clamp(40px,7vh,70px)", paddingBottom:"clamp(60px,10vh,80px)" }}>
        <Card style={{ position:"relative" }}>
          <BackBtn onClick={back} />
          <ProgressDots step={step} />
          <StepIcon>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="4.5" stroke="#22C55E" strokeWidth="1.8"/><path d="M22 14c0 5.5-4 9-9 9" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/><path d="M20.5 9A9 9 0 0014 5" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </StepIcon>
          <h2 style={{ margin:"0 0 4px", color:"#fff", fontSize:"clamp(18px,4.5vw,22px)", fontWeight:800, textAlign:"center" }}>Choisissez votre<br/>nom d'utilisateur</h2>
          <p style={{ margin:"0 0 16px", color:"#9CA3AF", fontSize:13, textAlign:"center" }}>C'est votre identité unique sur BrutePawa.</p>

          <ErrorBanner msg={error} />

          {/* Username input */}
          <div style={{ position:"relative", marginBottom:6 }}>
            <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#22C55E", fontWeight:700, fontSize:16 }}>@</div>
            <input className="rg-field" type="text" placeholder="votre_username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g,""))} style={{ paddingLeft:34 }}/>
            {usernameOk !== null && (
              <div style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)" }}>
                {usernameOk
                  ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="rgba(34,197,94,.15)" stroke="#22C55E" strokeWidth="1.5"/><path d="M5.5 9l2.5 2.5 4-5" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" fill="rgba(239,68,68,.12)" stroke="#ef4444" strokeWidth="1.5"/><path d="M6 6l6 6M12 6l-6 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
                }
              </div>
            )}
          </div>

          {usernameOk === true && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#22C55E" strokeWidth="1.2"/><path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span style={{ fontSize:12, color:"#22C55E", fontWeight:600 }}>Nom d'utilisateur disponible !</span>
            </div>
          )}

          {/* Suggestions */}
          <div style={{ marginBottom:16 }}>
            <p style={{ margin:"0 0 8px", fontSize:12, color:"#6B7280" }}>Suggestions :</p>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {USERNAME_SUGGESTIONS(phone).map((s,i) => (
                <button key={i} onClick={() => setUsername(s.replace("@",""))} style={{ padding:"6px 12px", background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.2)", borderRadius:20, color:"#22C55E", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{s}</button>
              ))}
            </div>
          </div>

          <button className="rg-btn" onClick={() => { if(!username||username.length<3) return setError("Nom d'utilisateur trop court (min. 3 caractères)."); next(); }}>
            Continuer <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9h10M9 4l5 5-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </Card>
      </div>
    );

    /* ── STEP 5 — Mot de passe ── */
    if (step === 5) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", paddingTop:"clamp(30px,5vh,60px)", paddingBottom:"clamp(60px,10vh,80px)" }}>
        <Card style={{ position:"relative" }}>
          <BackBtn onClick={back} />
          <ProgressDots step={step} />
          <StepIcon>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="6" y="13" width="16" height="11" rx="2.5" stroke="#22C55E" strokeWidth="1.8"/><path d="M10 13V9a4 4 0 018 0v4" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/><circle cx="14" cy="18.5" r="1.5" fill="#22C55E"/></svg>
          </StepIcon>
          <h2 style={{ margin:"0 0 4px", color:"#fff", fontSize:"clamp(18px,4.5vw,22px)", fontWeight:800, textAlign:"center" }}>Créez un mot de passe</h2>
          <p style={{ margin:"0 0 14px", color:"#9CA3AF", fontSize:13, textAlign:"center" }}>Utilisez un mot de passe sécurisé pour protéger votre compte.</p>

          <ErrorBanner msg={error} />

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Password */}
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="#22C55E" strokeWidth="1.4"/><path d="M6 8V6a3 3 0 016 0v2" stroke="#22C55E" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <input className="rg-field" type={showPw?"text":"password"} placeholder="Mot de passe" value={password} onChange={e => setPw(e.target.value)} style={{ paddingRight:44 }}/>
              <button type="button" onClick={() => setShowPw(v=>!v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#6B7280", padding:4 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">{showPw?<><path d="M1.5 9s3-5.5 7.5-5.5S16.5 9 16.5 9s-3 5.5-7.5 5.5S1.5 9 1.5 9z" stroke="#6B7280" strokeWidth="1.3"/><circle cx="9" cy="9" r="2" stroke="#6B7280" strokeWidth="1.3"/><path d="M2 2l14 14" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round"/></>:<><path d="M1.5 9s3-5.5 7.5-5.5S16.5 9 16.5 9s-3 5.5-7.5 5.5S1.5 9 1.5 9z" stroke="#6B7280" strokeWidth="1.3"/><circle cx="9" cy="9" r="2" stroke="#6B7280" strokeWidth="1.3"/></>}</svg>
              </button>
            </div>

            {/* Strength */}
            {password.length > 0 && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, color:"#6B7280" }}>Force du mot de passe</span>
                  <span style={{ fontSize:12, fontWeight:700, color:pwColor }}>{pwStrength}</span>
                </div>
                <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,.08)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:2, background:pwColor, width:`${pwScore*25}%`, transition:"width .3s,background .3s" }}/>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:8 }}>
                  {PW_CHECKS.map((c,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="5.5" stroke={c.test(password)?"#22C55E":"rgba(255,255,255,.2)"} strokeWidth="1.2"/>
                        {c.test(password) && <path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round"/>}
                      </svg>
                      <span style={{ fontSize:12, color:c.test(password)?"#22C55E":"#6B7280" }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm */}
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="#22C55E" strokeWidth="1.4"/><path d="M6 8V6a3 3 0 016 0v2" stroke="#22C55E" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <input className="rg-field" type={showPwC?"text":"password"} placeholder="Confirmer le mot de passe" value={pwConfirm} onChange={e => setPwC(e.target.value)} style={{ paddingRight:44 }}/>
              <button type="button" onClick={() => setShowPwC(v=>!v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#6B7280", padding:4 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">{showPwC?<><path d="M1.5 9s3-5.5 7.5-5.5S16.5 9 16.5 9s-3 5.5-7.5 5.5S1.5 9 1.5 9z" stroke="#6B7280" strokeWidth="1.3"/><circle cx="9" cy="9" r="2" stroke="#6B7280" strokeWidth="1.3"/><path d="M2 2l14 14" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round"/></>:<><path d="M1.5 9s3-5.5 7.5-5.5S16.5 9 16.5 9s-3 5.5-7.5 5.5S1.5 9 1.5 9z" stroke="#6B7280" strokeWidth="1.3"/><circle cx="9" cy="9" r="2" stroke="#6B7280" strokeWidth="1.3"/></>}</svg>
              </button>
            </div>

            <button className="rg-btn" onClick={() => {
              if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
              if (password !== pwConfirm) return setError("Les mots de passe ne correspondent pas.");
              next();
            }}>
              Continuer <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9h10M9 4l5 5-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </Card>
      </div>
    );

    /* ── STEP 6 — Photo profil ── */
    if (step === 6) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", paddingTop:"clamp(40px,7vh,70px)", paddingBottom:"clamp(60px,10vh,80px)" }}>
        <Card style={{ position:"relative" }}>
          <BackBtn onClick={back} />
          <ProgressDots step={step} />

          {/* Avatar circle */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <div style={{ position:"relative" }}>
              <div style={{ width:90, height:90, borderRadius:"50%", background:"rgba(34,197,94,.1)", border:"2px solid rgba(34,197,94,.3)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                {photo
                  ? <img src={photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  : <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="16" r="9" stroke="rgba(255,255,255,.25)" strokeWidth="2"/><path d="M4 38c0-8.84 7.16-14 16-14s16 5.16 16 14" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeLinecap="round"/></svg>
                }
              </div>
              <button onClick={() => fileRef.current?.click()} style={{ position:"absolute", bottom:0, right:0, width:28, height:28, borderRadius:"50%", background:"#22C55E", border:"2px solid #000", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="4" stroke="#fff" strokeWidth="1.5"/><path d="M5 2h4M6 2l1-1.5 1 1.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>

          <h2 style={{ margin:"0 0 4px", color:"#fff", fontSize:"clamp(18px,4.5vw,22px)", fontWeight:800, textAlign:"center" }}>Ajoutez une photo<br/>de profil</h2>
          <p style={{ margin:"0 0 18px", color:"#9CA3AF", fontSize:13, textAlign:"center" }}>Une photo de profil vous aidera à vous faire connaître.</p>

          <ErrorBanner msg={error} />

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button className="rg-btn" onClick={() => fileRef.current?.click()}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v9M5 6l4-4 4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 16h12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
              Choisir une photo
            </button>
            <button className="rg-btn-outline" onClick={() => fileRef.current?.click()}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="11" rx="2" stroke="rgba(255,255,255,.7)" strokeWidth="1.4"/><circle cx="9" cy="9.5" r="2.5" stroke="rgba(255,255,255,.7)" strokeWidth="1.4"/><path d="M5 4V3.5a.5.5 0 011 0V4" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Prendre une photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handlePhoto}/>
          </div>

          <button onClick={() => { next(); handleSubmit(); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#6B7280", fontSize:13, fontWeight:500, marginTop:14, fontFamily:"inherit", width:"100%", textAlign:"center" }}>
            Ignorer pour plus tard
          </button>
        </Card>
      </div>
    );

    /* ── STEP 7 — Bienvenue ── */
    if (step === 7) return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", paddingTop:"clamp(30px,5vh,60px)", paddingBottom:"clamp(60px,10vh,80px)" }}>
        {showConfetti && <Confetti/>}
        <Card style={{ position:"relative", textAlign:"center" }}>
          {/* Success check */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(34,197,94,.12)", border:"2px solid rgba(34,197,94,.35)", display:"flex", alignItems:"center", justifyContent:"center", animation:"checkPop .6s cubic-bezier(.34,1.56,.64,1) forwards", boxShadow:"0 0 32px rgba(34,197,94,.25)" }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M8 18l6.5 7L28 10" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          <div style={{ fontSize:12, fontWeight:700, color:"#22C55E", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>✓ Compte créé avec succès</div>

          <div style={{ marginBottom:6 }}>
            <img src="/logo.png" alt="" style={{ width:48, height:48, objectFit:"contain", filter:"drop-shadow(0 0 12px rgba(34,197,94,.5))" }}/>
          </div>

          <h2 style={{ margin:"0 0 8px", color:"#fff", fontSize:"clamp(20px,5vw,26px)", fontWeight:900 }}>
            Bienvenue sur <span style={{ color:"#22C55E" }}>BrutePawa</span> !
          </h2>
          <p style={{ margin:"0 0 18px", color:"#9CA3AF", fontSize:13, lineHeight:1.6 }}>
            Votre compte est prêt. Connectez-vous, développez votre réseau, partagez vos idées et créez des opportunités partout dans le monde.
          </p>

          {/* Benefits */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
            {BENEFITS.map((b,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"rgba(34,197,94,.06)", border:"1px solid rgba(34,197,94,.12)", borderRadius:12, animation:`fadeInUp .5s ${i*.1+.3}s both` }}>
                <span style={{ fontSize:20 }}>{b.icon}</span>
                <span style={{ fontSize:14, color:"rgba(255,255,255,.85)", fontWeight:500, textAlign:"left" }}>{b.label}</span>
              </div>
            ))}
          </div>

          <button className="rg-btn" onClick={() => navigate("/")} disabled={loading}>
            Commencer maintenant <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9h10M9 4l5 5-5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          {countdown > 0 && (
            <p style={{ marginTop:12, fontSize:12, color:"#6B7280" }}>
              Redirection automatique dans <span style={{ color:"#22C55E", fontWeight:700 }}>{countdown}s</span>
            </p>
          )}
        </Card>
      </div>
    );

    return null;
  };

  return (
    <div style={{
      minHeight:"100dvh", background:"#000",
      display:"flex", flexDirection:"column", alignItems:"center",
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      position:"relative", overflowX:"hidden", overflowY:"auto",
    }}>
      <style>{CSS}</style>
      <RegBackground />
      <div style={{ position:"relative", zIndex:1, width:"100%", display:"flex", flexDirection:"column", alignItems:"center" }}>
        {renderStep()}
      </div>
      {showLang && <LangSheet current={lang} onSelect={setLang} onClose={() => setShowLang(false)} regionFlag={regionFlag} regionName={regionName}/>}
    </div>
  );
}
