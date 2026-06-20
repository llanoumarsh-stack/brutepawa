import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { apiGetUserStats } from "../lib/api";

/* ─── Design tokens ─── */
const C = {
  bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A",
  text:"#111827", secondary:"#64748B", border:"#E5E7EB",
  danger:"#EF4444", premium:"#F4C542",
  shadow:"0 1px 4px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.05)",
};

/* ─── Reusable setting row ─── */
function Row({ iconBg, icon, title, sub, right, last=false, onClick }:{
  iconBg:string; icon:React.ReactNode; title:string; sub?:string;
  right?:React.ReactNode; last?:boolean; onClick?:()=>void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onTouchStart={()=>setPressed(true)} onTouchEnd={()=>setPressed(false)}
      onMouseDown={()=>setPressed(true)} onMouseUp={()=>setPressed(false)} onMouseLeave={()=>setPressed(false)}
      style={{
        display:"flex", alignItems:"center", gap:14,
        padding:"13px 16px", background: pressed?"#F9FAFB":"none",
        border:"none", cursor:"pointer", width:"100%", textAlign:"left",
        borderBottom: last ? "none" : `1px solid ${C.border}`,
        transition:"background 0.12s",
      }}
    >
      <div style={{ width:42, height:42, borderRadius:"50%", background:iconBg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:15, color:C.text, lineHeight:1.3 }}>{title}</div>
        {sub && <div style={{ fontSize:13, color:C.secondary, marginTop:2 }}>{sub}</div>}
      </div>
      {right}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 18l6-6-6-6" stroke="#C4C9D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

export default function ProfileMenuPage() {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : {};
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "Utilisateur";
  const username = user.username || user.email?.split("@")[0] || "user";
  const userId = user.id ? String(user.id).padStart(8,"0") : "10000123";

  const [_stats, setStats] = useState({ postsCount:0, followersCount:0, followingCount:0 });
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem("bp_data_saver") !== "false");
  const unreadNotifs = 3;

  useEffect(() => {
    apiGetUserStats().then((s:any) => { if(s) setStats(s); }).catch(()=>{});
  },[]);

  const usedGB = 1.24, totalGB = 10;
  const storagePct = Math.round((usedGB/totalGB)*100);

  const LockIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><rect x="5" y="11" width="14" height="10" rx="2" fill="#fff" fillOpacity=".9"/><path d="M8 11V7a4 4 0 018 0v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none"/><circle cx="12" cy="16" r="1.5" fill="#22C55E"/></svg>;
  const BellIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>;
  const GlobeIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>;
  const DataIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><rect x="2" y="10" width="4" height="10" rx="1"/><rect x="7" y="6" width="4" height="14" rx="1"/><rect x="12" y="2" width="4" height="18" rx="1"/><rect x="17" y="7" width="4" height="13" rx="1"/></svg>;
  const SunIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="4" fill="#fff"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  const ShieldIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  const BadgeIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#fff" strokeWidth="1.6"/></svg>;
  const CrownIcon = <svg width="24" height="24" viewBox="0 0 24 24" fill="#F4C542"><path d="M2 20h20v2H2v-2zM4.5 16l-2-8 5 4L12 4l4.5 8 5-4-2 8H4.5z"/></svg>;
  const StorageIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>;

  const Toggle = ({ on }:{on:boolean}) => (
    <div onClick={e=>{e.stopPropagation();setDataSaver(v=>{localStorage.setItem("bp_data_saver",String(!v));return !v;})}}
      style={{ width:44, height:26, borderRadius:13, background:on?C.primary:"#E5E7EB", position:"relative", cursor:"pointer", transition:"background .2s", flexShrink:0, marginRight:4 }}>
      <div style={{ position:"absolute", top:3, left:on?"calc(100% - 23px)":3, width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.2)", transition:"left .2s" }}/>
    </div>
  );

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>

      {/* ─── Green header ─── */}
      <div style={{ background:C.primary, padding:"env(safe-area-inset-top,0px) 16px 20px", paddingTop:"calc(env(safe-area-inset-top,0px) + 14px)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
            <svg width="24" height="24" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#22C55E"/><text x="20" y="28" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold" fontFamily="Arial">b</text></svg>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:"#fff", lineHeight:1.2 }}>BrutePawa</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.85)" }}>Réseau social panafricain</div>
          </div>
        </div>
        <button style={{ background:"rgba(255,255,255,0.2)", border:"none", cursor:"pointer", position:"relative", padding:8, borderRadius:"50%" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {unreadNotifs>0 && <span style={{ position:"absolute", top:4, right:4, background:C.danger, color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", border:"1.5px solid #22C55E" }}>{unreadNotifs}</span>}
        </button>
      </div>

      {/* ─── Scroll body ─── */}
      <div style={{ padding:"12px 0 90px" }}>

        {/* User card */}
        <div style={{ margin:"0 12px 10px", background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
          <button onClick={()=>navigate("/profile")} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px", background:"none", border:"none", cursor:"pointer", width:"100%", textAlign:"left" }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width:70, height:70, borderRadius:"50%", objectFit:"cover", border:"3px solid #DCFCE7" }}/>
                : <div style={{ width:70, height:70, borderRadius:"50%", background:C.primary, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:28, fontWeight:700, color:"#fff" }}>{name.slice(0,1).toUpperCase()}</span>
                  </div>
              }
              <div style={{ position:"absolute", bottom:1, right:1, width:22, height:22, borderRadius:"50%", background:"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #fff", boxShadow:"0 1px 4px rgba(59,130,246,0.4)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                <span style={{ fontWeight:700, fontSize:17, color:C.text }}>{name}</span>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="#3B82F6"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#3B82F6" strokeWidth="0.5"/></svg>
              </div>
              <div style={{ fontSize:13, color:C.secondary, marginTop:1 }}>@{username}</div>
              <div style={{ fontSize:12, color:C.secondary, marginTop:1 }}>ID : {userId}</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="#C4C9D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Main settings card */}
        <div style={{ margin:"0 12px 10px", background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
          <Row iconBg="#22C55E" icon={LockIcon} title="Confidentialité" sub="Gérer qui voit vos informations" onClick={()=>navigate("/settings/privacy")}/>
          <Row iconBg="#F59E0B" icon={BellIcon} title="Notifications" sub="Personnaliser vos alertes" onClick={()=>navigate("/settings/notifications")}
            right={<div style={{ width:9, height:9, borderRadius:"50%", background:C.danger, marginRight:6 }}/>}/>
          <Row iconBg="#06B6D4" icon={GlobeIcon} title="Langue & région" sub="Français • ML" onClick={()=>navigate("/settings/language")}/>
          <Row iconBg="#22C55E" icon={DataIcon} title="Mode données" sub={`Économiseur : ${dataSaver?"Activé":"Désactivé"}`} onClick={()=>navigate("/settings/data")} right={<Toggle on={dataSaver}/>}/>
          <Row iconBg="#F59E0B" icon={SunIcon} title="Apparence" sub="Thème clair" onClick={()=>navigate("/settings/appearance")}/>
          <Row iconBg="#3B82F6" icon={ShieldIcon} title="Vérification du compte" sub="Ajouter votre numéro de téléphone" onClick={()=>navigate("/settings/verify")} last/>
        </div>

        {/* Badge vérifié card */}
        <div style={{ margin:"0 12px 10px", background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
          <Row iconBg="#3B82F6" icon={BadgeIcon} title="Badge vérifié" sub="Vérification identité • 2 500 FCFA" onClick={()=>navigate("/settings/badge")} last
            right={<span style={{ background:"#DCFCE7", color:C.primaryDark, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, marginRight:4, whiteSpace:"nowrap" }}>Vérifié</span>}/>
        </div>

        {/* Premium card — dark green */}
        <div style={{ margin:"0 12px 10px", background:"#064E3B", borderRadius:20, overflow:"hidden", boxShadow:"0 4px 20px rgba(6,78,59,0.35)" }}>
          <button onClick={()=>navigate("/settings/premium")} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px", background:"none", border:"none", cursor:"pointer", width:"100%", textAlign:"left" }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(244,197,66,0.18)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {CrownIcon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:15, color:"#fff" }}>Compte Premium</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", marginTop:2 }}>Profitez de toutes les fonctionnalités</div>
            </div>
            <span style={{ background:C.premium, color:"#1C1917", fontSize:11, fontWeight:800, padding:"5px 10px", borderRadius:20, whiteSpace:"nowrap", flexShrink:0 }}>2 500 FCFA/mois</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.5)" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Storage card */}
        <div style={{ margin:"0 12px 10px", background:C.card, borderRadius:20, boxShadow:C.shadow }}>
          <div style={{ padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:10 }}>
              <div style={{ width:42, height:42, borderRadius:"50%", background:"#DCFCE7", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {StorageIcon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:15, color:C.text }}>Espace de stockage</div>
                <div style={{ fontSize:13, color:C.secondary, marginTop:2 }}>{usedGB} Go / {totalGB} Go utilisés</div>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:C.primary }}>{storagePct}%</span>
            </div>
            <div style={{ height:7, background:"#E5E7EB", borderRadius:999, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${storagePct}%`, background:`linear-gradient(90deg,#22C55E,#16A34A)`, borderRadius:999 }}/>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign:"center", padding:"20px 0 4px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:4 }}>
            <svg width="20" height="20" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#22C55E"/><text x="20" y="28" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="Arial">b</text></svg>
            <span style={{ fontWeight:800, fontSize:15, color:C.text }}>BrutePawa</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#3B82F6" strokeWidth="0.5"/></svg>
          </div>
          <div style={{ fontSize:12, color:C.secondary }}>🌍 Connecter • Partager • Gagner</div>
          <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>Réseau social panafricain</div>
          <div style={{ fontSize:10, color:"#CBD5E1", marginTop:8 }}>Version 2.0.0 • © 2026 BrutePawa</div>
        </div>
      </div>
    </div>
  );
}
