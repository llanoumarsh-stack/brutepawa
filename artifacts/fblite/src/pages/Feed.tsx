import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "../router";
import { apiGetPosts, apiCreatePost, apiLikePost, apiGetStories, type FeedPost, type StoryGroup } from "../lib/api";
import StoryViewer from "../components/StoryViewer";
import { storyDraftStore } from "../lib/storyDraft";

const COUNTRY_FLAGS: Record<string, string> = {
  CI: "🇨🇮", SN: "🇸🇳", BJ: "🇧🇯", TG: "🇹🇬", BF: "🇧🇫", NE: "🇳🇪",
  ML: "🇲🇱", GN: "🇬🇳", CM: "🇨🇲", TD: "🇹🇩", GA: "🇬🇦", CG: "🇨🇬",
  CD: "🇨🇩", CF: "🇨🇫", GH: "🇬🇭",
};

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#212121","#D32F2F","#00838F"];

function getInitials(name: string) { return name.slice(0, 2).toUpperCase(); }
function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + " k";
  return String(n);
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d} j`;
}

export default function Feed() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "friends" | "marketplace" | "notifs" | "menu">("feed");

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);
  const storyFileRef = useRef<HTMLInputElement>(null);
  const [postMenuId, setPostMenuId] = useState<number | null>(null);

  const handleStoryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = "";
    const previewUrl = URL.createObjectURL(file);
    storyDraftStore.set({ file, previewUrl });
    navigate("/create-story");
  };

  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) as { id?: number; name: string; email: string; avatarUrl?: string; flag?: string } : { name: "Moi", email: "" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetPosts();
      setPosts(data);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStories = useCallback(async () => {
    try {
      const data = await apiGetStories();
      setStoryGroups(data);
    } catch {
      setStoryGroups([]);
    }
  }, []);

  useEffect(() => { loadPosts(); loadStories(); }, [loadPosts, loadStories]);

  const openStories = (groupIdx: number) => {
    setViewerGroupIdx(groupIdx);
    setViewerOpen(true);
  };

  const toggleLike = async (id: number) => {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    const action = post.liked ? "unlike" : "like";
    setPosts(ps => ps.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1 } : p
    ));
    try { await apiLikePost(id, action); } catch { loadPosts(); }
  };

  const submitPost = async () => {
    if (!newPost.trim() || submitting) return;
    setSubmitting(true);
    try {
      await apiCreatePost(newPost.trim());
      setNewPost("");
      setShowModal(false);
      await loadPosts();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("fb_user");
    localStorage.removeItem("bp_token");
    navigate("/login");
  };

  return (
    <>
      {viewerOpen && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={viewerGroupIdx}
          onClose={() => { setViewerOpen(false); loadStories(); }}
        />
      )}

      <nav className="navbar">
        <span className="navbar-logo">f</span>
        <input className="navbar-search" placeholder="🔍 Rechercher" readOnly />
        <div className="navbar-actions">
          <div className="relative">
            <button className="nav-btn" title="Messenger" onClick={() => navigate("/messages")}>💬</button>
            <span className="badge">3</span>
          </div>
          <div className="relative">
            <button className="nav-btn" title="Notifications">🔔</button>
            <span className="badge">7</span>
          </div>
          <button className="nav-btn" title="Déconnexion" onClick={logout} style={{ fontSize: 14 }}>
            {userInitials}
          </button>
        </div>
      </nav>

      <div className="feed-container">
        {/* ─── Stories Row ─── */}
        <input ref={storyFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleStoryFileSelect} />
        <div className="stories-row">
          {/* "Add story" card — triggers gallery directly */}
          <div className="story-card" onClick={() => storyFileRef.current?.click()} style={{ cursor: "pointer" }}>
            <div className="story-bg" style={{ background: "#e4e6e9", position: "relative", overflow: "hidden" }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="moi" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22 }}>{userInitials}</div>
              }
              <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 28, height: 28, borderRadius: "50%", background: "#1877F2", border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1 }}>+</div>
            </div>
            <div className="story-label">Créer une story</div>
          </div>

          {/* Real story groups */}
          {storyGroups.map((group, idx) => {
            const initials = getInitials(group.authorName);
            const avatarBg = AVATAR_COLORS[group.authorId % AVATAR_COLORS.length];
            const preview = group.stories[0];
            const hasBg = preview?.bgColor && !preview?.mediaUrl;

            return (
              <div
                key={group.authorId}
                className="story-card"
                onClick={() => openStories(idx)}
                style={{ cursor: "pointer" }}
              >
                <div
                  className="story-bg"
                  style={{
                    background: preview?.mediaUrl
                      ? `url(${preview.mediaUrl}) center/cover no-repeat`
                      : (preview?.bgColor ?? "#1877F2"),
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {preview?.emoji && !preview?.mediaUrl && (
                    <div style={{ fontSize: 32, position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{preview.emoji}</div>
                  )}
                  {preview?.content && !preview?.mediaUrl && !preview?.emoji && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", padding: "4px 6px", textAlign: "center", position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {preview.content.slice(0, 40)}
                    </div>
                  )}

                  {/* Author avatar ring */}
                  <div style={{
                    position: "absolute", top: 8, left: 8,
                    width: 34, height: 34, borderRadius: "50%",
                    border: "3px solid #1877F2",
                    background: avatarBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {group.authorAvatarUrl
                      ? <img src={group.authorAvatarUrl} alt={group.authorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{initials}</span>
                    }
                  </div>

                  {/* Count badge */}
                  {group.storiesCount > 1 && (
                    <div style={{ position: "absolute", top: 6, right: 6, background: "#1877F2", color: "#fff", borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, padding: "0 4px" }}>
                      {group.storiesCount}
                    </div>
                  )}
                </div>
                <div className="story-label">{group.authorName.split(" ")[0]}</div>
              </div>
            );
          })}

          {/* No stories yet */}
          {storyGroups.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", padding: "0 8px", color: "var(--fb-text-secondary)", fontSize: 12, fontStyle: "italic" }}>
              Sois le premier à partager une story !
            </div>
          )}
        </div>

        <div className="create-post-card">
          <div className="create-post-top">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="Avatar" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <div className="avatar">{userInitials}</div>
            }
            <button className="post-input-btn" onClick={() => setShowModal(true)}>
              Quoi de neuf, {user.name.split(" ")[0]} ?
            </button>
          </div>
          <div className="create-post-actions">
            <button className="action-btn" onClick={() => navigate("/create-post")}><span>🎬</span> Vidéo</button>
            <button className="action-btn" onClick={() => navigate("/create-post")}><span>📷</span> Photo</button>
            <button className="action-btn" onClick={() => setShowModal(true)}><span>😊</span> Humeur</button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 32, color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            Chargement des publications…
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 32, color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 700 }}>Aucune publication pour l'instant</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Soyez le premier à publier quelque chose !</div>
          </div>
        )}

        {posts.map(post => {
          const flag = COUNTRY_FLAGS[post.authorCountry] ?? "🌍";
          const initials = getInitials(post.authorName);
          return (
            <div key={post.id} className="post-card">
              <div className="post-header">
                {post.authorAvatarUrl
                  ? <img src={post.authorAvatarUrl} alt={post.authorName} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <div className="avatar" style={{ background: "#1877F2" }}>{initials}</div>
                }
                <div className="post-meta">
                  <div className="post-author">{post.authorName} {flag}</div>
                  <div className="post-time">🌐 {timeAgo(post.createdAt)}</div>
                </div>
                <button className="post-more" onClick={() => setPostMenuId(post.id)}>···</button>
              </div>
              <div className="post-content">{post.content}</div>
              {post.imageUrl && (
                <div style={{ margin: "8px 0" }}>
                  <img src={post.imageUrl} alt="" style={{ width: "100%", borderRadius: 8, maxHeight: 400, objectFit: "cover" }} />
                </div>
              )}
              <div className="post-stats">
                <span>{post.liked ? "❤️" : "👍"} {formatNumber(post.likesCount)}</span>
                <span>{post.commentsCount > 0 && `${formatNumber(post.commentsCount)} commentaires`}</span>
              </div>
              <div className="post-actions">
                <button className={`post-btn${post.liked ? " liked" : ""}`} onClick={() => toggleLike(post.id)}>
                  {post.liked ? "❤️" : "👍"} J'aime
                </button>
                <button className="post-btn">💬 Commenter</button>
                <button className="post-btn">↗️ Partager</button>
              </div>
            </div>
          );
        })}

        {!loading && posts.length > 0 && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--fb-text-secondary)", fontSize: 13 }}>
            Vous avez vu toutes les nouvelles publications
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        {([
          ["feed", "🏠"],
          ["friends", "👥"],
          ["marketplace", "🛍️"],
          ["notifs", "🔔"],
          ["menu", "☰"],
        ] as const).map(([tab, icon]) => (
          <button
            key={tab}
            className={`bottom-nav-btn${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {icon}
          </button>
        ))}
      </nav>

      {/* Post options bottom sheet */}
      {postMenuId !== null && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }}
          onClick={() => setPostMenuId(null)}
        >
          <div
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "20px 20px 0 0", padding: "8px 0 32px" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "8px auto 16px" }} />
            {[
              { icon: "📌", label: "Épingler la publication",         danger: false },
              { icon: "🔕", label: "Désactiver les notifications",    danger: false },
              { icon: "🔖", label: "Enregistrer",                     danger: false },
              { icon: "↗️", label: "Partager",                        danger: false },
              { icon: "🔒", label: "Modifier la confidentialité",     danger: false },
              { icon: "🗄️", label: "Déplacer dans l'archive",         danger: false },
              { icon: "🗑️", label: "Déplacer dans la corbeille",      danger: true  },
              { icon: "🔗", label: "Copier le lien",                  danger: false },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => setPostMenuId(null)}
                style={{
                  width: "100%", background: "none", border: "none",
                  padding: "14px 20px", display: "flex", alignItems: "center",
                  gap: 16, cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>{item.icon}</span>
                <span style={{ fontSize: 15, color: item.danger ? "#E53935" : "#050505" }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>Créer une publication</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="Avatar" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  : <div className="avatar">{userInitials}</div>
                }
                <div>
                  <div style={{ fontWeight: 700 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>🌐 Public</div>
                </div>
              </div>
              <textarea
                className="post-textarea"
                placeholder={`Quoi de neuf, ${user.name.split(" ")[0]} ?`}
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={submitPost}
                disabled={submitting || !newPost.trim()}
                style={{ opacity: newPost.trim() && !submitting ? 1 : 0.5 }}
              >
                {submitting ? "Publication…" : "Publier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
