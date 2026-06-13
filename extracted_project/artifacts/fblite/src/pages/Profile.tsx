import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { useR2Upload } from "../hooks/useR2Upload";
import { apiGetMe, apiUpdateMe, saveFbUser, apiGetFriends, apiGetUserPosts, type PublicUser, type FeedPost } from "../lib/api";
import { computeScore, type ScoreFactors } from "../lib/score";

export default function Profile() {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const localUser: {
    id?: number; name: string; email: string; flag?: string; country?: string;
    countryCode?: string; phone?: string; avatarUrl?: string; coverUrl?: string; bio?: string;
  } = rawUser ? JSON.parse(rawUser) : { name: "Utilisateur", email: "", flag: "🌍", country: "Afrique", countryCode: "CI" };

  const userInitials = localUser.name ? localUser.name.slice(0, 2).toUpperCase() : "ME";

  const [activeTab, setActiveTab] = useState<"posts" | "about" | "amis" | "photos">("posts");
  const [bio, setBio] = useState(localUser.bio || "Entrepreneur · Brute Pawa · " + (localUser.country || "Afrique francophone"));
  const [avatarUrl, setAvatarUrl] = useState<string>(localUser.avatarUrl ?? "");
  const [coverUrl, setCoverUrl] = useState<string>(localUser.coverUrl ?? "");
  const [uploadingWhat, setUploadingWhat] = useState<"avatar" | "cover" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef  = useRef<HTMLInputElement>(null);
  const { upload, progress, error: uploadErr } = useR2Upload();

  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);

  useEffect(() => {
    apiGetMe().then(user => {
      saveFbUser(user);
      setAvatarUrl(user.avatarUrl ?? "");
      setCoverUrl(user.coverUrl ?? "");
      if (user.bio) setBio(user.bio);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("fb_user");
    if (!raw) return;
    const u = JSON.parse(raw) as { id?: number };
    if (!u.id) return;
    Promise.all([apiGetUserPosts(u.id), apiGetFriends()])
      .then(([posts, friendList]) => {
        setMyPosts(posts);
        setFriends(friendList);
      })
      .catch(() => {});
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWhat("avatar");
    setUploadError(null);
    const result = await upload(file);
    if (result) {
      setAvatarUrl(result.url);
      try {
        const updated = await apiUpdateMe({ avatarUrl: result.url });
        saveFbUser(updated);
      } catch {
        setUploadError("Erreur de sauvegarde");
      }
    } else {
      setUploadError("Upload échoué");
    }
    setUploadingWhat(null);
    e.target.value = "";
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWhat("cover");
    setUploadError(null);
    const result = await upload(file);
    if (result) {
      setCoverUrl(result.url);
      try {
        const updated = await apiUpdateMe({ coverUrl: result.url });
        saveFbUser(updated);
      } catch {
        setUploadError("Erreur de sauvegarde");
      }
    } else {
      setUploadError("Upload échoué");
    }
    setUploadingWhat(null);
    e.target.value = "";
  };


  /* ── Score dynamique ── */
  let extData: Record<string, string> = {};
  try { extData = JSON.parse(localStorage.getItem("fb_profile_ext") ?? "{}"); } catch { /**/ }
  const scoreFactors: ScoreFactors = {
    avatarUrl,
    coverUrl,
    bio,
    phone: localUser.phone,
    postsCount: myPosts.length,
    friendsCount: friends.length,
    extCity: extData.city,
    extHometown: extData.hometown,
    extLanguages: extData.languages,
    extHobbies: extData.hobbies,
  };
  const score = computeScore(scoreFactors);

  const displayError = uploadError ?? uploadErr;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 20 }}>
      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
      <input ref={coverInputRef}  type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverChange} />

      {/* Back button */}
      <div style={{ background: "var(--fb-white)", padding: "10px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Profil</span>
      </div>

      {displayError && (
        <div style={{ background: "#ffebee", color: "#b00020", padding: "8px 16px", fontSize: 13, textAlign: "center" }}>
          {displayError.includes("401") || displayError.includes("Erreur 401")
            ? "⚠️ Session expirée — reconnecte-toi pour uploader des photos"
            : displayError}
        </div>
      )}

      {/* Cover photo */}
      <div
        className="profile-cover"
        style={{
          backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => !uploadingWhat && coverInputRef.current?.click()}
      >
        <div style={{
          position: "absolute", inset: 0,
          background: coverUrl ? "rgba(0,0,0,0.18)" : undefined,
          display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
          padding: 10,
        }}>
          {uploadingWhat === "cover" ? (
            <div style={{
              background: "rgba(0,0,0,0.65)", borderRadius: 20, padding: "5px 12px",
              color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
            }}>
              <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              {progress}%
            </div>
          ) : (
            <div style={{
              background: "rgba(0,0,0,0.55)", borderRadius: 20, padding: "5px 12px",
              color: "#fff", fontSize: 12, fontWeight: 600,
            }}>
              {coverUrl ? "✏️ Modifier" : "📷 Ajouter une couverture"}
            </div>
          )}
        </div>

        {localUser.flag && (
          <div style={{ position: "absolute", top: 12, right: 12, fontSize: 28, background: "rgba(255,255,255,0.9)", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", zIndex: 2 }}>
            {localUser.flag}
          </div>
        )}

        {/* Avatar */}
        <div className="profile-avatar-wrap" style={{ zIndex: 2 }}>
          <div
            onClick={e => { e.stopPropagation(); if (!uploadingWhat) avatarInputRef.current?.click(); }}
            style={{ position: "relative", cursor: "pointer", width: 86, height: 86 }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: 86, height: 86, borderRadius: "50%", border: "4px solid #fff", objectFit: "cover", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
            ) : (
              <div className="profile-avatar-lg">{userInitials}</div>
            )}
            {uploadingWhat === "avatar" ? (
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "#1877F2", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 11, height: 11, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              </div>
            ) : (
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "#1877F2", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>
                📷
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div style={{ background: "var(--fb-white)", paddingTop: 52, paddingBottom: 12, borderBottom: "1px solid var(--fb-divider)" }}>
        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="profile-name">{localUser.name}</div>
                <span style={{ color: "var(--fb-blue)", fontSize: 16 }}>✔️</span>
                <span style={{ fontSize: 18 }}>{score.emoji}</span>
                {localUser.flag && <span style={{ fontSize: 20 }}>{localUser.flag}</span>}
              </div>
              <div className="profile-bio">{bio}</div>
              {localUser.country && (
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 4 }}>
                  📍 {localUser.country}
                </div>
              )}
              <button
                onClick={() => navigate("/score")}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${score.color}22`, border: `1.5px solid ${score.color}`, borderRadius: 20, padding: "3px 10px", marginTop: 8, cursor: "pointer" }}
              >
                <span style={{ fontSize: 14 }}>{score.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: score.color }}>Niveau {score.label} · {score.pct}%</span>
              </button>
            </div>
            <button className="btn-secondary" style={{ width: "auto", padding: "6px 14px", fontSize: 13 }} onClick={() => navigate("/edit-profile")}>
              ✏️ Modifier
            </button>
          </div>

          <div style={{ display: "flex", gap: 20, marginTop: 12, marginBottom: 4 }}>
            {[
              { label: "Amis", value: String(friends.length) },
              { label: "Abonnés", value: "0" },
              { label: "Publications", value: String(myPosts.length) },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn-primary" style={{ flex: 1, padding: "9px" }}>+ Ajouter à l'histoire</button>
            <button className="btn-secondary" style={{ flex: 1, padding: "9px" }} onClick={() => navigate("/edit-profile")}>✏️ Modifier le profil</button>
          </div>
        </div>

        <div className="profile-tabs" style={{ marginTop: 16 }}>
          {([
            { id: "posts" as const, label: "Publications" },
            { id: "about" as const, label: "À propos" },
            { id: "amis" as const, label: "Amis" },
            { id: "photos" as const, label: "Photos" },
          ] as const).map(tab => (
            <button key={tab.id} className={`profile-tab${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px" }}>
        {/* PUBLICATIONS */}
        {activeTab === "posts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myPosts.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--fb-text-secondary)", fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                <div>Aucune publication pour l'instant</div>
              </div>
            )}
            {myPosts.map(post => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="Avatar" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <div className="avatar" style={{ background: "#1877F2" }}>{userInitials}</div>
                  }
                  <div className="post-meta">
                    <div className="post-author">
                      {localUser.name}
                      {localUser.flag && <span style={{ marginLeft: 4, fontSize: 14 }}>{localUser.flag}</span>}
                    </div>
                    <div className="post-time">🌐 {new Date(post.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>
                  </div>
                </div>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover" }} />
                )}
                <div className="post-content">{post.content}</div>
                <div className="post-actions">
                  <button className="post-btn">👍 {post.likesCount}</button>
                  <button className="post-btn">💬 {post.commentsCount}</button>
                  <button className="post-btn">↗️ Partager</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* À PROPOS */}
        {activeTab === "about" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Informations</div>
              {[
                { icon: "💼", label: bio },
                { icon: localUser.flag || "📍", label: `Habite à ${localUser.country || "Côte d'Ivoire"}` },
                { icon: "📞", label: localUser.phone || "Téléphone non spécifié" },
                { icon: "📧", label: localUser.email || "Email non spécifié" },
              ].map((info, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: i > 0 ? "1px solid var(--fb-divider)" : "none" }}>
                  <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{info.icon}</span>
                  <span style={{ fontSize: 14 }}>{info.label}</span>
                </div>
              ))}
            </div>
            {(() => {
              let hobbies: string[] = [];
              try {
                const ext = JSON.parse(localStorage.getItem("fb_profile_ext") ?? "{}");
                hobbies = (ext.hobbies ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
              } catch { /* ignore */ }
              return hobbies.length > 0 ? (
                <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Centres d'intérêt</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {hobbies.map(h => (
                      <span key={h} style={{ background: "var(--fb-blue-light)", color: "var(--fb-blue)", padding: "5px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{h}</span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
            <button
              onClick={() => navigate("/score")}
              style={{ background: "var(--fb-white)", borderRadius: 10, border: `1.5px solid ${score.color}`, padding: 16, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Score de confiance →</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 36 }}>{score.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: score.color }}>Niveau {score.label}</div>
                  <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Progression : {score.pct}%</div>
                  <div style={{ background: "var(--fb-bg)", borderRadius: 6, height: 6, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${score.pct}%`, background: score.color, borderRadius: 6 }} />
                  </div>
                  {score.nextLevel && score.pointsToNext !== null && (
                    <div style={{ fontSize: 11, color: "var(--fb-text-secondary)", marginTop: 4 }}>
                      {score.pointsToNext} pts pour le niveau {score.nextLevel}
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* AMIS */}
        {activeTab === "amis" && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>{friends.length} ami{friends.length !== 1 ? "s" : ""}</div>
            {friends.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--fb-text-secondary)", fontSize: 14 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
                <div>Aucun ami pour l'instant</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {friends.slice(0, 6).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                const inits = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                const COLORS = ["#1877F2","#E91E8C","#7B1FA2","#F57C00","#388E3C","#00838F"];
                const color = COLORS[u.id % COLORS.length];
                const FLAGS: Record<string,string> = { CI:"🇨🇮", SN:"🇸🇳", BJ:"🇧🇯", TG:"🇹🇬", BF:"🇧🇫", GH:"🇬🇭", ML:"🇲🇱" };
                const flag = u.country ? (FLAGS[u.country] ?? "🌍") : "🌍";
                return (
                  <div key={u.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
                    <div style={{ height: 80, background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 32, fontWeight: 700, position: "relative", overflow: "hidden" }}>
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : inits}
                      <span style={{ position: "absolute", top: 4, right: 6, fontSize: 16 }}>{flag}</span>
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                      <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>{u.country}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PHOTOS */}
        {activeTab === "photos" && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>Photos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
              {avatarUrl && (
                <div style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden", border: "2px solid var(--fb-blue)" }}>
                  <img src={avatarUrl} alt="Photo de profil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              {coverUrl && (
                <div style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden" }}>
                  <img src={coverUrl} alt="Photo de couverture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              {myPosts.filter(p => p.imageUrl).map(p => (
                <div key={p.id} style={{ aspectRatio: "1", borderRadius: 4, overflow: "hidden" }}>
                  <img src={p.imageUrl!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
              {!avatarUrl && !coverUrl && myPosts.filter(p => p.imageUrl).length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px 16px", color: "var(--fb-text-secondary)" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
                  <div>Aucune photo pour l'instant</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
