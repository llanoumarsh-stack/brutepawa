import { useState } from "react";
import { useNavigate } from "../router";

const C = { bg:"#F8FAFC", card:"#FFFFFF", primary:"#22C55E", text:"#111827", secondary:"#64748B", border:"#E5E7EB", shadow:"0 1px 4px rgba(0,0,0,0.08)" };

function Toggle({ on, onChange }:{on:boolean;onChange:(v:boolean)=>void}) {
  return (
    <div onClick={()=>onChange(!on)} style={{ width:46, height:26, borderRadius:13, background:on?C.primary:"#E5E7EB", position:"relative", cursor:"pointer", transition:"background .2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:on?"calc(100% - 23px)":3, width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.25)", transition:"left .2s" }}/>
    </div>
  );
}

function NotifRow({ icon, label, sub, on, onChange, last=false }:{icon:React.ReactNode;label:string;sub?:string;on:boolean;onChange:(v:boolean)=>void;last?:boolean}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", borderBottom:last?"none":`1px solid ${C.border}` }}>
      <div style={{ color:C.primary, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:500, fontSize:15, color:C.text }}>{label}</div>
        {sub && <div style={{ fontSize:12, color:C.secondary, marginTop:1 }}>{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange}/>
    </div>
  );
}

export default function NotifSettingsPage() {
  const navigate = useNavigate();
  const [all, setAll] = useState(true);
  const [msgs, setMsgs] = useState(true);
  const [comments, setComments] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [friends, setFriends] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [dnd, setDnd] = useState(false);

  const BellSvg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>;
  const MsgSvg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
  const CommentSvg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>;
  const MentionSvg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></svg>;
  const FriendSvg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="3.5"/><circle cx="17" cy="8" r="2.5"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M19 14c2.5.5 4 2 4 4.5"/></svg>;
  const ReminderSvg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
  const MoonSvg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>;

  return (
    <div style={{ background:C.bg, minHeight:"100dvh", fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${C.border}`, height:56, display:"flex", alignItems:"center", padding:"0 4px", gap:4, position:"sticky", top:0, zIndex:20, boxShadow:C.shadow }}>
        <button onClick={()=>navigate("/settings")} style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1, fontWeight:700, fontSize:17, color:C.text, margin:0 }}>Notifications</h1>
        <button style={{ width:44, height:44, borderRadius:"50%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill={C.secondary}/><circle cx="12" cy="12" r="1.5" fill={C.secondary}/><circle cx="12" cy="19" r="1.5" fill={C.secondary}/></svg>
        </button>
      </div>

      <div style={{ padding:"20px 12px" }}>
        {/* Bell illustration */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
          <div style={{ width:100, height:100, borderRadius:"50%", background:"#FEF9C3", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 0 12px #FEFCE8" }}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" fill="#F59E0B" opacity=".2"/>
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="18" cy="5" r="4" fill="#EF4444"/>
              <text x="18" y="8" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">3</text>
            </svg>
          </div>
        </div>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:18, color:C.text, marginBottom:4 }}>Personnalisez vos alertes</div>
          <div style={{ fontSize:14, color:C.secondary }}>Choisissez ce que vous voulez recevoir.</div>
        </div>

        {/* Toggles card */}
        <div style={{ background:C.card, borderRadius:20, boxShadow:C.shadow, overflow:"hidden" }}>
          <NotifRow icon={BellSvg} label="Toutes les notifications" on={all} onChange={setAll}/>
          <NotifRow icon={MsgSvg} label="Messages" on={msgs} onChange={setMsgs}/>
          <NotifRow icon={CommentSvg} label="Commentaires" on={comments} onChange={setComments}/>
          <NotifRow icon={MentionSvg} label="Mentions" on={mentions} onChange={setMentions}/>
          <NotifRow icon={FriendSvg} label="Amis" on={friends} onChange={setFriends}/>
          <NotifRow icon={ReminderSvg} label="Rappels" on={reminders} onChange={setReminders}/>
          <NotifRow icon={MoonSvg} label="Ne pas déranger" sub={dnd ? "22:00 – 07:00" : undefined} on={dnd} onChange={setDnd} last/>
        </div>
      </div>
    </div>
  );
}
