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
  const [profileTab, setProfileTab] = useState<"publications" | "apropos" | "photos" | "videos" | "evenements" | "plus">("publications");

  /* ── Delete modal ───────────────────────────────────────────── */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPage, setDeletingPage] = useState(false);

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
    setDeletingPage(true);
    try {
      await apiDeletePage(selectedPage.id);
      toast.success("Page supprimée");
      setMyPages(prev => prev.filter(p => p.id !== selectedPage.id));
      setPages(prev => prev.filter(p => p.id !== selectedPage.id));
      setSelectedPage(null);
      setShowDeleteModal(false);
      setView("list");
    } catch { toast.error("Erreur lors de la suppression"); } finally { setDeletingPage(false); }
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
    const pageName = selectedPage?.name ?? "Ma page";
    const pageCategory = selectedPage?.category ?? "";
    const avatarUrl = selectedPage?.avatarUrl ?? null;

    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", display:"flex", flexDirection:"column", overflowX:"hidden" }}>
        <style>{`
          @keyframes confetti-fall {
            0%   { transform: translateY(-20px) rotate(0deg); opacity:1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
          }
          @keyframes pop-in {
            0%   { transform: scale(0.6); opacity:0; }
            70%  { transform: scale(1.08); }
            100% { transform: scale(1); opacity:1; }
          }
          @keyframes check-draw {
            0%   { stroke-dashoffset: 100; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes fade-up {
            0%   { transform: translateY(24px); opacity:0; }
            100% { transform: translateY(0); opacity:1; }
          }
          @keyframes pulse-ring {
            0%   { transform: scale(1); opacity:.4; }
            100% { transform: scale(1.5); opacity:0; }
          }
          .confetti-piece { position:fixed; width:8px; height:8px; top:-10px; animation: confetti-fall linear infinite; border-radius:2px; }
          .fade-up-1 { animation: fade-up .55s cubic-bezier(.22,1,.36,1) .15s both; }
          .fade-up-2 { animation: fade-up .55s cubic-bezier(.22,1,.36,1) .28s both; }
          .fade-up-3 { animation: fade-up .55s cubic-bezier(.22,1,.36,1) .38s both; }
          .fade-up-4 { animation: fade-up .55s cubic-bezier(.22,1,.36,1) .48s both; }
          .fade-up-5 { animation: fade-up .55s cubic-bezier(.22,1,.36,1) .58s both; }
        `}</style>

        {/* ── Confetti ── */}
        {[
          { left:"8%",  delay:"0s",   dur:"2.8s", color:"#22C55E", size:9 },
          { left:"18%", delay:".3s",  dur:"3.2s", color:"#F59E0B", size:7 },
          { left:"28%", delay:".7s",  dur:"2.5s", color:"#22C55E", size:11, round:"50%" },
          { left:"38%", delay:".1s",  dur:"3.5s", color:"#FCD34D", size:8 },
          { left:"52%", delay:".5s",  dur:"2.9s", color:"#86EFAC", size:10 },
          { left:"63%", delay:".2s",  dur:"3.1s", color:"#22C55E", size:7, round:"50%" },
          { left:"73%", delay:".9s",  dur:"2.7s", color:"#F59E0B", size:9 },
          { left:"83%", delay:".4s",  dur:"3.3s", color:"#22C55E", size:8 },
          { left:"92%", delay:".6s",  dur:"2.6s", color:"#FCD34D", size:10, round:"50%" },
        ].map((c,i) => (
          <div key={i} className="confetti-piece" style={{
            left:c.left, animationDelay:c.delay, animationDuration:c.dur,
            background:c.color, width:c.size, height:c.size, borderRadius:c.round??2,
          }}/>
        ))}

        {/* ── Hero illustration zone ── */}
        <div style={{ background:"linear-gradient(180deg,#F0FDF4 0%,#F8FAFC 100%)", padding:"48px 24px 28px", display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>

          {/* Illustration SVG premium */}
          <div style={{ position:"relative", width:200, height:220, animation:"pop-in .7s cubic-bezier(.22,1,.36,1) both" }}>
            {/* Glow background */}
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:170, height:170, borderRadius:"50%", background:"radial-gradient(circle,#DCFCE7 0%,#F0FDF4 60%,transparent 100%)" }}/>
            {/* Pulse ring */}
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:140, height:140, borderRadius:"50%", border:"2px solid #22C55E", animation:"pulse-ring 1.8s ease-out .4s infinite", opacity:.3 }}/>

            {/* Smartphone body */}
            <svg viewBox="0 0 120 200" width="120" height="200" style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-55%)" }}>
              {/* Phone shadow */}
              <ellipse cx="60" cy="195" rx="36" ry="6" fill="rgba(0,0,0,.08)"/>
              {/* Phone body */}
              <rect x="14" y="8" width="92" height="172" rx="16" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5"/>
              <rect x="18" y="12" width="84" height="164" rx="13" fill="#F8FAFC"/>
              {/* Status bar */}
              <rect x="38" y="16" width="44" height="6" rx="3" fill="#E5E7EB"/>
              {/* Screen content */}
              <rect x="24" y="32" width="72" height="38" rx="6" fill="#DCFCE7"/>
              {/* Landscape placeholder */}
              <path d="M24 56 L44 42 L58 52 L72 38 L96 56 Z" fill="#22C55E" opacity=".5"/>
              <circle cx="35" cy="42" r="5" fill="#22C55E" opacity=".6"/>
              {/* Lines */}
              <rect x="24" y="76" width="72" height="7" rx="3.5" fill="#E5E7EB"/>
              <rect x="24" y="88" width="52" height="7" rx="3.5" fill="#E5E7EB"/>
              <rect x="24" y="104" width="72" height="7" rx="3.5" fill="#F0FDF4"/>
              <rect x="24" y="116" width="44" height="7" rx="3.5" fill="#F0FDF4"/>
              {/* Bottom button */}
              <rect x="24" y="134" width="72" height="20" rx="10" fill="#22C55E"/>
              <rect x="36" y="140" width="48" height="8" rx="4" fill="rgba(255,255,255,.5)"/>
              {/* Home bar */}
              <rect x="44" y="164" width="32" height="4" rx="2" fill="#D1D5DB"/>
              {/* Decorative plant */}
              <ellipse cx="10" cy="190" rx="10" ry="12" fill="#86EFAC" opacity=".5"/>
              <line x1="10" y1="178" x2="10" y2="190" stroke="#22C55E" strokeWidth="1.5"/>
              <path d="M10 186 Q4 180 2 174" stroke="#22C55E" strokeWidth="1.2" fill="none"/>
              <path d="M10 184 Q16 178 18 172" stroke="#22C55E" strokeWidth="1.2" fill="none"/>
              {/* Stars / sparkles */}
              <path d="M100 20 L102 16 L104 20 L108 22 L104 24 L102 28 L100 24 L96 22 Z" fill="#FCD34D" opacity=".8"/>
              <path d="M16 30 L17.2 27 L18.4 30 L21 31 L18.4 32 L17.2 35 L16 32 L13 31 Z" fill="#FCD34D" opacity=".6"/>
              <circle cx="108" cy="60" r="3" fill="#22C55E" opacity=".5"/>
              <circle cx="12" cy="70" r="2" fill="#F59E0B" opacity=".6"/>
            </svg>

            {/* Check badge */}
            <div style={{ position:"absolute", bottom:24, right:12, width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#22C55E,#16A34A)", boxShadow:"0 8px 24px rgba(34,197,94,.45)", display:"flex", alignItems:"center", justifyContent:"center", animation:"pop-in .5s cubic-bezier(.22,1,.36,1) .5s both" }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            {/* Confetti cannons (decoration) */}
            <svg viewBox="0 0 30 30" width="36" height="36" style={{ position:"absolute", right:-8, top:40, transform:"rotate(-20deg)" }}>
              <rect x="8" y="18" width="14" height="8" rx="2" fill="#F59E0B"/>
              <polygon points="8,18 4,8 22,18" fill="#FCD34D"/>
              {[0,1,2].map(i=>(
                <line key={i} x1={12+i*3} y1="8" x2={10+i*4} y2={i%2===0?0:4} stroke={["#22C55E","#F59E0B","#22C55E"][i]} strokeWidth="1.5" strokeLinecap="round"/>
              ))}
            </svg>
          </div>

          {/* Title */}
          <div className="fade-up-1" style={{ marginTop:8, textAlign:"center" }}>
            <h1 style={{ margin:"0 0 10px", fontWeight:900, fontSize:26, letterSpacing:"-0.5px", color:"#0F172A", lineHeight:1.2 }}>
              Page créée avec succès{" "}
              <span style={{ color:"#22C55E" }}>!</span>
            </h1>
            <p style={{ margin:0, fontSize:15, color:"#64748B", lineHeight:1.55, maxWidth:300 }}>
              Votre page est prête. Personnalisez-la et invitez vos amis à vous rejoindre.
            </p>
          </div>
        </div>

        {/* ── Page card ── */}
        <div className="fade-up-2" style={{ margin:"0 20px", padding:"18px 18px 16px", background:"#fff", borderRadius:24, boxShadow:"0 4px 24px rgba(0,0,0,.07),0 1px 4px rgba(0,0,0,.04)", border:"1px solid rgba(0,0,0,.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            {/* Avatar */}
            <div style={{ position:"relative", flexShrink:0 }}>
              <div style={{ width:56, height:56, borderRadius:"50%", overflow:"hidden", background:"linear-gradient(135deg,#F97316,#EA580C)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(249,115,22,.3)" }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  : <span style={{ color:"#fff", fontWeight:900, fontSize:22, letterSpacing:"-0.5px" }}>{pageName.charAt(0).toUpperCase()}</span>}
              </div>
              <div style={{ position:"absolute", bottom:-2, right:-2, width:18, height:18, borderRadius:"50%", background:"#22C55E", border:"2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="8 2.5 4 7.5 2 5.5"/>
                </svg>
              </div>
            </div>

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:"0 0 3px", fontWeight:800, fontSize:17, color:"#0F172A", letterSpacing:"-0.2px" }}>{pageName}</p>
              <p style={{ margin:"0 0 6px", fontSize:13, color:"#64748B" }}>{pageCategory}</p>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ background:"linear-gradient(135deg,#DCFCE7,#BBF7D0)", color:"#15803D", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, letterSpacing:"0.2px" }}>
                  ✓ Page créée
                </span>
                <span style={{ fontSize:12, color:"#94A3B8" }}>à l'instant</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height:1, background:"linear-gradient(90deg,transparent,#F1F5F9,transparent)", margin:"14px 0" }}/>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:0 }}>
            {[
              { icon:<svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, label:"Abonnés", val:selectedPage?.followersCount??0 },
              { icon:<svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, label:"Publications", val:0 },
              { icon:<svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>, label:"Vues", val:0 },
            ].map((s,i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"6px 0", borderRight:i<2?"1px solid #F1F5F9":"none" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:["#F0FDF4","#EEF2FF","#F0F9FF"][i], display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {s.icon}
                </div>
                <p style={{ margin:0, fontWeight:800, fontSize:18, color:"#0F172A", lineHeight:1 }}>{s.val.toLocaleString()}</p>
                <p style={{ margin:0, fontSize:11, color:"#94A3B8", fontWeight:500 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Buttons ── */}
        <div className="fade-up-4" style={{ padding:"20px 20px 0", display:"flex", flexDirection:"column", gap:12 }}>
          {/* Primary CTA */}
          <button onClick={()=>{ if(selectedPage) loadFriends(selectedPage.id); setView("invite"); }}
            style={{ width:"100%", background:"linear-gradient(135deg,#22C55E 0%,#16A34A 100%)", color:"#fff", border:"none", borderRadius:16, padding:"16px 0", fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:"0 8px 24px rgba(34,197,94,.35),0 2px 8px rgba(34,197,94,.2)", display:"flex", alignItems:"center", justifyContent:"center", gap:10, letterSpacing:"-0.2px", position:"relative", overflow:"hidden" }}>
            {/* Shine */}
            <div style={{ position:"absolute", top:0, left:"-30%", width:"60%", height:"100%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)", transform:"skewX(-20deg)" }}/>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Inviter des amis
          </button>

          {/* Secondary CTA */}
          <button onClick={()=>{ if(selectedPage) openPage(selectedPage.id); }}
            style={{ width:"100%", background:"#fff", color:"#374151", border:"1.5px solid #E5E7EB", borderRadius:16, padding:"15px 0", fontWeight:700, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Aller à ma page
          </button>
        </div>

        {/* ── Bottom actions ── */}
        <div className="fade-up-5" style={{ margin:"20px 20px 40px", display:"flex", gap:12 }}>
          <button onClick={()=>openSettings(selectedPage!)}
            style={{ flex:1, background:"#F1F5F9", color:"#374151", border:"none", borderRadius:16, padding:"14px 0", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Modifier
          </button>
          <button onClick={async()=>{ if(selectedPage&&navigator.share) await navigator.share({ title:pageName, text:`Rejoignez ma page ${pageName} sur BrutePawa !` }); }}
            style={{ flex:1, background:"#F1F5F9", color:"#374151", border:"none", borderRadius:16, padding:"14px 0", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Partager
          </button>
        </div>
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
    const handle = selectedPage.username ?? selectedPage.name.toLowerCase().replace(/\s+/g, "");
    const PTABS = [
      { id:"publications" as const, label:"Publications" },
      { id:"apropos"      as const, label:"À propos" },
      { id:"photos"       as const, label:"Photos" },
      { id:"videos"       as const, label:"Vidéos" },
      { id:"evenements"   as const, label:"Évènements" },
      { id:"plus"         as const, label:"Plus" },
    ];

    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:90 }}>
        <style>{`
          .ptab-scroll::-webkit-scrollbar { display:none; }
          .ptab-btn { transition: color 180ms, border-color 180ms; }
          .action-btn { transition: transform 120ms, box-shadow 120ms; }
          .action-btn:active { transform: scale(0.97); }
          .plus-row { transition: background 150ms; }
          .plus-row:hover { background:#F8FAFC !important; }
        `}</style>

        {/* ── Floating header ── */}
        <div style={{ position:"sticky", top:0, zIndex:30, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"rgba(255,255,255,.92)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(229,231,235,.8)" }}>
          <button onClick={()=>goBack("list")} style={{ background:"none", border:"none", cursor:"pointer", padding:6, margin:-6, borderRadius:12, display:"flex" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:800, fontSize:17, color:"#0F172A", letterSpacing:"-0.2px" }}>{selectedPage.name}</span>
          {isOwner
            ? <button onClick={()=>openSettings(selectedPage)} style={{ background:"#F1F5F9", border:"none", cursor:"pointer", padding:8, borderRadius:12, display:"flex" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
            : <div style={{ width:36 }}/>
          }
        </div>

        {/* ── Cover 260px ── */}
        <div style={{ position:"relative", height:260, background:selectedPage.coverUrl?`url(${selectedPage.coverUrl}) center/cover`:"linear-gradient(135deg,#22C55E 0%,#16A34A 55%,#15803D 100%)", overflow:"hidden" }}>
          {/* Geometric patterns */}
          <svg viewBox="0 0 400 260" width="100%" height="100%" style={{ position:"absolute", inset:0 }} preserveAspectRatio="xMidYMid slice">
            <circle cx="340" cy="40"  r="80"  fill="rgba(255,255,255,.06)"/>
            <circle cx="360" cy="240" r="120" fill="rgba(255,255,255,.05)"/>
            <circle cx="30"  cy="200" r="60"  fill="rgba(255,255,255,.06)"/>
            <circle cx="80"  cy="20"  r="40"  fill="rgba(255,255,255,.08)"/>
            <line x1="0" y1="90"  x2="400" y2="170" stroke="rgba(255,255,255,.07)" strokeWidth="1"/>
            <line x1="0" y1="140" x2="400" y2="60"  stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
            {[40,80,120,160,200,240,280,320,360].map(x=>(
              <circle key={x} cx={x} cy={130} r="2" fill="rgba(255,255,255,.2)"/>
            ))}
          </svg>
          {/* Branding */}
          {!selectedPage.coverUrl && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
              <div style={{ background:"rgba(255,255,255,.18)", backdropFilter:"blur(12px)", borderRadius:18, padding:"12px 24px", display:"flex", alignItems:"center", gap:10 }}>
                <svg viewBox="0 0 36 36" width="32" height="32" fill="none">
                  <circle cx="18" cy="18" r="18" fill="rgba(255,255,255,.25)"/>
                  <path d="M11 13c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2v-7z" fill="#fff" opacity=".9"/>
                  <path d="M15 24v3M21 24v3M13 27h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span style={{ fontWeight:900, fontSize:20, color:"#fff", letterSpacing:"-0.3px" }}>BrutePawa</span>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="#fff" opacity={.9}>
                  <path d="M10 1l2.39 6.26L19 8.27l-4.88 4.73L15.56 19 10 15.27 4.44 19l1.44-6L1 8.27l6.61-1.01z"/>
                </svg>
              </div>
              <span style={{ color:"rgba(255,255,255,.7)", fontSize:13, fontWeight:500, letterSpacing:"0.3px" }}>Votre voix, votre communauté.</span>
            </div>
          )}
        </div>

        {/* ── White card: avatar + info + stats + buttons ── */}
        <div style={{ background:"#fff", paddingBottom:0 }}>
          <div style={{ padding:"0 20px" }}>
            {/* Avatar overlapping cover */}
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginTop:-52 }}>
              <div style={{ position:"relative" }}>
                <div style={{ width:104, height:104, borderRadius:"50%", border:"5px solid #fff", background:`linear-gradient(135deg,${G},${GD})`, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,.15)", flexShrink:0 }}>
                  {selectedPage.avatarUrl
                    ? <img src={selectedPage.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                    : <span style={{ color:"#fff", fontWeight:900, fontSize:40, letterSpacing:"-1px" }}>{selectedPage.name.charAt(0).toUpperCase()}</span>}
                </div>
                {selectedPage.verified && (
                  <div style={{ position:"absolute", bottom:4, right:4, width:26, height:26, borderRadius:"50%", background:G, border:"2.5px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(34,197,94,.4)" }}>
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="13 4 6 11 3 8"/></svg>
                  </div>
                )}
              </div>
            </div>

            {/* Name + handle */}
            <div style={{ marginTop:12, marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <h1 style={{ margin:0, fontWeight:900, fontSize:22, color:"#0F172A", letterSpacing:"-0.4px" }}>{selectedPage.name}</h1>
                {selectedPage.verified && (
                  <svg viewBox="0 0 22 22" width="20" height="20" fill={G}>
                    <path d="M11 0C4.925 0 0 4.925 0 11s4.925 11 11 11 11-4.925 11-11S17.075 0 11 0zm5.02 8.71-6.13 6.13a.75.75 0 0 1-1.06 0L5.98 11a.75.75 0 1 1 1.06-1.06l2.32 2.32 5.6-5.6a.75.75 0 0 1 1.06 1.05z"/>
                  </svg>
                )}
              </div>
              <p style={{ margin:"3px 0 0", fontSize:14, color:"#64748B", fontWeight:500 }}>@{handle}</p>
            </div>

            {/* Stats — 3 individual cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
              {[
                { label:"Abonnés",     val:selectedPage.followersCount },
                { label:"Publications",val:0 },
                { label:"Abonnements", val:0 },
              ].map(s=>(
                <div key={s.label} style={{ background:"#F8FAFC", borderRadius:18, padding:"14px 8px", textAlign:"center", boxShadow:"0 1px 4px rgba(0,0,0,.04)", border:"1px solid #F1F5F9" }}>
                  <p style={{ margin:"0 0 3px", fontWeight:900, fontSize:20, color:"#0F172A", letterSpacing:"-0.5px" }}>{s.val.toLocaleString()}</p>
                  <p style={{ margin:0, fontSize:11, color:"#64748B", fontWeight:500 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Action buttons 52px */}
            <div style={{ display:"flex", gap:10, paddingBottom:16 }}>
              {isOwner ? (
                <>
                  <button className="action-btn" onClick={()=>openSettings(selectedPage)}
                    style={{ flex:1, height:52, background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:16, fontWeight:700, fontSize:15, color:"#374151", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Modifier
                  </button>
                  <button className="action-btn" onClick={()=>{ loadFriends(selectedPage.id); setView("invite"); }}
                    style={{ flex:1, height:52, background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none", borderRadius:16, fontWeight:700, fontSize:15, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 6px 20px rgba(34,197,94,.35)" }}>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M3 3l1.664 9.143a2 2 0 0 0 1.958 1.636L15 14l-3 3-3-3"/><path d="M15 14l3 3 3-3"/><path d="M9 11V3l12 12"/></svg>
                    Promouvoir
                  </button>
                </>
              ) : (
                <>
                  <button className="action-btn" onClick={()=>handleFollow(selectedPage.id, !!selectedPage.isFollowed)}
                    style={{ flex:1, height:52, background:selectedPage.isFollowed?"#F1F5F9":"linear-gradient(135deg,#22C55E,#16A34A)", color:selectedPage.isFollowed?"#374151":"#fff", border:selectedPage.isFollowed?"1.5px solid #E2E8F0":"none", borderRadius:16, fontWeight:700, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:selectedPage.isFollowed?"none":"0 6px 20px rgba(34,197,94,.35)" }}>
                    {selectedPage.isFollowed
                      ? <><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Abonné</>
                      : <><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>S'abonner</>
                    }
                  </button>
                  <button className="action-btn" onClick={async()=>{ if(navigator.share) await navigator.share({ title:selectedPage.name }); }}
                    style={{ height:52, width:52, background:"#F1F5F9", border:"1.5px solid #E2E8F0", borderRadius:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Tabs scrollable ── */}
          <div className="ptab-scroll" style={{ display:"flex", borderTop:"1px solid #F1F5F9", overflowX:"auto", scrollbarWidth:"none" }}>
            {PTABS.map(t=>(
              <button key={t.id} className="ptab-btn" onClick={()=>setProfileTab(t.id)}
                style={{ flexShrink:0, padding:"14px 18px", fontSize:13.5, fontWeight:profileTab===t.id?700:500, color:profileTab===t.id?G:"#64748B", background:"none", border:"none", borderBottom:profileTab===t.id?`2.5px solid ${G}`:"2.5px solid transparent", cursor:"pointer", whiteSpace:"nowrap", transition:"all 180ms" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        {profileTab==="publications" && (
          <div style={{ padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:16, textAlign:"center" }}>
            <div style={{ width:80, height:80, borderRadius:24, background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="5" fill="#DCFCE7"/>
                <path d="M16 17h16M16 23h16M16 29h10" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M34 34l5 5" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="34" cy="30" r="5" fill="#22C55E" opacity=".3" stroke="#22C55E" strokeWidth="2"/>
                <path d="M32 30h4M34 28v4" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ margin:"0 0 6px", fontWeight:800, fontSize:18, color:"#0F172A" }}>Aucune publication</p>
              <p style={{ margin:0, fontSize:14, color:"#64748B", lineHeight:1.55, maxWidth:260 }}>Partagez du contenu avec votre communauté et engagez votre audience.</p>
            </div>
            <button style={{ height:44, background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", border:"none", borderRadius:14, padding:"0 24px", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:"0 4px 14px rgba(34,197,94,.3)" }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Créer une publication
            </button>
          </div>
        )}

        {profileTab==="apropos" && (
          <div style={{ margin:"12px 16px", background:"#fff", borderRadius:24, padding:20, boxShadow:"0 2px 12px rgba(0,0,0,.05)", border:"1px solid #F1F5F9" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:800, color:"#0F172A" }}>Informations</h3>
            {selectedPage.email && (
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <span style={{ fontSize:14, color:"#374151" }}>{selectedPage.email}</span>
              </div>
            )}
            {selectedPage.phone && (
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.4 2 2 0 0 1 3.6 2.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <span style={{ fontSize:14, color:"#374151" }}>{selectedPage.phone}</span>
              </div>
            )}
            {selectedPage.website && (
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#FDF4FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </div>
                <span style={{ fontSize:14, color:"#374151" }}>{selectedPage.website}</span>
              </div>
            )}
            {selectedPage.address && (
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#FFF7ED", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <span style={{ fontSize:14, color:"#374151" }}>{selectedPage.address}</span>
              </div>
            )}
            {selectedPage.description && (
              <>
                <div style={{ height:1, background:"#F1F5F9", margin:"16px 0" }}/>
                <h3 style={{ margin:"0 0 8px", fontSize:15, fontWeight:700, color:"#0F172A" }}>Présentation</h3>
                <p style={{ margin:0, fontSize:14, color:"#374151", lineHeight:1.65 }}>{selectedPage.description}</p>
              </>
            )}
            <div style={{ marginTop:16, display:"flex", flexWrap:"wrap", gap:8 }}>
              {[selectedPage.category, "Communauté active"].map(t=>(
                <span key={t} style={{ background:"#F0FDF4", color:G, borderRadius:20, padding:"5px 14px", fontSize:13, fontWeight:600, border:"1px solid #DCFCE7" }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {profileTab==="photos" && (
          <div style={{ padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:16, textAlign:"center" }}>
            <div style={{ width:80, height:80, borderRadius:24, background:"#FFF7ED", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
                <rect x="4" y="8" width="40" height="32" rx="6" fill="#FED7AA"/>
                <path d="M4 32l10-12 8 10 6-6 16 14H4z" fill="#F97316" opacity=".5"/>
                <circle cx="34" cy="18" r="5" fill="#F97316" opacity=".7"/>
              </svg>
            </div>
            <p style={{ margin:0, fontWeight:800, fontSize:18, color:"#0F172A" }}>Aucune photo</p>
            <p style={{ margin:0, fontSize:14, color:"#64748B" }}>Les photos de cette page apparaîtront ici.</p>
          </div>
        )}

        {profileTab==="videos" && (
          <div style={{ padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:16, textAlign:"center" }}>
            <div style={{ width:80, height:80, borderRadius:24, background:"#EEF2FF", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
                <rect x="4" y="10" width="28" height="28" rx="5" fill="#C7D2FE"/>
                <path d="M32 18l12-7v26l-12-7V18z" fill="#6366F1" opacity=".7"/>
                <circle cx="18" cy="24" r="6" fill="#6366F1" opacity=".4"/>
                <path d="M16 22l6 4-6 4V22z" fill="#6366F1"/>
              </svg>
            </div>
            <p style={{ margin:0, fontWeight:800, fontSize:18, color:"#0F172A" }}>Aucune vidéo</p>
            <p style={{ margin:0, fontSize:14, color:"#64748B" }}>Les vidéos publiées par cette page apparaîtront ici.</p>
          </div>
        )}

        {profileTab==="evenements" && (
          <div style={{ padding:"40px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:16, textAlign:"center" }}>
            <div style={{ width:80, height:80, borderRadius:24, background:"#FFF1F2", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
                <rect x="4" y="10" width="40" height="34" rx="6" fill="#FECDD3"/>
                <rect x="4" y="10" width="40" height="12" rx="6" fill="#F43F5E" opacity=".6"/>
                <line x1="16" y1="4" x2="16" y2="14" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round"/>
                <line x1="32" y1="4" x2="32" y2="14" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round"/>
                <rect x="12" y="28" width="8" height="8" rx="2" fill="#F43F5E" opacity=".6"/>
                <rect x="28" y="28" width="8" height="8" rx="2" fill="#F43F5E" opacity=".3"/>
              </svg>
            </div>
            <p style={{ margin:0, fontWeight:800, fontSize:18, color:"#0F172A" }}>Aucun évènement</p>
            <p style={{ margin:0, fontSize:14, color:"#64748B" }}>Les évènements organisés par cette page apparaîtront ici.</p>
          </div>
        )}

        {profileTab==="plus" && (
          <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:8 }}>
            {(isOwner ? [
              { label:"Outils professionnels", desc:"Gérez vos activités", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>, bg:"#F0FDF4" },
              { label:"Centre publicitaire", desc:"Créez des publicités", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>, bg:"#FFF7ED" },
              { label:"Boîte de réception", desc:"Messages entrants", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round"><polyline points="22 13 16 13 14 16 10 16 8 13 2 13"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>, bg:"#EEF2FF" },
              { label:"Statistiques", desc:"Performances et croissance", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, bg:"#F0F9FF", action:()=>{ loadStats(selectedPage.id); setView("settings-stats"); } },
              { label:"Aide et assistance", desc:"Centre d'aide BrutePawa", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, bg:"#F5F3FF" },
              { label:"Partager la page", desc:"Invitez des personnes", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>, bg:"#FDF2F8" },
            ] : [
              { label:"Promouvoir cette page", desc:"Boostez votre visibilité", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>, bg:"#FFF7ED" },
              { label:"Copier le lien", desc:"Partagez l'URL de la page", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, bg:"#EEF2FF" },
              { label:"Signaler la page", desc:"Contenu inapproprié", icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>, bg:"#FEF2F2" },
            ]).map(item=>(
              <button key={item.label} className="plus-row" onClick={(item as {action?:()=>void}).action}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 14px", background:"#fff", border:"none", borderRadius:18, cursor:"pointer", textAlign:"left", boxShadow:"0 1px 4px rgba(0,0,0,.04)", width:"100%", border:"1px solid #F1F5F9" } as React.CSSProperties}>
                <div style={{ width:44, height:44, borderRadius:13, background:item.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {item.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontWeight:700, fontSize:15, color:"#0F172A" }}>{item.label}</p>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#64748B" }}>{item.desc}</p>
                </div>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
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
      {
        id:"settings-info" as View,
        icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
        iconBg:"#F0FDF4", label:"Informations générales", desc:"Nom, description, catégorie",
      },
      {
        id:"settings-roles" as View,
        icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
        iconBg:"#EEF2FF", label:"Rôles de la page", desc:"Gérer les membres de l'équipe",
      },
      {
        id:"settings-about" as View,
        icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
        iconBg:"#FFF7ED", label:"À propos", desc:"Informations de contact",
      },
      {
        id:"settings-stats" as View,
        icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><rect x="1" y="20" width="22" height="1" rx=".5" fill="#0EA5E9"/></svg>,
        iconBg:"#F0F9FF", label:"Statistiques", desc:"Performances et croissance",
      },
    ];
    const PRIVACY = [
      { icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, iconBg:"#F5F3FF", label:"Messages", desc:"Qui peut vous écrire" },
      { icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, iconBg:"#FFFBEB", label:"Notifications", desc:"Paramètres des alertes" },
      { icon:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, iconBg:"#F8FAFC", label:"Confidentialité", desc:"Visibilité de la page" },
    ];

    const SettingsRow = ({ icon, iconBg, label, desc, onClick, danger = false }: { icon: React.ReactNode; iconBg: string; label: string; desc?: string; onClick?: () => void; danger?: boolean }) => (
      <button onClick={onClick} style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"0 16px", height:72, background:"none", border:"none", borderBottom:"1px solid #F8FAFC", cursor:"pointer", textAlign:"left" }}>
        <div style={{ width:44, height:44, borderRadius:13, background:danger?"#FEF2F2":iconBg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          {icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontWeight:700, fontSize:15, color:danger?"#EF4444":"#0F172A" }}>{label}</p>
          {desc && <p style={{ margin:"2px 0 0", fontSize:12, color:danger?"#FCA5A5":"#64748B" }}>{desc}</p>}
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={danger?"#FCA5A5":"#CBD5E1"} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    );

    return (
      <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#F8FAFC", minHeight:"100vh", maxWidth:640, margin:"0 auto", paddingBottom:80 }}>
        <style>{`
          @keyframes modal-in {
            0%   { transform: scale(0.92) translateY(12px); opacity:0; }
            100% { transform: scale(1) translateY(0); opacity:1; }
          }
        `}</style>

        {/* ── Delete modal ── */}
        {showDeleteModal && (
          <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center", background:"rgba(15,23,42,.45)", backdropFilter:"blur(6px)" }}
            onClick={e=>{ if(e.target===e.currentTarget) setShowDeleteModal(false); }}>
            <div style={{ background:"#fff", borderRadius:"32px 32px 0 0", padding:"28px 24px 40px", width:"100%", maxWidth:640, animation:"modal-in .25s cubic-bezier(.22,1,.36,1)" }}>
              {/* Handle */}
              <div style={{ width:36, height:4, borderRadius:4, background:"#E2E8F0", margin:"0 auto 28px" }}/>
              {/* Icon */}
              <div style={{ width:72, height:72, borderRadius:24, background:"#FEF2F2", border:"1.5px solid #FECACA", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              {/* Text */}
              <h2 style={{ margin:"0 0 10px", fontWeight:900, fontSize:20, color:"#0F172A", textAlign:"center", letterSpacing:"-0.3px" }}>Supprimer définitivement<br/>cette page&nbsp;?</h2>
              <p style={{ margin:"0 0 28px", fontSize:14, color:"#64748B", textAlign:"center", lineHeight:1.6, maxWidth:300, marginLeft:"auto", marginRight:"auto" }}>
                Cette action est irréversible. Toutes les données, publications et informations seront définitivement supprimées.
              </p>
              {/* Buttons */}
              <button onClick={handleDeletePage} disabled={deletingPage}
                style={{ width:"100%", height:52, background:deletingPage?"#FCA5A5":"#EF4444", color:"#fff", border:"none", borderRadius:16, fontWeight:800, fontSize:16, cursor:deletingPage?"not-allowed":"pointer", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 16px rgba(239,68,68,.3)", transition:"background 200ms" }}>
                {deletingPage
                  ? <><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Suppression…</>
                  : <>Supprimer définitivement</>
                }
              </button>
              <button onClick={()=>setShowDeleteModal(false)}
                style={{ width:"100%", height:52, background:"#F1F5F9", color:"#374151", border:"none", borderRadius:16, fontWeight:700, fontSize:16, cursor:"pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ background:"#fff", borderBottom:"1px solid #E2E8F0", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={()=>setView("profile")} style={{ background:"none", border:"none", cursor:"pointer", padding:6, margin:-6, borderRadius:12, display:"flex" }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontWeight:800, fontSize:17, color:"#0F172A", letterSpacing:"-0.2px" }}>Paramètres de la page</span>
        </div>

        <div style={{ padding:"16px 16px 24px", display:"flex", flexDirection:"column", gap:12 }}>
          {/* Gestion */}
          <div>
            <p style={{ margin:"0 4px 8px", fontSize:11, fontWeight:800, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"1px" }}>Gestion</p>
            <div style={{ background:"#fff", borderRadius:28, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.05)", border:"1px solid #F1F5F9" }}>
              {SITEMS.map((item, i) => (
                <div key={item.id} style={{ borderBottom:i<SITEMS.length-1?"1px solid #F8FAFC":"none" }}>
                  <SettingsRow
                    icon={item.icon} iconBg={item.iconBg} label={item.label} desc={item.desc}
                    onClick={async()=>{
                      if(item.id==="settings-roles") await loadRoles(selectedPage.id);
                      if(item.id==="settings-stats") await loadStats(selectedPage.id);
                      if(item.id==="settings-info") setForm(f=>({...f,name:selectedPage.name,category:selectedPage.category,description:selectedPage.description??"",website:selectedPage.website??"",email:selectedPage.email??"",phone:selectedPage.phone??"",address:selectedPage.address??"",timezone:selectedPage.timezone??TIMEZONES[5],actionButton:selectedPage.actionButton??"Aucun"}));
                      if(item.id==="settings-about") setForm(f=>({...f,website:selectedPage.website??"",email:selectedPage.email??"",phone:selectedPage.phone??"",address:selectedPage.address??"",timezone:selectedPage.timezone??TIMEZONES[5],actionButton:selectedPage.actionButton??"Aucun"}));
                      setView(item.id);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Confidentialité */}
          <div>
            <p style={{ margin:"0 4px 8px", fontSize:11, fontWeight:800, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"1px" }}>Confidentialité</p>
            <div style={{ background:"#fff", borderRadius:28, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.05)", border:"1px solid #F1F5F9" }}>
              {PRIVACY.map((item, i) => (
                <div key={item.label} style={{ borderBottom:i<PRIVACY.length-1?"1px solid #F8FAFC":"none" }}>
                  <SettingsRow icon={item.icon} iconBg={item.iconBg} label={item.label} desc={item.desc}/>
                </div>
              ))}
            </div>
          </div>

          {/* Zone danger */}
          <div>
            <p style={{ margin:"0 4px 8px", fontSize:11, fontWeight:800, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"1px" }}>Zone de danger</p>
            <div style={{ background:"#fff", borderRadius:28, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.05)", border:"1.5px solid #FECACA" }}>
              <SettingsRow
                danger
                icon={<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
                iconBg="#FEF2F2" label="Supprimer la page" desc="Action irréversible"
                onClick={()=>setShowDeleteModal(true)}
              />
            </div>
          </div>
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
