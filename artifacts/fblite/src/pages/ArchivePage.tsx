import { useState } from "react";
import { useNavigate } from "../router";

type Tab = "stories" | "publications" | "corbeille" | "filtres";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A", text:"#111827", secondary:"#64748B", border:"#E5E7EB", danger:"#EF4444", shadow:"0 1px 4px rgba(0,0,0,0.08)" };

function SubHeader({ title, onBack }:{title:string; onBack:()=>void}) {
  return (
    <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px 0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
      <button onClick={onBack} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
      </button>
      <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>{title}</h1>
      <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
      </button>
    </div>
  );
}

export default function ArchivePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("publications");
  const [selected, setSelected] = useState<number[]>([]);
  const TABS: { id:Tab; label:string; icon?:React.ReactNode }[] = [
    { id:"stories", label:"Stories", icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity=".3"/></svg> },
    { id:"publications", label:"Publications", icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 3a4 4 0 110 8 4 4 0 010-8zm0 10c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z"/></svg> },
    { id:"corbeille", label:"Corbeille", icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> },
    { id:"filtres", label:"Filtres", icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="18" x2="12" y2="18"/></svg> },
  ];

  const isEmpty = true; // No archived items

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif", display:"flex", flexDirection:"column" }}>
      <SubHeader title="Archive" onBack={()=>navigate("/settings")}/>

      {/* Banner card */}
      <div style={{ margin:"12px 12px 0", background:C.primary, borderRadius:20, padding:"16px", display:"flex", alignItems:"center", gap:16, boxShadow:"0 4px 16px rgba(34,197,94,0.25)" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:15, color:"#fff", lineHeight:1.3, marginBottom:4 }}>Conservez ce qui compte pour vous</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.5 }}>Archivez ou restaurez vos publications à tout moment.</div>
        </div>
        {/* Folder illustration */}
        <div style={{ flexShrink:0 }}>
          <svg width="64" height="64" viewBox="0 0 80 80" fill="none">
            <rect x="4" y="24" width="72" height="48" rx="8" fill="#16A34A"/>
            <rect x="4" y="20" width="36" height="12" rx="6" fill="#15803D"/>
            <rect x="8" y="30" width="64" height="40" rx="6" fill="#22C55E"/>
            <rect x="16" y="38" width="48" height="6" rx="3" fill="rgba(255,255,255,0.4)"/>
            <rect x="16" y="48" width="36" height="6" rx="3" fill="rgba(255,255,255,0.3)"/>
            <rect x="16" y="58" width="24" height="6" rx="3" fill="rgba(255,255,255,0.2)"/>
            {/* Star */}
            <circle cx="60" cy="22" r="10" fill="#F4C542"/>
            <path d="M60 15l1.8 3.6L65 19.4l-2.5 2.4.6 3.4L60 23.5l-3.1 1.7.6-3.4-2.5-2.4 3.2-.8L60 15z" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ margin:"12px 12px 0", background:C.card, borderRadius:20, boxShadow:C.shadow, display:"flex", overflow:"hidden" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1, padding:"12px 4px", background:"none", border:"none", cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            borderBottom: tab===t.id ? `3px solid ${C.primary}` : "3px solid transparent",
            color: tab===t.id ? C.primary : C.secondary,
            fontWeight: tab===t.id ? 700 : 500,
            fontSize:12, transition:"all 0.15s",
          }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 24px" }}>
        {isEmpty ? (
          <>
            {/* Empty state illustration */}
            <div style={{ marginBottom:24 }}>
              <svg width="160" height="160" viewBox="0 0 200 200" fill="none">
                {/* Background circle */}
                <circle cx="100" cy="100" r="80" fill="#F0FDF4" opacity=".8"/>
                {/* Main folder */}
                <rect x="30" y="70" width="140" height="96" rx="14" fill="#DCFCE7"/>
                <rect x="30" y="60" width="70" height="24" rx="12" fill="#BBF7D0"/>
                <rect x="36" y="78" width="128" height="82" rx="10" fill="#22C55E" opacity=".9"/>
                {/* Files in folder */}
                <rect x="50" y="88" width="100" height="12" rx="6" fill="rgba(255,255,255,0.6)"/>
                <rect x="50" y="106" width="76" height="12" rx="6" fill="rgba(255,255,255,0.4)"/>
                <rect x="50" y="124" width="52" height="12" rx="6" fill="rgba(255,255,255,0.3)"/>
                {/* Floating elements */}
                <rect x="130" y="40" width="32" height="40" rx="8" fill="#BBF7D0" transform="rotate(12 130 40)"/>
                <rect x="34" y="38" width="28" height="36" rx="7" fill="#A7F3D0" transform="rotate(-10 34 38)"/>
                {/* Photo card */}
                <rect x="64" y="48" width="72" height="52" rx="10" fill="white" opacity=".95"/>
                <rect x="68" y="52" width="64" height="36" rx="6" fill="#A7F3D0"/>
                <path d="M88 66c0-4 8-4 8 0s8 12 8 12H80s8-8 8-12z" fill="#22C55E" opacity=".7"/>
                <circle cx="82" cy="62" r="4" fill="#22C55E" opacity=".6"/>
                {/* Emoji smile */}
                <circle cx="152" cy="130" r="20" fill="#FEF08A"/>
                <circle cx="145" cy="126" r="2.5" fill="#854D0E"/>
                <circle cx="159" cy="126" r="2.5" fill="#854D0E"/>
                <path d="M145 134c2 4 10 4 14 0" stroke="#854D0E" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div style={{ fontWeight:700, fontSize:17, color:C.text, marginBottom:8, textAlign:"center" }}>Aucun élément archivé</div>
            <div style={{ fontSize:14, color:C.secondary, textAlign:"center", lineHeight:1.6 }}>Vos éléments archivés apparaîtront ici.</div>
          </>
        ) : (
          <div style={{ width:"100%", color:C.secondary, textAlign:"center" }}>Éléments archivés</div>
        )}
      </div>

      {/* Bottom action buttons */}
      <div style={{ padding:"12px 16px", paddingBottom:"calc(12px + env(safe-area-inset-bottom,0px))", display:"flex", gap:12, background:C.card, borderTop:`1px solid ${C.border}` }}>
        <button disabled={selected.length===0} style={{
          flex:1, padding:"13px", borderRadius:14, border:`1.5px solid ${selected.length>0?C.primary:C.border}`,
          background:"none", color:selected.length>0?C.primary:C.border, fontWeight:700, fontSize:15,
          cursor:selected.length>0?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.15s",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
          Restaurer
        </button>
        <button disabled={selected.length===0} style={{
          flex:1, padding:"13px", borderRadius:14, border:`1.5px solid ${selected.length>0?C.danger:C.border}`,
          background:"none", color:selected.length>0?C.danger:C.border, fontWeight:700, fontSize:15,
          cursor:selected.length>0?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.15s",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
          Supprimer
        </button>
      </div>
    </div>
  );
}
