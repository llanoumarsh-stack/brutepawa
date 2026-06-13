import { useState, useEffect, useRef } from "react";
import { useNavigate } from "../router";
import {
  apiSearchUsers,
  apiSendFriendRequest,
  apiGetProducts,
  apiGetJobs,
  apiSearchPosts,
  apiSearchGroups,
  type PublicUserWithStatus,
  type ApiProduct,
  type ApiJob,
  type FeedPost,
  type ApiGroup,
} from "../lib/api";

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#D32F2F","#00838F","#5D4037"];

function colorForId(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function snippet(text: string, maxLen = 120): string {
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "…" : text;
}

type Tab = "people" | "posts" | "groups" | "articles" | "jobs";

const WEST_AFRICA_COUNTRIES = [
  { code: "BJ", name: "Bénin" },
  { code: "TG", name: "Togo" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "SN", name: "Sénégal" },
  { code: "ML", name: "Mali" },
  { code: "BF", name: "Burkina Faso" },
  { code: "NE", name: "Niger" },
  { code: "GN", name: "Guinée" },
  { code: "CM", name: "Cameroun" },
  { code: "TD", name: "Tchad" },
  { code: "GA", name: "Gabon" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "R.D. Congo" },
  { code: "CF", name: "Centrafrique" },
];

const TAB_CATEGORIES: Partial<Record<Tab, string[]>> = {
  groups:   ["Agriculture", "Technologie", "Commerce", "Éducation", "Sport", "Santé", "Culture", "Religion"],
  articles: ["Mode", "Électronique", "Bijoux", "Artisanat", "Alimentation", "Auto/Moto", "Beauté", "Maison"],
};

interface Props {
  q: string;
}

export default function SearchPage({ q }: Props) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("people");
  const [users, setUsers]       = useState<PublicUserWithStatus[]>([]);
  const [posts, setPosts]       = useState<FeedPost[]>([]);
  const [groups, setGroups]     = useState<ApiGroup[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [jobs, setJobs]         = useState<ApiJob[]>([]);
  const [loading, setLoading]   = useState(false);
  const [requestStates, setRequestStates] = useState<Record<number, "sending" | "sent" | "friends" | "pending_sent" | "none">>({});

  const [filterCountry, setFilterCountry] = useState<{ code: string; name: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFilterCategory("");
  }, [activeTab]);

  useEffect(() => {
    if (!q.trim()) {
      setUsers([]); setPosts([]); setGroups([]); setProducts([]); setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const countryCode = filterCountry?.code;
        const countryName = filterCountry?.name;
        const category = filterCategory || undefined;
        const [u, ps, g, p, j] = await Promise.all([
          apiSearchUsers(q, { country: countryCode }),
          apiSearchPosts(q),
          apiSearchGroups(q, { country: countryName, category: activeTab === "groups" ? category : undefined }),
          apiGetProducts({ search: q, country: countryName, category: activeTab === "articles" ? category : undefined }),
          apiGetJobs({ search: q, country: countryName }),
        ]);
        setUsers(u);
        setPosts(ps);
        setGroups(g);
        setProducts(p);
        setJobs(j);
        const initial: Record<number, "sending" | "sent" | "friends" | "pending_sent" | "none"> = {};
        u.forEach(user => {
          initial[user.id] = user.friendshipStatus === "friends" ? "friends"
            : user.friendshipStatus === "pending_sent" ? "pending_sent"
            : "none";
        });
        setRequestStates(initial);
      } catch {
        setUsers([]); setPosts([]); setGroups([]); setProducts([]); setJobs([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, filterCountry, filterCategory, activeTab]);

  const handleAddFriend = async (userId: number) => {
    setRequestStates(prev => ({ ...prev, [userId]: "sending" }));
    try {
      await apiSendFriendRequest(userId);
      setRequestStates(prev => ({ ...prev, [userId]: "sent" }));
    } catch {
      setRequestStates(prev => ({ ...prev, [userId]: "none" }));
    }
  };

  const initials = (u: PublicUserWithStatus) =>
    `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "people",   label: "👥 Personnes",    count: users.length },
    { id: "posts",    label: "📝 Publications",  count: posts.length },
    { id: "groups",   label: "🏘️ Groupes",       count: groups.length },
    { id: "articles", label: "🛍️ Articles",      count: products.length },
    { id: "jobs",     label: "💼 Emplois",        count: jobs.length },
  ];

  const tabStyle = (tab: Tab) => ({
    padding: "8px 16px",
    borderRadius: 20,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    background: activeTab === tab ? "var(--fb-blue)" : "var(--fb-bg)",
    color: activeTab === tab ? "#fff" : "var(--fb-text)",
    transition: "background 0.15s, color 0.15s",
    whiteSpace: "nowrap" as const,
  });

  const chipStyle = (active: boolean) => ({
    padding: "5px 13px",
    borderRadius: 16,
    border: `1.5px solid ${active ? "var(--fb-blue)" : "var(--fb-divider)"}`,
    background: active ? "#e7f0fd" : "var(--fb-white)",
    color: active ? "var(--fb-blue)" : "var(--fb-text)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    whiteSpace: "nowrap" as const,
    transition: "all 0.15s",
  });

  const categoryOptions = TAB_CATEGORIES[activeTab] ?? [];
  const showCountryFilter = activeTab !== "posts";
  const showCategoryFilter = categoryOptions.length > 0;
  const hasFilters = showCountryFilter || showCategoryFilter;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 12px" }}>

      {/* Header */}
      <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {q ? `Résultats pour « ${q} »` : "Recherche"}
        </div>
        {!q && (
          <p style={{ color: "var(--fb-text-secondary)", fontSize: 14 }}>
            Tapez un nom dans la barre de recherche ci-dessus et appuyez sur Entrée.
          </p>
        )}
      </div>

      {/* Tabs */}
      {q && !loading && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10, scrollbarWidth: "none" }}>
          {tabs.map(t => (
            <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>
              {t.label}
              {t.count > 0 && (
                <span style={{
                  marginLeft: 6,
                  background: activeTab === t.id ? "rgba(255,255,255,0.3)" : "#e4e6e9",
                  color: activeTab === t.id ? "#fff" : "var(--fb-text-secondary)",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 12,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      {q && !loading && hasFilters && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "10px 14px", marginBottom: 12 }}>

          {/* Country filter */}
          {showCountryFilter && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: showCategoryFilter ? 10 : 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fb-text-secondary)", flexShrink: 0 }}>
                📍 Pays
              </span>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", flexWrap: "wrap" }}>
                <button
                  style={chipStyle(!filterCountry)}
                  onClick={() => setFilterCountry(null)}
                >
                  Tous
                </button>
                {WEST_AFRICA_COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    style={chipStyle(filterCountry?.code === c.code)}
                    onClick={() => setFilterCountry(filterCountry?.code === c.code ? null : c)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category filter */}
          {showCategoryFilter && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fb-text-secondary)", flexShrink: 0 }}>
                🏷️ Catégorie
              </span>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", flexWrap: "wrap" }}>
                <button
                  style={chipStyle(!filterCategory)}
                  onClick={() => setFilterCategory("")}
                >
                  Toutes
                </button>
                {categoryOptions.map(cat => (
                  <button
                    key={cat}
                    style={chipStyle(filterCategory === cat)}
                    onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)" }}>
              <div className="skeleton" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: "55%", height: 15, marginBottom: 6 }} />
                <div className="skeleton skeleton-text" style={{ width: "35%", height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* People tab */}
      {!loading && activeTab === "people" && q && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 16 }}>
            👥 Personnes
            {filterCountry && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: "var(--fb-blue)" }}>· {filterCountry.name}</span>}
          </div>

          {users.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun résultat trouvé</div>
              <div style={{ fontSize: 13 }}>
                Aucun utilisateur ne correspond à « {q} »{filterCountry ? ` au ${filterCountry.name}` : ""}.
              </div>
            </div>
          )}

          {users.map((user, idx) => {
            const state = requestStates[user.id] ?? "none";
            const fullName = `${user.firstName} ${user.lastName}`;
            return (
              <div
                key={user.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: idx < users.length - 1 ? "1px solid var(--fb-divider)" : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <div onClick={() => navigate(`/profile/${user.id}`)} style={{ cursor: "pointer", flexShrink: 0 }}>
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                    : (
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: colorForId(user.id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>
                        {initials(user)}
                      </div>
                    )
                  }
                </div>

                <div onClick={() => navigate(`/profile/${user.id}`)} role="button" style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fullName}
                  </div>
                  {user.country && (
                    <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>
                      📍 {user.country}
                    </div>
                  )}
                  {user.bio && (
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.bio}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/profile/${user.id}`)}
                    style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-bg)", border: "1px solid var(--fb-divider)", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--fb-text)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#e4e6e9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--fb-bg)")}
                  >
                    Voir profil
                  </button>

                  <button
                    onClick={() => navigate(`/messages?userId=${user.id}`)}
                    style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-bg)", border: "1px solid var(--fb-divider)", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--fb-blue)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#e4e6e9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--fb-bg)")}
                    title="Envoyer un message"
                  >
                    💬
                  </button>

                  {state === "friends" && (
                    <button disabled style={{ padding: "8px 14px", borderRadius: 6, background: "#e7f3e8", border: "none", fontWeight: 600, fontSize: 13, cursor: "default", color: "#2e7d32" }}>
                      ✓ Amis
                    </button>
                  )}
                  {(state === "pending_sent" || state === "sent") && (
                    <button disabled style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-bg)", border: "1px solid var(--fb-divider)", fontWeight: 600, fontSize: 13, cursor: "default", color: "var(--fb-text-secondary)" }}>
                      Demande envoyée
                    </button>
                  )}
                  {state === "none" && (
                    <button
                      onClick={() => handleAddFriend(user.id)}
                      style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-blue)", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#fff", transition: "background 0.15s, transform 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-blue-dark)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "var(--fb-blue)")}
                      onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                      onMouseUp={e => (e.currentTarget.style.transform = "")}
                    >
                      + Ajouter
                    </button>
                  )}
                  {state === "sending" && (
                    <button disabled style={{ padding: "8px 14px", borderRadius: 6, background: "var(--fb-blue)", border: "none", fontWeight: 600, fontSize: 13, cursor: "default", color: "#fff", opacity: 0.7 }}>
                      ...
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Posts tab */}
      {!loading && activeTab === "posts" && q && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 16 }}>
            📝 Publications
          </div>

          {posts.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucune publication trouvée</div>
              <div style={{ fontSize: 13 }}>Aucune publication ne correspond à « {q} ».</div>
            </div>
          )}

          {posts.map((post, idx) => (
            <div
              key={post.id}
              style={{
                padding: "14px 16px",
                borderBottom: idx < posts.length - 1 ? "1px solid var(--fb-divider)" : "none",
                transition: "background 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                {post.authorAvatarUrl
                  ? <img src={post.authorAvatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      📝
                    </div>
                  )
                }
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{post.authorName}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>
                    {new Date(post.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: "var(--fb-text)", lineHeight: 1.5 }}>
                {snippet(post.content)}
              </div>
              {post.imageUrl && (
                <div style={{ marginTop: 10 }}>
                  <img src={post.thumbnailUrl ?? post.imageUrl} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "var(--fb-text-secondary)" }}>
                <span>❤️ {post.likesCount}</span>
                <span>💬 {post.commentsCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Groups tab */}
      {!loading && activeTab === "groups" && q && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 16 }}>
            🏘️ Groupes / Communautés
            {(filterCountry || filterCategory) && (
              <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: "var(--fb-blue)" }}>
                {[filterCategory, filterCountry?.name].filter(Boolean).map(v => `· ${v}`).join(" ")}
              </span>
            )}
          </div>

          {groups.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun groupe trouvé</div>
              <div style={{ fontSize: 13 }}>Aucun groupe ne correspond à « {q} »{filterCategory ? ` en ${filterCategory}` : ""}{ filterCountry ? ` au ${filterCountry.name}` : ""}.</div>
            </div>
          )}

          {groups.map((group, idx) => (
            <div
              key={group.id}
              onClick={() => navigate(`/groups/${group.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: idx < groups.length - 1 ? "1px solid var(--fb-divider)" : "none",
                transition: "background 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <div style={{ width: 52, height: 52, borderRadius: 10, background: "#F3E5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                {group.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {group.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>
                  {group.membersCount} membre{group.membersCount !== 1 ? "s" : ""}
                  {group.country ? ` · 📍 ${group.country}` : ""}
                  {group.privacy === "private" ? " · 🔒 Privé" : " · 🌐 Public"}
                </div>
                {group.description && (
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {group.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Articles tab */}
      {!loading && activeTab === "articles" && q && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 16 }}>
            🛍️ Articles à vendre
            {(filterCountry || filterCategory) && (
              <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: "var(--fb-blue)" }}>
                {[filterCategory, filterCountry?.name].filter(Boolean).map(v => `· ${v}`).join(" ")}
              </span>
            )}
          </div>

          {products.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun article trouvé</div>
              <div style={{ fontSize: 13 }}>Aucun article ne correspond à « {q} »{filterCategory ? ` en ${filterCategory}` : ""}{ filterCountry ? ` au ${filterCountry.name}` : ""}.</div>
            </div>
          )}

          {products.map((product, idx) => (
            <div
              key={product.id}
              onClick={() => navigate(`/marketplace/${product.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: idx < products.length - 1 ? "1px solid var(--fb-divider)" : "none",
                transition: "background 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <div style={{ width: 52, height: 52, borderRadius: 8, background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {product.imageUrl
                  ? <img src={product.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 22 }}>🛍️</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {product.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--fb-blue)", fontWeight: 600, marginTop: 2 }}>
                  {product.price.toLocaleString("fr-FR")} {product.currency}
                </div>
                {product.location && (
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 1 }}>📍 {product.location}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Jobs tab */}
      {!loading && activeTab === "jobs" && q && (
        <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", fontWeight: 700, fontSize: 16 }}>
            💼 Offres d'emploi
            {filterCountry && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: "var(--fb-blue)" }}>· {filterCountry.name}</span>}
          </div>

          {jobs.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💼</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucune offre trouvée</div>
              <div style={{ fontSize: 13 }}>Aucune offre ne correspond à « {q} »{ filterCountry ? ` au ${filterCountry.name}` : ""}.</div>
            </div>
          )}

          {jobs.map((job, idx) => (
            <div
              key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: idx < jobs.length - 1 ? "1px solid var(--fb-divider)" : "none",
                transition: "background 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--fb-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <div style={{ width: 52, height: 52, borderRadius: 10, background: "#E3F2FD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                💼
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {job.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>
                  {job.company} · 📍 {job.location}
                </div>
                <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 1 }}>
                  {job.type}
                  {job.salary ? ` · ${Number(job.salary).toLocaleString("fr-FR")} ${job.currency}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
