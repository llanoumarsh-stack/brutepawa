import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import {
  apiGetPages, apiCreatePage, apiGetPage, apiUpdatePage, apiDeletePage,
  apiFollowPage, apiUnfollowPage, apiGetPageRoles, apiAddPageRole, apiRemovePageRole,
  apiInviteFriendsToPage, apiGetPageStats, apiGetPageFriendSuggestions,
  apiAcceptPageInvitation, apiDeclinePageInvitation,
  type ApiPage, type ApiPageRole, type ApiPageStats, type ApiPageInvitation,
} from "../lib/api";
import { toast } from "sonner";

const G = "#22C55E";
const GD = "#16A34A";

const CATEGORIES = ["Réseau social","Entreprise","Association","Personnalité publique","Artiste / Créateur","Média","Éducation","Santé","Sport","Religion","Commerce","Technologie","Mode","Tourisme","Politique","ONG / Humanitaire","Agriculture","Autre"];
const TIMEZONES = ["(GMT-12:00) Ligne de changement de date","(GMT-08:00) Los Angeles","(GMT-05:00) New York","(GMT+00:00) Londres","(GMT+01:00) Paris","(GMT+01:00) Afrique de l'Ouest","(GMT+02:00) Johannesburg","(GMT+03:00) Nairobi","(GMT+05:30) Mumbai","(GMT+08:00) Singapour"];
const ACTIONS = ["Aucun","Nous contacter","En savoir plus","S'inscrire","Commander","Réserver","Télécharger","Obtenir un devis"];
const ROLE_LABELS: Record<string, string> = { owner: "Propriétaire", admin: "Administrateur", editor: "Éditeur", moderator: "Modérateur" };
const ROLE_COLORS: Record<string, string> = { owner: "#22C55E", admin: "#6366F1", editor: "#F97316", moderator: "#0EA5E9" };

type View = "list" | "create" | "success" | "invite" | "profile" | "settings" | "settings-info" | "settings-roles" | "settings-about" | "settings-stats";

/* ── Tiny helpers ─────────────────────────────────────────────────── */
const AVCOLORS = ["#22C55E","#E91E63","#9C27B0","#D97706","#0EA5E9","#D32F2F","#00838F","#F97316"];

function Av({ name, src, size = 44 }: { name?: string | null; src?: string | null; size?: number }) {
  const bg = name ? AVCOLORS[name.charCodeAt(0) % AVCOLORS.length] : AVCOLORS[0];
  const ini = name ? name.trim().split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase() : "?";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {src ? <img src={src} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
           : <span style={{ color: "#fff", fontWeight: 800, fontSize: size * 0.36, lineHeight: 1 }}>{ini}</span>}
    </div>
  );
}

const ChevRight = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

function EmptyState({ icon, title, desc, btn, onBtn }: { icon: string; title: string; desc: string; btn?: string; onBtn?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "52px 24px", gap: 12, textAlign: "center" }}>
      <span style={{ fontSize: 52 }}>{icon}</span>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: "#111827" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>{desc}</p>
      {btn && onBtn && <button onClick={onBtn} style={{ background: G, color: "#fff", border: "none", borderRadius: 20, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}>{btn}</button>}
    </div>
  );
}

function InfoRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 14, color: "#374151" }}>{label}</span>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingBottom: 8, borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#111827", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const IST: React.CSSProperties = { width: "100%", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box", background: "#fff" };

/* ── Page card ── */
function PageCard({ page, onOpen, onFollow, onSettings }: { page: ApiPage; onOpen: () => void; onFollow: () => void; onSettings: () => void }) {
  return (
    <div onClick={onOpen} style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,.06)", cursor: "pointer" }}>
      <div style={{ height: 80, background: page.coverUrl ? `url(${page.coverUrl}) center/cover` : `linear-gradient(135deg, ${G}, ${GD})`, position: "relative" }}>
        <div style={{ position: "absolute", bottom: -24, left: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", border: "3px solid #fff", background: G, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {page.avatarUrl ? <img src={page.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>{page.emoji}</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: "30px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#111827" }}>{page.name}</p>
              {page.verified && <svg viewBox="0 0 24 24" width="16" height="16" fill={G}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6B7280" }}>{page.category} · {page.followersCount.toLocaleString()} abonnés</p>
          </div>
          {page.isOwner ? (
            <button onClick={e => { e.stopPropagation(); onSettings(); }} style={{ background: "#F3F4F6", border: "none", borderRadius: 20, padding: "7px 14px", fontWeight: 700, fontSize: 13, color: "#374151", cursor: "pointer" }}>Gérer</button>
          ) : (
            <button onClick={e => { e.stopPropagation(); onFollow(); }} style={{ background: page.isFollowed ? "#F3F4F6" : G, color: page.isFollowed ? "#374151" : "#fff", border: "none", borderRadius: 20, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {page.isFollowed ? "Abonné" : "S'abonner"}
            </button>
          )}
        </div>
        {page.description && <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{page.description}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function PagesPage({ initialPageId }: { initialPageId?: number }) {
  const navigate = useNavigate();

  /* ── Navigation state ──────────────────────────────────────── */
  const [view, setView] = useState<View>(initialPageId ? "profile" : "list");

  /* ── List state ────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<"toutes" | "mes" | "invitations">("toutes");
  const [pages, setPages] = useState<ApiPage[]>([]);
  const [myPages, setMyPages] = useState<ApiPage[]>([]);
  const [invitations, setInvitations] = useState<ApiPageInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Selected page ─────────────────────────────────────────── */
  const [selectedPage, setSelectedPage] = useState<ApiPage | null>(null);

  /* ── Create wizard ─────────────────────────────────────────── */
  const [createStep, setCreateStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", category: CATEGORIES[0], description: "", emoji: "📢",
    username: "", website: "", email: "", phone: "", address: "",
    timezone: TIMEZONES[5], actionButton: "Aucun",
    avatarUrl: "", coverUrl: "", coverVideoUrl: "", isPublic: true,
  });

  /* ── Profile sub-tab ───────────────────────────────────────── */
  const [profileTab, setProfileTab] = useState<"publications" | "apropos" | "photos" | "plus">("publications");

  /* ── Roles ─────────────────────────────────────────────────── */
  const [roles, setRoles] = useState<ApiPageRole[]>([]);

  /* ── Stats ─────────────────────────────────────────────────── */
  const [stats, setStats] = useState<ApiPageStats | null>(null);
  const [statsPeriod, setStatsPeriod] = useState("7 derniers jours");

  /* ── Invite friends ────────────────────────────────────────── */
  const [friends, setFriends] = useState<{ id: number; name: string; avatarUrl: string | null; country: string | null }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());

  /* ── Initial load ──────────────────────────────────────────── */
  const loadPages = async () => {
    setLoading(true);
    try {
      const [all, mine, invs] = await Promise.all([
        apiGetPages("all"),
        apiGetPages("mine"),
        apiGetPages("invitations"),
      ]);
      setPages(all as ApiPage[]);
      setMyPages(mine as ApiPage[]);
      setInvitations(invs as ApiPageInvitation[]);
    } catch { /* noop */ } finally { setLoading(false); }
  };

  useEffect(() => { loadPages(); }, []);

  useEffect(() => {
    if (initialPageId && !selectedPage) {
      apiGetPage(initialPageId).then(p => { setSelectedPage(p); setView("profile"); }).catch(() => {});
    }
  }, [initialPageId]);

  /* ── Helpers ───────────────────────────────────────────────── */
  const openPage = async (id: number) => {
    try {
      const p = await apiGetPage(id);
      setSelectedPage(p);
      setProfileTab("publications");
      setView("profile");
    } catch { toast.error("Impossible de charger la page"); }
  };

  const openSettings = (page: ApiPage) => {
    setSelectedPage(page);
    setView("settings");
  };

  const loadRoles = async (pageId: number) => {
    const r = await apiGetPageRoles(pageId);
    setRoles(r);
  };

  const loadStats = async (pageId: number) => {
    const s = await apiGetPageStats(pageId);
    setStats(s);
  };

  const loadFriends = async (pageId: number) => {
    const f = await apiGetPageFriendSuggestions(pageId);
    setFriends(f);
    setSelectedFriends(new Set());
  };

  const handleFollow = async (pageId: number, isFollowed: boolean) => {
    try {
      if (isFollowed) {
        await apiUnfollowPage(pageId);
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, isFollowed: false, followersCount: p.followersCount - 1 } : p));
        if (selectedPage?.id === pageId) setSelectedPage(prev => prev ? { ...prev, isFollowed: false, followersCount: prev.followersCount - 1 } : prev);
      } else {
        await apiFollowPage(pageId);
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, isFollowed: true, followersCount: p.followersCount + 1 } : p));
        if (selectedPage?.id === pageId) setSelectedPage(prev => prev ? { ...prev, isFollowed: true, followersCount: prev.followersCount + 1 } : prev);
      }
    } catch { toast.error("Erreur réseau"); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Le nom de la page est requis"); return; }
    setSaving(true);
    try {
      const page = await apiCreatePage({
        name: form.name, category: form.category, description: form.description || undefined,
        emoji: form.emoji, username: form.username || undefined,
        website: form.website || undefined, email: form.email || undefined,
        phone: form.phone || undefined, address: form.address || undefined,
        timezone: form.timezone, actionButton: form.actionButton,
        avatarUrl: form.avatarUrl || undefined, coverUrl: form.coverUrl || undefined,
        coverVideoUrl: form.coverVideoUrl || undefined, isPublic: form.isPublic,
      });
      setSelectedPage(page);
      setMyPages(prev => [page, ...prev]);
      setView("success");
    } catch { toast.error("Erreur lors de la création"); } finally { setSaving(false); }
  };

  const handleInviteSend = async () => {
    if (!selectedPage || selectedFriends.size === 0) return;
    setSaving(true);
    try {
      await apiInviteFriendsToPage(selectedPage.id, Array.from(selectedFriends));
      toast.success(`${selectedFriends.size} invitation(s) envoyée(s)`);
      setSelectedFriends(new Set());
      setView("profile");
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  const handleDeletePage = async () => {
    if (!selectedPage) return;
    if (!confirm("Supprimer définitivement cette page ?")) return;
    try {
      await apiDeletePage(selectedPage.id);
      toast.success("Page supprimée");
      setMyPages(prev => prev.filter(p => p.id !== selectedPage.id));
      setPages(prev => prev.filter(p => p.id !== selectedPage.id));
      setSelectedPage(null);
      setView("list");
    } catch { toast.error("Erreur lors de la suppression"); }
  };

  const handleUpdatePage = async () => {
    if (!selectedPage) return;
    setSaving(true);
    try {
      const upd = await apiUpdatePage(selectedPage.id, {
        name: form.name || selectedPage.name,
        category: form.category || selectedPage.category,
        description: form.description,
        website: form.website, email: form.email,
        phone: form.phone, address: form.address,
        timezone: form.timezone, actionButton: form.actionButton,
      });
      setSelectedPage(upd);
      toast.success("Page mise à jour");
      setView("settings");
    } catch { toast.error("Erreur"); } finally { setSaving(false); }
  };

  const resetCreateForm = () => {
    setForm({ name:"",category:CATEGORIES[0],description:"",emoji:"📢",username:"",website:"",email:"",phone:"",address:"",timezone:TIMEZONES[5],actionButton:"Aucun",avatarUrl:"",coverUrl:"",coverVideoUrl:"",isPublic:true });
    setCreateStep(1);
  };

  const goBack = (to: View) => setView(to);

  /* ══════════════════════════════════════════════════════════════
     VIEWS
  ══════════════════════════════════════════════════════════════ */

  /* ── LIST ────────────────────────────────────────────────────── */
  if (view === "list") {
    const TABS: Array<{ id: "toutes"|"mes"|"invitations"; label: string }> = [
      { id: "toutes", label: "Toutes" },
      { id: "mes", label: "Mes pages" },
      { id: "invitations", label: "Invitations" },
    ];
    const list = activeTab === "toutes" ? pages : activeTab === "mes" ? myPages : [];

    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:90 }}>
        {/* Header */}
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => navigate("/")} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{ fontWeight:700, fontSize:18, color:"#111827" }}>Pages</span>
          </div>
          <button onClick={() => { resetCreateForm(); setView("create"); }}
            style={{ background:G, color:"#fff", border:"none", borderRadius:20, padding:"8px 16px", fontWeight:600, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Créer
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"0 16px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ flex:1, padding:"13px 0", fontSize:14, fontWeight:activeTab===t.id?700:500, color:activeTab===t.id?G:"#6B7280", background:"none", border:"none", borderBottom:activeTab===t.id?`3px solid ${G}`:"3px solid transparent", cursor:"pointer" }}>
              {t.label}
              {t.id==="invitations"&&invitations.length>0&&<span style={{ marginLeft:4, background:"#EF4444", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:11, fontWeight:700 }}>{invitations.length}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
            {[1,2,3].map(i => <div key={i} style={{ height:130, borderRadius:20, background:"#E5E7EB" }}/>)}
          </div>
        ) : activeTab === "invitations" ? (
          invitations.length === 0 ? <EmptyState icon="📨" title="Aucune invitation" desc="Les invitations de pages apparaîtront ici." /> : (
            <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)", display:"flex", alignItems:"center", gap:12 }}>
                  <Av name={inv.pageName} src={inv.pageAvatar} size={52} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:15, color:"#111827" }}>{inv.pageName}</p>
                    <p style={{ margin:"2px 0 0", fontSize:13, color:"#6B7280" }}>{inv.pageCategory} · {(inv.pageFollowers??0).toLocaleString()} abonnés</p>
                    <p style={{ margin:"2px 0 0", fontSize:12, color:"#9CA3AF" }}>Invité par {inv.inviterName}</p>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={async()=>{ await apiDeclinePageInvitation(inv.id); setInvitations(p=>p.filter(i=>i.id!==inv.id)); }} style={{ background:"#F3F4F6", color:"#374151", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Refuser</button>
                    <button onClick={async()=>{ await apiAcceptPageInvitation(inv.id); toast.success("Vous suivez maintenant cette page"); setInvitations(p=>p.filter(i=>i.id!==inv.id)); loadPages(); }} style={{ background:G, color:"#fff", border:"none", borderRadius:10, padding:"7px 12px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Accepter</button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : list.length === 0 ? (
          activeTab === "mes" ? (
            <EmptyState icon="🏠" title="Aucune page" desc="Créez votre première page pour partager votre univers." btn="Créer une page" onBtn={() => { resetCreateForm(); setView("create"); }} />
          ) : <EmptyState icon="🔍" title="Aucune page disponible" desc="Les pages arrivent bientôt dans votre communauté." />
        ) : (
          <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
            {list.map(page => (
              <PageCard key={page.id} page={page} onOpen={()=>openPage(page.id)} onFollow={()=>handleFollow(page.id,!!page.isFollowed)} onSettings={()=>openSettings(page)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── CREATE WIZARD ───────────────────────────────────────────── */
  if (view === "create") {
    const STEPS = ["Informations","Détails","Médias","Vérification"];
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:100 }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={()=>{ if(createStep>1) setCreateStep(s=>s-1); else setView("list"); }} style={{ background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex:1 }}>
            <p style={{ margin:0, fontWeight:700, fontSize:16, color:"#111827" }}>Créer une page</p>
            <p style={{ margin:0, fontSize:12, color:"#6B7280" }}>Étape {createStep} sur {STEPS.length} — {STEPS[createStep-1]}</p>
          </div>
        </div>
        <div style={{ padding:"16px 16px 0" }}>
          <div style={{ display:"flex", gap:6 }}>
            {STEPS.map((_,i)=><div key={i} style={{ flex:1, height:4, borderRadius:4, background:i<createStep?G:"#E5E7EB", transition:"background .3s" }}/>)}
          </div>
        </div>
        <div style={{ padding:16 }}>
          {createStep===1 && (
            <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)", display:"flex", flexDirection:"column", gap:14 }}>
              <h3 style={{ margin:0, fontWeight:700, fontSize:16, color:"#111827" }}>Informations principales</h3>
              <div>
                <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Nom de la page</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={IST} placeholder="Ex: BrutePawa Officiel" maxLength={75}/>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"#9CA3AF", textAlign:"right" }}>{form.name.length}/75</p>
              </div>
              <div>
                <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Catégorie</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={IST}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Description (optionnel)</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  style={{ ...IST, resize:"vertical", minHeight:80, fontFamily:"inherit" }} placeholder="Décrivez votre page..." maxLength={255} rows={3}/>
                <p style={{ margin:"4px 0 0", fontSize:12, color:"#9CA3AF", textAlign:"right" }}>{form.description.length}/255</p>
              </div>
            </div>
          )}
          {createStep===2 && (
            <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)", display:"flex", flexDirection:"column", gap:14 }}>
              <h3 style={{ margin:0, fontWeight:700, fontSize:16, color:"#111827" }}>Informations détaillées</h3>
              {[
                { key:"website", label:"Site web", placeholder:"https://votre-site.com", type:"url" },
                { key:"email", label:"E-mail", placeholder:"contact@exemple.com", type:"email" },
                { key:"phone", label:"Téléphone", placeholder:"+229 97 12 34 56", type:"tel" },
                { key:"address", label:"Adresse", placeholder:"Votre adresse complète" },
              ].map(f=>(
                <div key={f.key}>
                  <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>{f.label} <span style={{ color:"#9CA3AF" }}>(optionnel)</span></label>
                  <input value={(form as Record<string,string>)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IST} placeholder={f.placeholder} type={f.type??"text"}/>
                </div>
              ))}
              <div>
                <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Fuseau horaire</label>
                <select value={form.timezone} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))} style={IST}>
                  {TIMEZONES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Bouton d'action</label>
                <select value={form.actionButton} onChange={e=>setForm(f=>({...f,actionButton:e.target.value}))} style={IST}>
                  {ACTIONS.map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
          )}
          {createStep===3 && (
            <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)", display:"flex", flexDirection:"column", gap:16 }}>
              <h3 style={{ margin:0, fontWeight:700, fontSize:16, color:"#111827" }}>Image de couverture</h3>
              <div style={{ border:"2px dashed #E5E7EB", borderRadius:16, padding:"32px 16px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                <p style={{ margin:0, fontSize:14, color:"#6B7280", fontWeight:600 }}>Télécharger une image de couverture</p>
                <p style={{ margin:0, fontSize:11, color:"#D1D5DB" }}>JPG, PNG ou WebP · Max 5MB</p>
              </div>
              <h3 style={{ margin:0, fontWeight:700, fontSize:16, color:"#111827" }}>Vidéo de présentation <span style={{ color:"#9CA3AF", fontSize:14, fontWeight:400 }}>(optionnel)</span></h3>
              <div style={{ border:"2px dashed #E5E7EB", borderRadius:16, padding:"32px 16px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <p style={{ margin:0, fontSize:14, color:"#6B7280", fontWeight:600 }}>Télécharger une vidéo</p>
                <p style={{ margin:0, fontSize:11, color:"#D1D5DB" }}>MP4, MOV · Max 50MB</p>
              </div>
            </div>
          )}
          {createStep===4 && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                <h3 style={{ margin:"0 0 14px", fontWeight:700, fontSize:16, color:"#111827" }}>Récapitulatif</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <PreviewRow label="Nom" value={form.name||"Non renseigné"} />
                  <PreviewRow label="Catégorie" value={form.category} />
                  <PreviewRow label="Description" value={form.description||"Aucune"} />
                  <PreviewRow label="Site web" value={form.website||"—"} />
                  <PreviewRow label="E-mail" value={form.email||"—"} />
                  <PreviewRow label="Fuseau horaire" value={form.timezone} />
                  <PreviewRow label="Bouton d'action" value={form.actionButton} />
                </div>
              </div>
              <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                <h3 style={{ margin:"0 0 12px", fontWeight:700, fontSize:15, color:"#111827" }}>Aperçu</h3>
                <div style={{ border:"2px solid #E5E7EB", borderRadius:16, overflow:"hidden" }}>
                  <div style={{ height:80, background:`linear-gradient(135deg,${G},${GD})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontWeight:800, fontSize:22, color:"#fff" }}>{form.name||"Nom de votre page"}</span>
                  </div>
                  <div style={{ padding:12 }}>
                    <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:15, color:"#111827" }}>{form.name||"Nom de votre page"}</p>
                    <p style={{ margin:0, fontSize:12, color:"#6B7280" }}>{form.category} · 0 abonnés</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:640, background:"#fff", borderTop:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", gap:12, zIndex:10 }}>
          {createStep>1 && <button onClick={()=>setCreateStep(s=>s-1)} style={{ flex:1, border:"2px solid #E5E7EB", borderRadius:14, padding:14, fontWeight:700, fontSize:15, color:"#374151", background:"#fff", cursor:"pointer" }}>← Retour</button>}
          {createStep<4 ? (
            <button onClick={()=>{ if(createStep===1&&!form.name.trim()){ toast.error("Le nom est requis"); return; } setCreateStep(s=>s+1); }} style={{ flex:1, background:G, color:"#fff", border:"none", borderRadius:14, padding:14, fontWeight:700, fontSize:15, cursor:"pointer" }}>Suivant →</button>
          ) : (
            <button onClick={handleCreate} disabled={saving} style={{ flex:1, background:saving?"#9CA3AF":GD, color:"#fff", border:"none", borderRadius:14, padding:14, fontWeight:700, fontSize:15, cursor:saving?"not-allowed":"pointer" }}>
              {saving?"Création en cours...":"Créer la page"}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── SUCCESS ─────────────────────────────────────────────────── */
  if (view === "success") {
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:20 }}>
        <div style={{ width:96, height:96, borderRadius:"50%", background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
        <h2 style={{ margin:0, fontWeight:800, fontSize:22, color:"#111827", textAlign:"center" }}>Page créée avec succès !</h2>
        <p style={{ margin:0, fontSize:15, color:"#6B7280", textAlign:"center" }}>Votre page est prête. Personnalisez-la et invitez vos amis à vous rejoindre.</p>
        {selectedPage && (
          <div style={{ background:"#fff", borderRadius:20, padding:16, width:"100%", boxShadow:"0 2px 12px rgba(0,0,0,.07)", display:"flex", alignItems:"center", gap:12 }}>
            <Av name={selectedPage.name} src={selectedPage.avatarUrl} size={56} />
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:17, color:"#111827" }}>{selectedPage.name}</p>
              <p style={{ margin:0, fontSize:13, color:"#6B7280" }}>{selectedPage.category}</p>
            </div>
          </div>
        )}
        <button onClick={()=>{ if(selectedPage) loadFriends(selectedPage.id); setView("invite"); }} style={{ width:"100%", background:G, color:"#fff", border:"none", borderRadius:14, padding:14, fontWeight:700, fontSize:15, cursor:"pointer" }}>
          Inviter des amis
        </button>
        <button onClick={()=>{ if(selectedPage) openPage(selectedPage.id); }} style={{ width:"100%", background:"#F3F4F6", color:"#374151", border:"none", borderRadius:14, padding:14, fontWeight:700, fontSize:15, cursor:"pointer" }}>
          Aller à ma page
        </button>
      </div>
    );
  }

  /* ── INVITE ──────────────────────────────────────────────────── */
  if (view === "invite") {
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:100 }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>goBack("profile")} style={{ background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:700, fontSize:17, color:"#111827" }}>Inviter des amis</span>
        </div>
        <p style={{ margin:"12px 16px 4px", fontSize:14, color:"#6B7280" }}>Invitez vos amis à suivre votre page et à rejoindre votre communauté.</p>
        {friends.length===0 ? (
          <EmptyState icon="👥" title="Aucun ami à inviter" desc="Tous vos amis suivent déjà cette page ou vous n'avez pas encore d'amis."/>
        ) : (
          <div style={{ padding:"8px 16px", display:"flex", flexDirection:"column", gap:8 }}>
            {friends.map(f=>{
              const sel = selectedFriends.has(f.id);
              return (
                <div key={f.id} style={{ background:"#fff", borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                  <Av name={f.name} src={f.avatarUrl} size={48}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:15, color:"#111827" }}>{f.name}</p>
                    <p style={{ margin:0, fontSize:13, color:"#9CA3AF" }}>{f.country??""}</p>
                  </div>
                  <button onClick={()=>setSelectedFriends(prev=>{ const s=new Set(prev); if(s.has(f.id)) s.delete(f.id); else s.add(f.id); return s; })}
                    style={{ background:sel?G:"#F3F4F6", color:sel?"#fff":"#374151", border:"none", borderRadius:20, padding:"7px 14px", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                    {sel?"Sélectionné":"Inviter"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {friends.length>0&&<div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:640, background:"#fff", borderTop:"1px solid #E5E7EB", padding:"12px 16px", zIndex:10 }}>
          <button onClick={handleInviteSend} disabled={saving||selectedFriends.size===0}
            style={{ width:"100%", background:selectedFriends.size>0?G:"#E5E7EB", color:selectedFriends.size>0?"#fff":"#9CA3AF", border:"none", borderRadius:14, padding:14, fontWeight:700, fontSize:15, cursor:selectedFriends.size>0?"pointer":"not-allowed" }}>
            {saving?"Envoi...":`Inviter ${selectedFriends.size>0?selectedFriends.size+" ami(s)":"des amis"}`}
          </button>
        </div>}
      </div>
    );
  }

  /* ── PROFILE ─────────────────────────────────────────────────── */
  if (view === "profile" && selectedPage) {
    const isOwner = selectedPage.isOwner;
    const PTABS = [
      { id:"publications" as const, label:"Publications" },
      { id:"apropos" as const, label:"À propos" },
      { id:"photos" as const, label:"Photos" },
      { id:"plus" as const, label:"Plus" },
    ];
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:80 }}>
        <div style={{ background:"#fff", position:"sticky", top:0, zIndex:10, borderBottom:"1px solid #E5E7EB" }}>
          <div style={{ display:"flex", alignItems:"center", padding:"10px 14px", gap:10 }}>
            <button onClick={()=>goBack("list")} style={{ background:"none", border:"none", cursor:"pointer" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{ fontWeight:700, fontSize:17, color:"#111827", flex:1 }}>{selectedPage.name}</span>
            {isOwner&&<button onClick={()=>openSettings(selectedPage)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>}
          </div>
        </div>
        <div style={{ background:"#fff", marginBottom:8 }}>
          {/* Cover */}
          <div style={{ height:180, background:selectedPage.coverUrl?`url(${selectedPage.coverUrl}) center/cover`:`linear-gradient(135deg,${G},${GD})`, position:"relative" }}>
            {!selectedPage.coverUrl&&<div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"rgba(255,255,255,.15)", borderRadius:20, padding:"10px 20px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:28 }}>{selectedPage.emoji}</span>
                <span style={{ fontWeight:800, fontSize:22, color:"#fff" }}>BrutePawa</span>
              </div>
            </div>}
          </div>
          <div style={{ padding:"0 16px 16px" }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:12, marginTop:-28 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", border:"4px solid #fff", background:G, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                {selectedPage.avatarUrl?<img src={selectedPage.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:<span style={{ fontSize:30 }}>{selectedPage.emoji}</span>}
              </div>
              <div style={{ flex:1, paddingBottom:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <p style={{ margin:0, fontWeight:800, fontSize:18, color:"#111827" }}>{selectedPage.name}</p>
                  {selectedPage.verified&&<svg viewBox="0 0 24 24" width="18" height="18" fill={G}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                </div>
                <p style={{ margin:0, fontSize:13, color:"#6B7280" }}>@{selectedPage.username??selectedPage.name.toLowerCase().replace(/\s+/g,"")}</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:24, marginTop:12, marginBottom:12 }}>
              {[{label:"Abonnés",val:selectedPage.followersCount},{label:"Publications",val:0},{label:"Abonnements",val:0}].map(s=>(
                <div key={s.label} style={{ textAlign:"center" }}>
                  <p style={{ margin:0, fontWeight:800, fontSize:18, color:"#111827" }}>{s.val.toLocaleString()}</p>
                  <p style={{ margin:0, fontSize:12, color:"#6B7280" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {isOwner?(
                <>
                  <button onClick={()=>openSettings(selectedPage)} style={{ flex:1, background:"#F3F4F6", border:"none", borderRadius:10, padding:"10px 0", fontWeight:700, fontSize:14, color:"#374151", cursor:"pointer" }}>Modifier</button>
                  <button onClick={()=>{ loadFriends(selectedPage.id); setView("invite"); }} style={{ flex:1, background:G, border:"none", borderRadius:10, padding:"10px 0", fontWeight:700, fontSize:14, color:"#fff", cursor:"pointer" }}>Promouvoir</button>
                </>
              ):(
                <>
                  <button onClick={()=>handleFollow(selectedPage.id,!!selectedPage.isFollowed)} style={{ flex:1, background:selectedPage.isFollowed?"#F3F4F6":G, color:selectedPage.isFollowed?"#374151":"#fff", border:"none", borderRadius:10, padding:"10px 0", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    {selectedPage.isFollowed?"Abonné ✓":"S'abonner"}
                  </button>
                  <button onClick={()=>{ loadFriends(selectedPage.id); setView("invite"); }} style={{ flex:1, background:"#F3F4F6", color:"#374151", border:"none", borderRadius:10, padding:"10px 0", fontWeight:700, fontSize:14, cursor:"pointer" }}>Partager</button>
                </>
              )}
            </div>
          </div>
          {/* Profile tabs */}
          <div style={{ display:"flex", borderTop:"1px solid #F1F5F9" }}>
            {PTABS.map(t=>(
              <button key={t.id} onClick={()=>setProfileTab(t.id)}
                style={{ flex:1, padding:"12px 0", fontSize:13, fontWeight:profileTab===t.id?700:500, color:profileTab===t.id?G:"#6B7280", background:"none", border:"none", borderBottom:profileTab===t.id?`3px solid ${G}`:"3px solid transparent", cursor:"pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {profileTab==="publications"&&<div style={{ padding:16 }}><EmptyState icon="📝" title="Aucune publication" desc="Partagez du contenu avec votre communauté."/></div>}
        {profileTab==="apropos"&&(
          <div style={{ padding:16, background:"#fff", margin:"0 0 8px" }}>
            <h3 style={{ margin:"0 0 12px", fontSize:16, fontWeight:700, color:"#111827" }}>Informations</h3>
            {selectedPage.email&&<InfoRow icon="✉️" label={selectedPage.email}/>}
            {selectedPage.phone&&<InfoRow icon="📞" label={selectedPage.phone}/>}
            {selectedPage.website&&<InfoRow icon="🌐" label={selectedPage.website}/>}
            {selectedPage.address&&<InfoRow icon="📍" label={selectedPage.address}/>}
            {selectedPage.description&&<>
              <h3 style={{ margin:"16px 0 8px", fontSize:16, fontWeight:700, color:"#111827" }}>Présentation</h3>
              <p style={{ margin:0, fontSize:14, color:"#374151", lineHeight:1.6 }}>{selectedPage.description}</p>
            </>}
            <div style={{ marginTop:16, display:"flex", flexWrap:"wrap", gap:8 }}>
              {[selectedPage.category,"Communauté active"].map(t=>(
                <span key={t} style={{ background:"#F0FDF4", color:G, borderRadius:20, padding:"4px 12px", fontSize:13, fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        {profileTab==="photos"&&<div style={{ padding:16 }}><EmptyState icon="🖼️" title="Aucune photo" desc="Les photos de cette page apparaîtront ici."/></div>}
        {profileTab==="plus"&&(
          <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
            {(isOwner?[
              { icon:"🛠️", label:"Outils professionnels" },
              { icon:"📣", label:"Centre publicitaire" },
              { icon:"📬", label:"Boîte de réception" },
              { icon:"📊", label:"Statistiques", action:()=>{ loadStats(selectedPage.id); setView("settings-stats"); } },
              { icon:"❓", label:"Aide et assistance" },
              { icon:"🔗", label:"Partager la page" },
            ]:[
              { icon:"📣", label:"Promouvoir cette page" },
              { icon:"🔗", label:"Copier le lien" },
              { icon:"🚩", label:"Signaler la page" },
            ]).map(item=>(
              <button key={item.label} onClick={(item as {action?:()=>void}).action}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:"#fff", border:"none", borderRadius:14, cursor:"pointer", textAlign:"left", boxShadow:"0 1px 4px rgba(0,0,0,.04)", width:"100%" }}>
                <span style={{ fontSize:22, width:36, textAlign:"center" }}>{item.icon}</span>
                <span style={{ flex:1, fontWeight:600, fontSize:15, color:"#111827" }}>{item.label}</span>
                <ChevRight/>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── SETTINGS ────────────────────────────────────────────────── */
  if (view === "settings" && selectedPage) {
    const SITEMS = [
      { id:"settings-info" as View, icon:"ℹ️", label:"Informations générales", desc:"Nom, description, catégorie" },
      { id:"settings-roles" as View, icon:"👥", label:"Rôles de la page", desc:"Gérer les membres de l'équipe" },
      { id:"settings-about" as View, icon:"📋", label:"À propos", desc:"Informations de contact" },
      { id:"settings-stats" as View, icon:"📊", label:"Statistiques", desc:"Performances et croissance" },
    ];
    const PRIVACY = [
      { icon:"💬", label:"Messages", desc:"Qui peut vous écrire" },
      { icon:"🔔", label:"Notifications", desc:"Paramètres des alertes" },
      { icon:"🔒", label:"Confidentialité", desc:"Visibilité de la page" },
    ];
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:80 }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={()=>setView("profile")} style={{ background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:700, fontSize:17, color:"#111827" }}>Paramètres de la page</span>
        </div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <p style={{ margin:0, padding:"12px 16px 6px", fontSize:12, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>Gestion</p>
            {SITEMS.map(item=>(
              <button key={item.id} onClick={async()=>{
                if(item.id==="settings-roles") await loadRoles(selectedPage.id);
                if(item.id==="settings-stats") await loadStats(selectedPage.id);
                if(item.id==="settings-info") setForm(f=>({...f,name:selectedPage.name,category:selectedPage.category,description:selectedPage.description??"",website:selectedPage.website??"",email:selectedPage.email??"",phone:selectedPage.phone??"",address:selectedPage.address??"",timezone:selectedPage.timezone??TIMEZONES[5],actionButton:selectedPage.actionButton??"Aucun"}));
                if(item.id==="settings-about") setForm(f=>({...f,website:selectedPage.website??"",email:selectedPage.email??"",phone:selectedPage.phone??"",address:selectedPage.address??"",timezone:selectedPage.timezone??TIMEZONES[5],actionButton:selectedPage.actionButton??"Aucun"}));
                setView(item.id);
              }} style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:"none", border:"none", borderBottom:"1px solid #F1F5F9", cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:22, width:36, textAlign:"center" }}>{item.icon}</span>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontWeight:600, fontSize:15, color:"#111827" }}>{item.label}</p>
                  <p style={{ margin:0, fontSize:13, color:"#6B7280" }}>{item.desc}</p>
                </div>
                <ChevRight/>
              </button>
            ))}
          </div>
          <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <p style={{ margin:0, padding:"12px 16px 6px", fontSize:12, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>Confidentialité</p>
            {PRIVACY.map(item=>(
              <button key={item.label} style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:"none", border:"none", borderBottom:"1px solid #F1F5F9", cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:22, width:36, textAlign:"center" }}>{item.icon}</span>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontWeight:600, fontSize:15, color:"#111827" }}>{item.label}</p>
                  <p style={{ margin:0, fontSize:13, color:"#6B7280" }}>{item.desc}</p>
                </div>
                <ChevRight/>
              </button>
            ))}
          </div>
          <button onClick={handleDeletePage} style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"14px 16px", background:"#fff", border:"none", borderRadius:20, cursor:"pointer", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <span style={{ fontSize:22, width:36, textAlign:"center", color:"#EF4444" }}>🗑️</span>
            <span style={{ fontWeight:600, fontSize:15, color:"#EF4444" }}>Supprimer la page</span>
          </button>
        </div>
      </div>
    );
  }

  /* ── SETTINGS INFO ───────────────────────────────────────────── */
  if (view === "settings-info" && selectedPage) {
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:100 }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={()=>goBack("settings")} style={{ background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:700, fontSize:17, color:"#111827", flex:1 }}>Informations générales</span>
          <button onClick={handleUpdatePage} disabled={saving} style={{ background:G, color:"#fff", border:"none", borderRadius:12, padding:"7px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>{saving?"...":"Enregistrer"}</button>
        </div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            {[
              { key:"name", label:"Nom de la page", placeholder:"Ex: BrutePawa Officiel", maxLen:75 },
              { key:"username", label:"Nom d'utilisateur", placeholder:"@monentreprise" },
              { key:"description", label:"Description", placeholder:"Décrivez votre page...", maxLen:255, multi:true },
            ].map(f=>(
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>{f.label}</label>
                {f.multi?(
                  <textarea value={(form as Record<string,string>)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{ ...IST, resize:"vertical", minHeight:80, fontFamily:"inherit" }} placeholder={f.placeholder} maxLength={f.maxLen} rows={3}/>
                ):(
                  <input value={(form as Record<string,string>)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IST} placeholder={f.placeholder} maxLength={f.maxLen}/>
                )}
                {f.maxLen&&<p style={{ margin:"4px 0 0", fontSize:12, color:"#9CA3AF", textAlign:"right" }}>{((form as Record<string,string>)[f.key]??"").length}/{f.maxLen}</p>}
              </div>
            ))}
            <div>
              <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Catégorie</label>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={IST}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── SETTINGS ROLES ──────────────────────────────────────────── */
  if (view === "settings-roles" && selectedPage) {
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:80 }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={()=>goBack("settings")} style={{ background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:700, fontSize:17, color:"#111827", flex:1 }}>Rôles de la page</span>
        </div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
          {roles.length===0?(
            <EmptyState icon="👥" title="Aucun membre" desc="Ajoutez des personnes pour gérer votre page avec vous."/>
          ):roles.map(r=>(
            <div key={r.userId} style={{ background:"#fff", borderRadius:16, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
              <Av name={r.name} src={r.avatarUrl} size={48}/>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:15, color:"#111827" }}>{r.name}</p>
                <span style={{ background:`${ROLE_COLORS[r.role]??"#9CA3AF"}18`, color:ROLE_COLORS[r.role]??"#9CA3AF", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:700 }}>
                  {ROLE_LABELS[r.role]??r.role}
                </span>
              </div>
              {r.role!=="owner"&&(
                <button onClick={async()=>{ await apiRemovePageRole(selectedPage.id,r.userId); setRoles(prev=>prev.filter(x=>x.userId!==r.userId)); toast.success("Membre retiré"); }}
                  style={{ background:"#FEF2F2", color:"#EF4444", border:"none", borderRadius:20, padding:"6px 12px", fontWeight:600, fontSize:13, cursor:"pointer" }}>Retirer</button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── SETTINGS ABOUT ──────────────────────────────────────────── */
  if (view === "settings-about" && selectedPage) {
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:100 }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={()=>goBack("settings")} style={{ background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:700, fontSize:17, color:"#111827", flex:1 }}>À propos</span>
          <button onClick={handleUpdatePage} disabled={saving} style={{ background:G, color:"#fff", border:"none", borderRadius:12, padding:"7px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>{saving?"...":"Enregistrer"}</button>
        </div>
        <div style={{ padding:16 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)", display:"flex", flexDirection:"column", gap:14 }}>
            {[
              { key:"website", label:"Site web", placeholder:"https://votre-site.com", type:"url" },
              { key:"email", label:"E-mail de contact", placeholder:"contact@exemple.com", type:"email" },
              { key:"phone", label:"Téléphone", placeholder:"+229 97 12 34 56", type:"tel" },
              { key:"address", label:"Adresse", placeholder:"Votre adresse complète" },
            ].map(f=>(
              <div key={f.key}>
                <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>{f.label} <span style={{ color:"#9CA3AF" }}>(optionnel)</span></label>
                <input value={(form as Record<string,string>)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} style={IST} placeholder={f.placeholder} type={f.type??"text"}/>
              </div>
            ))}
            <div>
              <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Fuseau horaire</label>
              <select value={form.timezone} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))} style={IST}>
                {TIMEZONES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:"block", fontWeight:600, fontSize:14, color:"#374151", marginBottom:6 }}>Bouton d'action</label>
              <select value={form.actionButton} onChange={e=>setForm(f=>({...f,actionButton:e.target.value}))} style={IST}>
                {ACTIONS.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── SETTINGS STATS ──────────────────────────────────────────── */
  if (view === "settings-stats" && selectedPage) {
    const PERIODS = ["7 derniers jours","30 derniers jours","90 derniers jours"];
    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:80 }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={()=>goBack("settings")} style={{ background:"none", border:"none", cursor:"pointer" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:700, fontSize:17, color:"#111827" }}>Statistiques</span>
        </div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:16 }}>
          <select value={statsPeriod} onChange={e=>setStatsPeriod(e.target.value)} style={{ border:"1.5px solid #E5E7EB", borderRadius:12, padding:"8px 14px", fontSize:14, color:"#111827", background:"#fff", outline:"none", alignSelf:"flex-start" }}>
            {PERIODS.map(p=><option key={p}>{p}</option>)}
          </select>
          {!stats?(
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[1,2,3,4].map(i=><div key={i} style={{ height:80, borderRadius:16, background:"#E5E7EB" }}/>)}
            </div>
          ):(
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { label:"Vues de la page", val:stats.viewsTotal, growth:stats.viewsGrowth },
                  { label:"Nouveaux abonnés", val:stats.newFollowers, growth:stats.followersGrowth },
                  { label:"Interactions", val:stats.interactions, growth:stats.interactionsGrowth },
                  { label:"Clics sur le site web", val:stats.clicks, growth:stats.clicksGrowth },
                ].map(st=>(
                  <div key={st.label} style={{ background:"#fff", borderRadius:16, padding:"16px 14px", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                    <p style={{ margin:"0 0 4px", fontSize:12, color:"#6B7280", fontWeight:500 }}>{st.label}</p>
                    <p style={{ margin:0, fontSize:22, fontWeight:800, color:"#111827" }}>{st.val.toLocaleString()}</p>
                    <p style={{ margin:"4px 0 0", fontSize:12, fontWeight:700, color:G }}>↑ +{st.growth.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
              <div style={{ background:"#fff", borderRadius:20, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                <p style={{ margin:"0 0 12px", fontWeight:700, fontSize:15, color:"#111827" }}>Graphique des vues</p>
                <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
                  {stats.chart.map((pt,i)=>{
                    const maxV = Math.max(...stats.chart.map(p=>p.views));
                    const h = Math.round((pt.views/maxV)*72);
                    return (
                      <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                        <div style={{ width:"100%", height:h, background:`linear-gradient(to top,${G},#86EFAC)`, borderRadius:"4px 4px 0 0" }}/>
                        <span style={{ fontSize:10, color:"#9CA3AF" }}>{pt.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
