import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "../router";
import {
  apiGetUsersWithStatus, apiGetFriends, apiGetFriendRequests,
  apiSendFriendRequest, apiAcceptFriendRequest, apiRejectFriendRequest,
  PublicUser, PublicUserWithStatus, FriendRequest,
} from "../lib/api";

type SubTab = "personnes" | "amis" | "abonnes" | "groupes" | "pages" | "entreprises" | "messagerie";

const SUB_TABS: { id: SubTab; label: string; emoji: string }[] = [
  { id: "personnes", label: "Personnes", emoji: "🔍" },
  { id: "amis", label: "Ami(e)s", emoji: "👥" },
  { id: "abonnes", label: "Abonnés", emoji: "➕" },
  { id: "groupes", label: "Groupes", emoji: "🏘️" },
  { id: "pages", label: "Pages", emoji: "📢" },
  { id: "entreprises", label: "Entreprises", emoji: "🏢" },
  { id: "messagerie", label: "Messages", emoji: "💬" },
];

const COUNTRY_FILTERS = ["Tous", "Côte d'Ivoire", "Sénégal", "Cameroun", "Mali", "Burkina Faso", "Guinée", "Togo", "Gabon", "R.D. Congo"];

const AVATAR_COLORS = ["#1877F2", "#E91E63", "#9C27B0", "#FF9800", "#4CAF50", "#00BCD4", "#F44336", "#3F51B5"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function fullName(u: { firstName: string; lastName: string }) { return `${u.firstName} ${u.lastName}`.trim(); }
function initials(u: { firstName: string; lastName: string }) {
  return ((u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "")).toUpperCase() || "??";
}

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "À l'instant";
  if (d < 3600) return `Il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `Il y a ${Math.floor(d / 3600)} h`;
  const weeks = Math.floor(d / 604800);
  if (weeks < 52) return `Il y a ${weeks} sem.`;
  return `Il y a ${Math.floor(weeks / 52)} an(s)`;
}

function Avatar({ user, size = 50 }: { user: { id: number; firstName: string; lastName: string; avatarUrl?: string | null }; size?: number }) {
  return user.avatarUrl
    ? <img src={user.avatarUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: avatarColor(user.id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>{initials(user)}</div>;
}

function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--fb-text-secondary)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--fb-text)" }}>{title}</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

export default function Community() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SubTab>("personnes");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("Tous");

  const [users, setUsers] = useState<PublicUserWithStatus[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, f, r] = await Promise.all([apiGetUsersWithStatus(), apiGetFriends(), apiGetFriendRequests()]);
      setUsers(u);
      setFriends(f);
      setRequests(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const setLoaderFor = (id: number, val: boolean) =>
    setActionLoading(prev => ({ ...prev, [id]: val }));

  const handleSendRequest = async (userId: number) => {
    setLoaderFor(userId, true);
    try {
      await apiSendFriendRequest(userId);
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, friendshipStatus: "pending_sent" }
        : u
      ));
    } catch { /* ignore */ }
    setLoaderFor(userId, false);
  };

  const handleAccept = async (req: FriendRequest) => {
    setLoaderFor(req.id, true);
    try {
      await apiAcceptFriendRequest(req.id);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setFriends(prev => [...prev, req.fromUser]);
      setUsers(prev => prev.map(u => u.id === req.fromUser.id
        ? { ...u, friendshipStatus: "friends" }
        : u
      ));
    } catch { /* ignore */ }
    setLoaderFor(req.id, false);
  };

  const handleReject = async (req: FriendRequest) => {
    setLoaderFor(req.id, true);
    try {
      await apiRejectFriendRequest(req.id);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setUsers(prev => prev.map(u => u.id === req.fromUser.id
        ? { ...u, friendshipStatus: "none", requestId: undefined }
        : u
      ));
    } catch { /* ignore */ }
    setLoaderFor(req.id, false);
  };

  const handleCancelRequest = async (user: PublicUserWithStatus) => {
    if (!user.requestId) return;
    setLoaderFor(user.id, true);
    try {
      await apiRejectFriendRequest(user.requestId);
      setUsers(prev => prev.map(u => u.id === user.id
        ? { ...u, friendshipStatus: "none", requestId: undefined }
        : u
      ));
    } catch { /* ignore */ }
    setLoaderFor(user.id, false);
  };

  const filtered = users.filter(u => {
    const name = fullName(u).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (u.country ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCountry = countryFilter === "Tous" || (u.country ?? "").includes(countryFilter);
    return matchSearch && matchCountry;
  });

  const pendingCount = requests.length;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 0 16px" }}>
      {/* Sub-tabs */}
      <div style={{ background: "var(--fb-white)", borderBottom: "1px solid var(--fb-divider)", display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: "0 0 auto", padding: "12px 14px", background: "none", border: "none",
              borderBottom: activeTab === tab.id ? "3px solid var(--fb-blue)" : "3px solid transparent",
              color: activeTab === tab.id ? "var(--fb-blue)" : "var(--fb-text-secondary)",
              fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13, cursor: "pointer",
              whiteSpace: "nowrap", position: "relative",
            }}>
            {tab.emoji} {tab.label}
            {tab.id === "amis" && pendingCount > 0 && (
              <span style={{ marginLeft: 5, background: "var(--fb-red, #E41E3F)", color: "#fff", borderRadius: 12, padding: "1px 6px", fontSize: 11, fontWeight: 800 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px" }}>

        {/* ─── PERSONNES ─── */}
        {activeTab === "personnes" && (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher des personnes..." style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 12, paddingBottom: 4 }}>
              {COUNTRY_FILTERS.map(c => (
                <button key={c} onClick={() => setCountryFilter(c)}
                  style={{ flex: "0 0 auto", padding: "5px 12px", borderRadius: 20, border: "1px solid var(--fb-border)",
                    background: countryFilter === c ? "var(--fb-blue)" : "var(--fb-white)",
                    color: countryFilter === c ? "#fff" : "var(--fb-text)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  {c}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--fb-text-secondary)" }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <EmptyState emoji="👤" title="Aucune personne trouvée" sub="Modifiez votre recherche ou invitez des amis." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map(user => (
                  <div key={user.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div onClick={() => navigate(`/profile/${user.id}`)} style={{ cursor: "pointer", flexShrink: 0 }}>
                      <Avatar user={user} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => navigate(`/profile/${user.id}`)}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fullName(user)}</div>
                      {user.country && <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>📍 {user.country}</div>}
                      {user.bio && <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.bio}</div>}
                    </div>

                    {user.friendshipStatus === "none" && (
                      <button
                        className="btn-primary"
                        style={{ width: "auto", padding: "8px 14px", fontSize: 13, flexShrink: 0 }}
                        disabled={actionLoading[user.id]}
                        onClick={() => handleSendRequest(user.id)}
                      >
                        {actionLoading[user.id] ? "…" : "+ Ajouter"}
                      </button>
                    )}
                    {user.friendshipStatus === "pending_sent" && (
                      <button
                        style={{ width: "auto", padding: "8px 12px", fontSize: 12, flexShrink: 0, background: "var(--fb-divider)", border: "none", borderRadius: 8, color: "var(--fb-text)", fontWeight: 600, cursor: "pointer" }}
                        disabled={actionLoading[user.id]}
                        onClick={() => handleCancelRequest(user)}
                      >
                        {actionLoading[user.id] ? "…" : "⏳ Envoyée"}
                      </button>
                    )}
                    {user.friendshipStatus === "pending_received" && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn-primary"
                          style={{ width: "auto", padding: "7px 12px", fontSize: 12 }}
                          disabled={actionLoading[user.id]}
                          onClick={() => {
                            const r = requests.find(r => r.fromUser.id === user.id);
                            if (r) handleAccept(r);
                          }}
                        >Confirmer</button>
                        <button
                          style={{ width: "auto", padding: "7px 12px", fontSize: 12, background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
                          disabled={actionLoading[user.id]}
                          onClick={() => {
                            const r = requests.find(r => r.fromUser.id === user.id);
                            if (r) handleReject(r);
                          }}
                        >Supprimer</button>
                      </div>
                    )}
                    {user.friendshipStatus === "friends" && (
                      <span style={{ fontSize: 12, color: "var(--fb-blue)", fontWeight: 700, flexShrink: 0 }}>✓ Amis</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── AMI(E)S ─── */}
        {activeTab === "amis" && (
          <>
            {/* Invitations section */}
            {requests.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Invitations ({requests.length})</div>
                  <span style={{ color: "var(--fb-blue)", fontSize: 13, fontWeight: 600 }}>Voir tout</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {requests.map(req => (
                    <div key={req.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <Avatar user={{ ...req.fromUser, id: req.fromUser.id }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{fullName(req.fromUser)}</div>
                          {req.fromUser.country && <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>📍 {req.fromUser.country}</div>}
                          <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 2 }}>{relTime(req.createdAt)}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn-primary"
                          style={{ flex: 1, padding: "10px 0", fontSize: 14 }}
                          disabled={actionLoading[req.id]}
                          onClick={() => handleAccept(req)}
                        >
                          {actionLoading[req.id] ? "…" : "Confirmer"}
                        </button>
                        <button
                          style={{ flex: 1, padding: "10px 0", fontSize: 14, background: "var(--fb-divider)", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", color: "var(--fb-text)" }}
                          disabled={actionLoading[req.id]}
                          onClick={() => handleReject(req)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friend list section */}
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>
              {requests.length > 0 ? "Vos ami(e)s" : "Ami(e)s"}
              {friends.length > 0 && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--fb-text-secondary)", marginLeft: 6 }}>({friends.length})</span>}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--fb-text-secondary)" }}>Chargement…</div>
            ) : friends.length === 0 ? (
              <EmptyState emoji="👥" title="Aucun ami pour l'instant" sub="Ajoutez des personnes depuis l'onglet Personnes." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {friends.map(friend => (
                  <div key={friend.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ cursor: "pointer", flexShrink: 0 }}>
                      <Avatar user={friend} />
                    </div>
                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => navigate(`/profile/${friend.id}`)}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fullName(friend)}</div>
                      {friend.country && <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>📍 {friend.country}</div>}
                      {friend.bio && <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 2 }}>{friend.bio}</div>}
                    </div>
                    <button
                      onClick={() => navigate("/messages")}
                      style={{ flexShrink: 0, padding: "8px 12px", background: "var(--fb-divider)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >💬 Message</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── ABONNÉS ─── */}
        {activeTab === "abonnes" && (
          <EmptyState emoji="➕" title="Aucun abonnement" sub="Commencez à suivre des personnes depuis l'onglet Personnes." />
        )}

        {/* ─── GROUPES ─── */}
        {activeTab === "groupes" && (
          <>
            <button className="btn-primary" style={{ marginBottom: 16 }}>+ Créer un groupe</button>
            <EmptyState emoji="🏘️" title="Aucun groupe disponible" sub="Les groupes seront bientôt disponibles." />
          </>
        )}

        {/* ─── PAGES ─── */}
        {activeTab === "pages" && (
          <>
            <button className="btn-primary" style={{ marginBottom: 16 }}>+ Créer une page</button>
            <EmptyState emoji="📢" title="Aucune page disponible" sub="Les pages arrivent bientôt." />
          </>
        )}

        {/* ─── ENTREPRISES ─── */}
        {activeTab === "entreprises" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🏢 Annuaire des entreprises</div>
            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 12 }}>Réseau professionnel & B2B — Afrique francophone</div>
            <EmptyState emoji="🏢" title="Aucune entreprise enregistrée" sub="Les entreprises seront disponibles prochainement." />
          </>
        )}

        {/* ─── MESSAGERIE ─── */}
        {activeTab === "messagerie" && (
          <>
            <input placeholder="🔍 Rechercher dans les messages..." style={{ marginBottom: 10 }} />
            <div onClick={() => navigate("/messages")} style={{ textAlign: "center", padding: "32px 20px", color: "var(--fb-text-secondary)", cursor: "pointer" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--fb-text)" }}>Accéder à la messagerie</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Vos conversations privées sont dans Messagerie</div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
