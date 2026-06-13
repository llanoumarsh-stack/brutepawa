import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "../router";
import {
  apiGetGroup, apiJoinGroup, apiLeaveGroup,
  apiGetGroupPosts, apiCreateGroupPost,
  ApiGroupDetail, ApiGroupPost,
} from "../lib/api";

const AVATAR_COLORS = ["#1877F2", "#E91E63", "#9C27B0", "#FF9800", "#4CAF50", "#00BCD4", "#F44336", "#3F51B5"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(firstName: string, lastName: string) {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "??";
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "À l'instant";
  if (d < 3600) return `Il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `Il y a ${Math.floor(d / 3600)} h`;
  const days = Math.floor(d / 86400);
  if (days < 30) return `Il y a ${days} j`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return `Il y a ${Math.floor(days / 365)} an(s)`;
}

function AuthorAvatar({ id, firstName, lastName, avatarUrl, size = 40 }: {
  id: number; firstName: string; lastName: string; avatarUrl: string | null; size?: number;
}) {
  return avatarUrl
    ? <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: avatarColor(id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>{initials(firstName, lastName)}</div>;
}

export default function GroupDetailPage({ groupId }: { groupId: number }) {
  const navigate = useNavigate();
  const [group, setGroup] = useState<ApiGroupDetail | null>(null);
  const [posts, setPosts] = useState<ApiGroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const loadGroup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const g = await apiGetGroup(groupId);
      setGroup(g);
    } catch {
      setError("Impossible de charger ce groupe.");
    }
    setLoading(false);
  }, [groupId]);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const p = await apiGetGroupPosts(groupId);
      setPosts(p);
    } catch { /* ignore */ }
    setPostsLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadGroup();
    loadPosts();
  }, [loadGroup, loadPosts]);

  const handleJoin = async () => {
    if (!group) return;
    setActionLoading(true);
    try {
      await apiJoinGroup(group.id);
      setGroup(prev => prev ? { ...prev, isMember: true, membersCount: prev.membersCount + 1 } : prev);
      await loadPosts();
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handleLeave = async () => {
    if (!group) return;
    setActionLoading(true);
    try {
      await apiLeaveGroup(group.id);
      setGroup(prev => prev ? { ...prev, isMember: false, membersCount: Math.max(0, prev.membersCount - 1) } : prev);
      setPosts([]);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handlePost = async () => {
    if (!postContent.trim() || !group) return;
    setPosting(true);
    setPostError(null);
    try {
      await apiCreateGroupPost(group.id, postContent.trim());
      setPostContent("");
      await loadPosts();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Erreur lors de la publication");
    }
    setPosting(false);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 32, textAlign: "center", color: "var(--fb-text-secondary)" }}>
        Chargement…
      </div>
    );
  }

  if (error || !group) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{error ?? "Groupe introuvable"}</div>
        <button
          onClick={() => navigate("/community")}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--fb-blue)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          ← Retour aux groupes
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Cover / header */}
      <div style={{ position: "relative", background: group.coverUrl ? undefined : "linear-gradient(135deg, #1877F2 0%, #42A5F5 100%)", height: 180, overflow: "hidden" }}>
        {group.coverUrl && (
          <img src={group.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!group.coverUrl && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 64 }}>
            {group.emoji}
          </div>
        )}
        <button
          onClick={() => navigate("/community")}
          style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 18, backdropFilter: "blur(4px)" }}
        >
          ←
        </button>
      </div>

      {/* Info card */}
      <div style={{ background: "var(--fb-white)", padding: "16px 16px 20px", borderBottom: "1px solid var(--fb-divider)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 40, lineHeight: 1, flexShrink: 0, marginTop: 4 }}>{group.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{group.name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 6 }}>
              <span style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>
                {group.privacy === "public" ? "🌍 Groupe public" : "🔒 Groupe privé"}
              </span>
              <span style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>
                👥 {formatCount(group.membersCount)} membre{group.membersCount !== 1 ? "s" : ""}
              </span>
              {group.country && (
                <span style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>📍 {group.country}</span>
              )}
              <span style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>🗓 Créé {relTime(group.createdAt)}</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 12, background: "var(--fb-divider)", borderRadius: 12, padding: "3px 10px", fontWeight: 600, color: "var(--fb-text-secondary)" }}>
                {group.category}
              </span>
            </div>
          </div>
        </div>

        {group.description && (
          <p style={{ margin: "14px 0 0", fontSize: 14, color: "var(--fb-text)", lineHeight: 1.6 }}>
            {group.description}
          </p>
        )}

        {/* Join / Leave button */}
        <div style={{ marginTop: 16 }}>
          {group.isMember ? (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, padding: "11px 0", textAlign: "center", background: "var(--fb-divider)", borderRadius: 8, fontWeight: 700, fontSize: 14, color: "var(--fb-blue)" }}>
                ✓ Membre
              </div>
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                style={{ padding: "11px 18px", borderRadius: 8, border: "1px solid var(--fb-border)", background: "var(--fb-white)", color: "var(--fb-text)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                {actionLoading ? "…" : "Quitter"}
              </button>
            </div>
          ) : (
            <button
              onClick={group.privacy === "private" ? undefined : handleJoin}
              disabled={actionLoading || group.privacy === "private"}
              className="btn-primary"
              style={{ width: "100%", padding: "12px 0", fontSize: 15, fontWeight: 700, opacity: group.privacy === "private" ? 0.6 : 1 }}
            >
              {group.privacy === "private" ? "🔒 Groupe privé — invitation requise" : (actionLoading ? "…" : "+ Rejoindre le groupe")}
            </button>
          )}
        </div>
      </div>

      {/* Post composer (members only) */}
      {group.isMember && (
        <div style={{ background: "var(--fb-white)", margin: "12px 0 0", borderTop: "1px solid var(--fb-divider)", borderBottom: "1px solid var(--fb-divider)", padding: "12px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>📝 Nouvelle publication</div>
          <textarea
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            placeholder="Partagez quelque chose avec le groupe…"
            rows={3}
            style={{ width: "100%", resize: "vertical", borderRadius: 8, border: "1px solid var(--fb-border)", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", background: "var(--fb-bg)", color: "var(--fb-text)", boxSizing: "border-box" }}
          />
          {postError && (
            <div style={{ fontSize: 12, color: "var(--fb-red, #E41E3F)", marginTop: 4 }}>{postError}</div>
          )}
          <button
            onClick={handlePost}
            disabled={posting || !postContent.trim()}
            className="btn-primary"
            style={{ marginTop: 8, width: "auto", padding: "9px 20px", fontSize: 14, fontWeight: 700 }}
          >
            {posting ? "Publication…" : "Publier"}
          </button>
        </div>
      )}

      {/* Posts feed */}
      <div style={{ padding: "12px 12px 24px" }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Publications</div>

        {postsLoading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--fb-text-secondary)" }}>Chargement…</div>
        ) : !group.isMember && group.privacy === "private" ? (
          <div style={{ background: "var(--fb-white)", borderRadius: 12, border: "1px solid var(--fb-divider)", padding: "32px 20px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--fb-text)", marginBottom: 6 }}>Contenu réservé aux membres</div>
            <div style={{ fontSize: 13 }}>Ce groupe est privé. Demandez une invitation pour voir les publications.</div>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ background: "var(--fb-white)", borderRadius: 12, border: "1px solid var(--fb-divider)", padding: "32px 20px", textAlign: "center", color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--fb-text)", marginBottom: 6 }}>Aucune publication pour l'instant</div>
            <div style={{ fontSize: 13 }}>
              {group.isMember
                ? "Soyez le premier à partager quelque chose dans ce groupe."
                : "Rejoignez le groupe pour voir et partager des publications."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map(post => (
              <div key={post.id} style={{ background: "var(--fb-white)", borderRadius: 12, border: "1px solid var(--fb-divider)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <AuthorAvatar
                    id={post.authorId}
                    firstName={post.authorFirstName}
                    lastName={post.authorLastName}
                    avatarUrl={post.authorAvatarUrl}
                    size={38}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{post.authorFirstName} {post.authorLastName}</div>
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{relTime(post.createdAt)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fb-text)", whiteSpace: "pre-wrap" }}>{post.content}</div>
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt=""
                    style={{ marginTop: 10, width: "100%", borderRadius: 8, objectFit: "cover", maxHeight: 300 }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
