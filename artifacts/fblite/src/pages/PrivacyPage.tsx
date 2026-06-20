import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", primaryDark:"#16A34A", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)" };

type Privacy = "Amis"|"Tout le monde"|"Moi uniquement"|"Amis uniquement";

function PrivacyRow({ label, value, onPress, last=false }:{label:string;value:string;onPress:()=>void;last?:boolean}) {
  return (
    <button onClick={onPress} style={{ display:"flex", alignItems:"center", padding:"14px 16px", background:"none", border:"none", cursor:"pointer", width:"100%", textAlign:"left", borderBottom:last?"none":`1px solid ${C.border}`, transition:"background .12s" }}>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:500, fontSize:15, color:C.text }}>{label}</div>
        <div style={{ fontSize:13, color:C.secondary, marginTop:2 }}>{value}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#C4C9D4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

function PrivacySheet({ label, current, options, onSelect, onClose }:{label:string;current:string;options:Privacy[];onSelect:(v:Privacy)=>void;onClose:()=>void}) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      <div onClick={onClose} style={{ flex:1, background:"rgba(0,0,0,0.4)" }}/>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"8px 0 32px" }}>
        <div style={{ width:40, height:4, borderRadius:2, background:"#E5E7EB", margin:"12px auto 16px" }}/>
        <div style={{ padding:"0 20px 16px", fontWeight:700, fontSize:16, color:C.text }}>{label}</div>
        {options.map(o => (
          <button key={o} onClick={()=>{onSelect(o);onClose();}} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", width:"100%", background:"none", border:"none", cursor:"pointer", borderTop:`1px solid ${C.border}` }}>
            <span style={{ fontSize:15, color:C.text, fontWeight:current===o?700:400 }}>{o}</span>
            {current===o && <svg width="20" height="20" viewBox="0 0 24 24" fill={C.primary}><path d="M20 6L9 17l-5-5" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round"/></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Privacy>("Amis");
  const [messages, setMessages] = useState<Privacy>("Amis");
  const [findMe, setFindMe] = useState<Privacy>("Tout le monde");
  const [friendList, setFriendList] = useState<Privacy>("Amis uniquement");
  const [sheet, setSheet] = useState<null|{label:string;current:Privacy;options:Privacy[];onSelect:(v:Privacy)=>void}>(null);

  const allOptions:Privacy[] = ["Tout le monde","Amis","Amis uniquement","Moi uniquement"];

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Confidentialité</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      <div style={{ padding:"20px 12px" }}>
        {/* Shield illustration */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
          <div style={{ width:96, height:96, borderRadius:"50%", background:"#DCFCE7", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 0 12px #F0FDF4" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" fill="#22C55E" opacity=".2"/>
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" stroke="#22C55E" strokeWidth="1.8" fill="none"/>
              <path d="M9 12l2 2 4-4" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Main privacy card */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden", marginBottom:12 }}>
          <PrivacyRow label="Qui peut voir mes publications" value={posts} onPress={()=>setSheet({label:"Qui peut voir mes publications",current:posts,options:allOptions,onSelect:setPosts})}/>
          <PrivacyRow label="Qui peut m'envoyer des messages" value={messages} onPress={()=>setSheet({label:"Qui peut m'envoyer des messages",current:messages,options:allOptions,onSelect:setMessages})}/>
          <PrivacyRow label="Qui peut me trouver" value={findMe} onPress={()=>setSheet({label:"Qui peut me trouver",current:findMe,options:allOptions,onSelect:setFindMe})}/>
          <PrivacyRow label="Qui peut voir ma liste d'amis" value={friendList} onPress={()=>setSheet({label:"Qui peut voir ma liste d'amis",current:friendList,options:allOptions,onSelect:setFriendList})}/>
          <PrivacyRow label="Bloqués" value="12 utilisateurs" onPress={()=>{}} last/>
        </div>

        {/* Advanced privacy green card */}
        <div style={{ background:C.primary, borderRadius:20, padding:"16px", display:"flex", alignItems:"center", gap:16, boxShadow:"0 4px 16px rgba(34,197,94,0.25)" }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:"#fff" }}>Confidentialité avancée</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.85)", marginTop:2 }}>Protégez votre compte</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginLeft:"auto", flexShrink:0 }}>
            <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {sheet && <PrivacySheet {...sheet} onClose={()=>setSheet(null)}/>}
    </div>
  );
}
