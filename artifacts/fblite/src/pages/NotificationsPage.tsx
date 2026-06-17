import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { apiGetNotifications, apiMarkAllNotificationsRead, type ApiNotification } from "../lib/api";

const BP_GREEN = "#16C24A";

/* ─── Time helper ───────────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60)  return `Il y a ${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `Il y a ${mins} minute${mins > 1 ? "s" : ""}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `Il y a ${hrs} heure${hrs > 1 ? "s" : ""}`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function isToday(d: string) {
  const n = new Date(); const t = new Date(d);
  return t.getDate()===n.getDate() && t.getMonth()===n.getMonth() && t.getFullYear()===n.getFullYear();
}
function isThisWeek(d: string) {
  return Date.now() - new Date(d).getTime() < 7*24*3600*1000;
}

/* ─── Notification type → category / badge ─────────────────── */
type Cat = "toutes" | "sociales" | "marketplace" | "emplois" | "formations" | "portefeuille";
type Filter = "recentes" | "aujourd" | "semaine" | "nonlues";

const CAT_TYPES: Record<Cat, string[]> = {
  toutes:       [],
  sociales:     ["like","love","haha","wow","sad","angry","comment","friend","message"],
  marketplace:  ["marketplace","listing","product","sale"],
  emplois:      ["job","emploi","recrutement"],
  formations:   ["training","formation","cours","certification"],
  portefeuille: ["tontine","deposit","wallet","transfer","payment"],
};

/* ─── Badge SVG icons (no emoji) ───────────────────────────── */
const BadgeIcon = ({ type }: { type: string }) => {
  const cfg: Record<string, { bg: string; icon: JSX.Element }> = {
    like:        { bg: "#1877F2", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m7-10 2 4h6l-2 6H9V8l5-6z"/></svg> },
    love:        { bg: "#E91E63", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
    comment:     { bg: "#1877F2", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    message:     { bg: "#00BCD4", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6" fill="none" stroke="#00BCD4" strokeWidth="1.5"/></svg> },
    friend:      { bg: BP_GREEN, icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    job:         { bg: "#FF9800", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
    emploi:      { bg: "#FF9800", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
    tontine:     { bg: BP_GREEN, icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
    deposit:     { bg: BP_GREEN, icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
    verify:      { bg: BP_GREEN, icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> },
    marketplace: { bg: "#6366F1", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
    system:      { bg: "#F97316", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
    formation:   { bg: "#8B5CF6", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
  };
  const def = { bg: "#94A3B8", icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="#fff"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> };
  const c = cfg[type] ?? def;
  return (
    <div style={{ position:"absolute", bottom:-2, right:-2, width:22, height:22, borderRadius:"50%", background:c.bg, border:"2.5px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
      {c.icon}
    </div>
  );
};

/* ─── Avatar ────────────────────────────────────────────────── */
const AV_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00",BP_GREEN,"#0EA5E9","#D32F2F","#00838F"];
function avBg(name: string|null) {
  if (!name) return AV_COLORS[0];
  let h=0; for (let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff;
  return AV_COLORS[h%AV_COLORS.length];
}
function avInitials(name: string|null) {
  if (!name) return "?";
  const p=name.trim().split(" ");
  return p.length>=2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}

/* ─── System actors (for system notif avatars) ──────────────── */
const SYSTEM_ACTORS: Record<string, { label: string; bg: string; abbr: string }> = {
  system:      { label:"BrutePawa",        bg: BP_GREEN,  abbr:"BP" },
  verify:      { label:"BrutePawa",        bg: BP_GREEN,  abbr:"BP" },
  job:         { label:"BrutePawa Emplois",bg:"#FF9800",  abbr:"JB" },
  emploi:      { label:"BrutePawa Emplois",bg:"#FF9800",  abbr:"JB" },
  formation:   { label:"BrutePawa Learn",  bg:"#8B5CF6",  abbr:"FL" },
  tontine:     { label:"Portefeuille",     bg: BP_GREEN,  abbr:"PF" },
  deposit:     { label:"Portefeuille",     bg: BP_GREEN,  abbr:"PF" },
  marketplace: { label:"Marketplace",      bg:"#6366F1",  abbr:"MP" },
};

/* ─── Suggestions data ──────────────────────────────────────── */
const SUGGESTIONS = [
  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, title:"Rejoindre des groupes", desc:"Découvrez des communautés qui vous intéressent", path:"/groups" },
  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>, title:"Explorer le Marketplace", desc:"Des milliers d'articles vous attendent", path:"/marketplace" },
  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>, title:"Suivre une formation", desc:"Développez vos compétences avec BrutePawa", path:"/training" },
  { icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 2v4M16 2v4M2 10h20"/><circle cx="12" cy="15" r="2"/></svg>, title:"Inviter des amis", desc:"Plus vous invitez, plus vous gagnez", path:"/friends" },
];

/* ─── Activities data ──────────────────────────────────────────*/
const ACTIVITIES = [
  { icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>, bg:BP_GREEN, title:"Compte vérifié", desc:"Félicitations ! Votre compte est désormais vérifié." },
  { icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, bg:"#F97316", title:"Annonce populaire", desc:"Votre annonce a reçu 25 vues aujourd'hui." },
  { icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>, bg:"#10B981", title:"Dépôt reçu", desc:"Vous avez reçu un dépôt de 25 000 FCFA." },
  { icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>, bg:"#8B5CF6", title:"Nouvelle formation", desc:"« Marketing Digital » est maintenant disponible." },
];

/* ─── Main page ─────────────────────────────────────────────── */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs]     = useState<ApiNotification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cat, setCat]           = useState<Cat>("toutes");
  const [filter, setFilter]     = useState<Filter>("recentes");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch]         = useState("");

  useEffect(() => {
    apiGetNotifications()
      .then(setNotifs).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const markAllRead = async () => {
    setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
    await apiMarkAllNotificationsRead().catch(()=>{});
  };

  const markRead = (id: number, link?: string|null) => {
    setNotifs(ns => ns.map(n => n.id===id ? { ...n, isRead:true } : n));
    if (link) navigate(link);
  };

  /* ── filtering ── */
  const filtered = notifs.filter(n => {
    if (cat !== "toutes" && CAT_TYPES[cat].length > 0 && !CAT_TYPES[cat].includes(n.type)) return false;
    if (filter === "aujourd") { if (!isToday(n.createdAt)) return false; }
    else if (filter === "semaine") { if (!isThisWeek(n.createdAt)) return false; }
    else if (filter === "nonlues") { if (n.isRead) return false; }
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${n.actorName ?? ""} ${n.action} ${n.detail ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  /* ── category counts ── */
  const countCat = (c: Cat) => {
    if (c === "toutes") return notifs.filter(n=>!n.isRead).length;
    return notifs.filter(n => !n.isRead && (CAT_TYPES[c].length===0 || CAT_TYPES[c].includes(n.type))).length;
  };

  const CATS: { id: Cat; label: string }[] = [
    { id:"toutes",       label:"Toutes"      },
    { id:"sociales",     label:"Sociales"    },
    { id:"marketplace",  label:"Marketplace" },
    { id:"emplois",      label:"Emplois"     },
    { id:"formations",   label:"Formations"  },
    { id:"portefeuille", label:"Portefeuille"},
  ];

  const FILTERS: { id: Filter; label: string }[] = [
    { id:"recentes", label:"Récentes"     },
    { id:"aujourd",  label:"Aujourd'hui"  },
    { id:"semaine",  label:"Cette semaine"},
    { id:"nonlues",  label:"Non lues"     },
  ];

  const unread = filtered.filter(n => !n.isRead);
  const read   = filtered.filter(n =>  n.isRead);

  /* ─── Notif card ─────────────────────────────────────────── */
  function NotifCard({ notif }: { notif: ApiNotification }) {
    const sys = SYSTEM_ACTORS[notif.type];
    const isSystem = !!sys && !notif.actorName;
    const name = isSystem ? sys.label : (notif.actorName ?? "Système");
    const bg   = isSystem ? sys.bg : avBg(notif.actorName);
    const abbr = isSystem ? sys.abbr : avInitials(notif.actorName);

    return (
      <div
        onClick={() => markRead(notif.id, notif.link)}
        style={{
          display:"flex", alignItems:"center", gap:12, padding:"13px 16px",
          background: notif.isRead ? "#fff" : `${BP_GREEN}08`,
          borderBottom:"1px solid #F8FAFC", cursor:"pointer",
          transition:"background .15s",
        }}
      >
        {/* Avatar + badge */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <div style={{ width:52, height:52, borderRadius:"50%", background:bg, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", border: notif.isRead ? "none" : `2px solid ${BP_GREEN}` }}>
            {notif.actorAvatarUrl
              ? <img src={notif.actorAvatarUrl} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <span style={{ color:"#fff", fontWeight:800, fontSize:17 }}>{abbr}</span>
            }
          </div>
          <BadgeIcon type={notif.type} />
        </div>

        {/* Text */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, lineHeight:1.45, color:"#0F172A" }}>
            <strong>{name}</strong>{" "}
            <span style={{ fontWeight:400, color:"#334155" }}>{notif.action}</span>
            {notif.detail && (
              <span style={{ color:"#64748B", fontWeight:400 }}> «{notif.detail}»</span>
            )}
          </div>
          <div style={{ marginTop:3, fontSize:12.5, color: notif.isRead ? "#94A3B8" : BP_GREEN, fontWeight: notif.isRead ? 400 : 700 }}>
            {timeAgo(notif.createdAt)}
          </div>
        </div>

        {/* Right side: unread dot + chevron */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0 }}>
          {!notif.isRead && (
            <div style={{ width:10, height:10, borderRadius:"50%", background:BP_GREEN }} />
          )}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    );
  }

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div style={{ background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto" }}>

      {/* ══ 1. HEADER ══════════════════════════════════════ */}
      <div style={{ background:"#fff", borderBottom:"1px solid #F1F5F9", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
        <button onClick={() => window.history.back()} style={{ width:36, height:36, borderRadius:"50%", background:"#F1F5F9", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#475569", flexShrink:0 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>

        <div style={{ flex:1, fontWeight:800, fontSize:19, color:"#0F172A" }}>Notifications</div>

        {/* Search toggle */}
        <button onClick={()=>{ setSearchOpen(o=>!o); setSearch(""); }} style={{ width:36, height:36, borderRadius:"50%", background: searchOpen ? BP_GREEN : "#F1F5F9", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color: searchOpen ? "#fff" : "#475569", transition:"all .2s" }}>
          {searchOpen
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          }
        </button>

        {/* Mark all read pill */}
        <button onClick={markAllRead} style={{ display:"flex", alignItems:"center", gap:6, background:"#F1F5F9", border:"1.5px solid #E2E8F0", borderRadius:20, padding:"6px 12px", cursor:"pointer", fontWeight:700, fontSize:12, color:"#475569", whiteSpace:"nowrap" }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={BP_GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Tout marquer comme lu
        </button>
      </div>

      {/* ══ 1b. SEARCH BAR (visible only when open) ═══════ */}
      {searchOpen && (
        <div style={{ background:"#fff", padding:"8px 14px 10px", borderBottom:"1px solid #F1F5F9" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#F8FAFC", border:`1.5px solid ${BP_GREEN}`, borderRadius:14, padding:"10px 14px" }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans les notifications…"
              style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:14, color:"#0F172A", fontFamily:"inherit" }}
            />
            {search && (
              <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", color:"#94A3B8" }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {search && (
            <div style={{ marginTop:6, fontSize:12, color:"#94A3B8", paddingLeft:4 }}>
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""} pour « {search} »
            </div>
          )}
        </div>
      )}

      {/* ══ 2. CATEGORY TABS ═══════════════════════════════ */}
      <div style={{ background:"#fff", borderBottom:"1px solid #F1F5F9", overflow:"auto", scrollbarWidth:"none" }}>
        <div style={{ display:"flex", padding:"0 12px", minWidth:"max-content" }}>
          {CATS.map(c => {
            const cnt = countCat(c.id);
            const active = cat === c.id;
            return (
              <button key={c.id} onClick={()=>setCat(c.id)} style={{ flex:"0 0 auto", padding:"12px 14px 10px", border:"none", background:"none", cursor:"pointer", fontWeight: active ? 700 : 500, fontSize:13.5, color: active ? BP_GREEN : "#64748B", borderBottom: active ? `2.5px solid ${BP_GREEN}` : "2.5px solid transparent", position:"relative", display:"flex", alignItems:"center", gap:5, transition:"color .15s" }}>
                {c.label}
                {cnt > 0 && (
                  <span style={{ background: active ? BP_GREEN : "#E2E8F0", color: active ? "#fff" : "#64748B", borderRadius:20, padding:"1px 7px", fontSize:11, fontWeight:700 }}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ 3. FILTER PILLS ════════════════════════════════ */}
      <div style={{ padding:"12px 16px 8px", display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none" }}>
        {FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{ flex:"0 0 auto", padding:"7px 14px", borderRadius:999, border:`1.5px solid ${active ? BP_GREEN : "#E2E8F0"}`, background: active ? BP_GREEN : "#fff", color: active ? "#fff" : "#475569", fontSize:13, fontWeight: active ? 700 : 500, cursor:"pointer", transition:"all .15s", display:"flex", alignItems:"center", gap:6 }}>
              {f.id === "nonlues" && (
                <span style={{ width:7, height:7, borderRadius:"50%", background: active ? "#fff" : BP_GREEN, display:"inline-block" }} />
              )}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ══ 4. LOADING ═════════════════════════════════════ */}
      {loading && (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ width:32, height:32, border:`3px solid #E2E8F0`, borderTopColor:BP_GREEN, borderRadius:"50%", animation:"bp-spin .7s linear infinite", margin:"0 auto 12px" }} />
          <div style={{ color:"#94A3B8", fontSize:14 }}>Chargement des notifications…</div>
          <style>{`@keyframes bp-spin { to { transform:rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ══ 5. EMPTY ════════════════════════════════════════ */}
      {!loading && filtered.length === 0 && (
        <div style={{ background:"#fff", borderRadius:20, margin:"12px", padding:"48px 20px", textAlign:"center", boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ width:64, height:64, borderRadius:20, background:`${BP_GREEN}15`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={BP_GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <div style={{ fontWeight:700, fontSize:16, color:"#0F172A", marginBottom:6 }}>Aucune notification</div>
          <div style={{ fontSize:13.5, color:"#94A3B8" }}>Vous êtes à jour !</div>
        </div>
      )}

      {/* ══ 6. NOTIFICATIONS LIST ══════════════════════════ */}
      {!loading && filtered.length > 0 && (
        <div style={{ background:"#fff", borderRadius:20, margin:"8px 12px 0", overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
          {/* Unread section */}
          {unread.length > 0 && (
            <>
              <div style={{ padding:"12px 16px 8px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontWeight:700, fontSize:14, color:"#0F172A" }}>Nouveau</span>
                <span style={{ fontSize:12, color:"#94A3B8" }}>{unread.length} non lu{unread.length>1?"s":""}</span>
              </div>
              {unread.map(n => <NotifCard key={n.id} notif={n} />)}
            </>
          )}
          {/* Read section */}
          {read.length > 0 && (
            <>
              <div style={{ padding:"12px 16px 8px", borderTop: unread.length > 0 ? "4px solid #F8FAFC" : "none" }}>
                <span style={{ fontWeight:700, fontSize:14, color:"#0F172A" }}>Plus tôt</span>
              </div>
              {read.map(n => <NotifCard key={n.id} notif={n} />)}
            </>
          )}
        </div>
      )}

      {/* ══ 7. SUGGESTIONS BRUTEPAWA ═══════════════════════ */}
      <div style={{ margin:"14px 12px 0", background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <span style={{ fontWeight:700, fontSize:15, color:BP_GREEN }}>Suggestions BrutePawa</span>
          <button style={{ background:"none", border:"none", color:BP_GREEN, fontWeight:700, fontSize:12.5, cursor:"pointer" }}>Voir tout</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => navigate(s.path)} style={{ background:"#F8FAFC", border:"1.5px solid #F1F5F9", borderRadius:16, padding:"14px 12px", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:8, transition:"box-shadow .15s" }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`${BP_GREEN}15`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:12.5, color:"#0F172A", marginBottom:2, lineHeight:1.3 }}>{s.title}</div>
                <div style={{ fontSize:11, color:"#94A3B8", lineHeight:1.4 }}>{s.desc}</div>
              </div>
              <div style={{ width:28, height:28, borderRadius:"50%", background:`${BP_GREEN}15`, display:"flex", alignItems:"center", justifyContent:"center", alignSelf:"flex-end" }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={BP_GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ══ 8. ACTIVITÉS IMPORTANTES ════════════════════════ */}
      <div style={{ margin:"12px 12px 32px", background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <div style={{ width:26, height:26, borderRadius:8, background:`${BP_GREEN}15`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span style={{ fontWeight:700, fontSize:15, color:"#0F172A" }}>Activités importantes</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {ACTIVITIES.map((a, i) => (
            <div key={i} style={{ background:"#F8FAFC", borderRadius:16, padding:"14px 12px", border:"1.5px solid #F1F5F9" }}>
              <div style={{ width:40, height:40, borderRadius:12, background:a.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}>
                {a.icon}
              </div>
              <div style={{ fontWeight:700, fontSize:12.5, color:"#0F172A", marginBottom:3, lineHeight:1.3 }}>{a.title}</div>
              <div style={{ fontSize:11, color:"#94A3B8", lineHeight:1.4 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
