import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "../router";
import { useR2Upload } from "../hooks/useR2Upload";
import { apiGetMe, apiUpdateMe, saveFbUser, apiGetFriends, apiGetUserPosts, type PublicUser, type FeedPost } from "../lib/api";
import { computeScore, type ScoreFactors } from "../lib/score";
import ProModeModal from "../components/ProModeModal";
import ProfileStatusModal from "../components/ProfileStatusModal";
import ArchiveModal from "../components/ArchiveModal";
import ActivityHistoryModal from "../components/ActivityHistoryModal";
import FeaturedContentModal from "../components/FeaturedContentModal";
import DeactivateProModal from "../components/DeactivateProModal";
import VoirEnTantQueModal from "../components/VoirEnTantQueModal";
import LockProfileModal from "../components/LockProfileModal";
import ReviewTagsModal from "../components/ReviewTagsModal";
import TagReviewSettingsPage from "../components/TagReviewSettingsPage";

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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProMode, setShowProMode] = useState(false);
  const [isPro, setIsPro] = useState(() => localStorage.getItem("bp_pro_mode") === "1");
  const [showProfileStatus, setShowProfileStatus] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [showFeaturedContent, setShowFeaturedContent] = useState(false);
  const [showDeactivatePro, setShowDeactivatePro] = useState(false);
  const [showVoirEnTantQue, setShowVoirEnTantQue] = useState(false);
  const [showLockProfile, setShowLockProfile] = useState(false);
  const [showReviewTags, setShowReviewTags] = useState(false);
  const [showTagReviewSettings, setShowTagReviewSettings] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(() => localStorage.getItem("bp_profile_locked") === "1");

  const copyProfileLink = useCallback(() => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL ?? ""}profile/${localUser.id ?? ""}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setShowProfileMenu(false);
  }, [localUser.id]);

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
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#050505", display: "flex", alignItems: "center", padding: "4px 6px", borderRadius: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, flex: 1 }}>Profil</span>
        <button onClick={() => setShowProfileMenu(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#050505", padding: "6px 8px", borderRadius: 8, fontSize: 20, letterSpacing: 2, lineHeight: 1 }}>···</button>
      </div>

      {/* Profile options bottom sheet */}
      {showProfileMenu && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100 }}
          onClick={() => setShowProfileMenu(false)}
        >
          <div
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderRadius: "20px 20px 0 0", padding: "8px 0 32px" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "8px auto 16px" }} />
            {[
              { icon: "🟢", label: "Statut du profil",              action: () => { setShowProfileMenu(false); setShowProfileStatus(true); } },
              { icon: "🗄️", label: "Archive",                        action: () => { setShowProfileMenu(false); setShowArchive(true); } },
              { icon: "📊", label: "Historique d'activité",          action: () => { setShowProfileMenu(false); setShowActivityHistory(true); } },
              { icon: "👁️", label: "Examiner les publications",      action: () => { setShowProfileMenu(false); setShowTagReviewSettings(true); } },
              { icon: "⭐", label: "Ajouter des éléments à la une", action: () => { setShowProfileMenu(false); setShowFeaturedContent(true); } },
              { icon: isProfileLocked ? "🔓" : "🔒", label: isProfileLocked ? "Déverrouiller le profil" : "Verrouiller le profil", action: () => { setShowProfileMenu(false); setShowLockProfile(true); } },
              { icon: "👤", label: "Voir en tant que",               action: () => { setShowProfileMenu(false); setShowVoirEnTantQue(true); } },
              { icon: "🔍", label: "Rechercher",                     action: () => { setShowProfileMenu(false); navigate("/search"); } },
              ...(isPro ? [
                { icon: "⚡", label: "Mode pro activé ✓",            action: () => setShowProfileMenu(false) },
                { icon: "↩️", label: "Désactiver le mode professionnel", action: () => { setShowProfileMenu(false); setShowDeactivatePro(true); } },
              ] : [
                { icon: "⚡", label: "Activer le mode pro",          action: () => { setShowProfileMenu(false); setShowProMode(true); } },
              ]),
              { icon: "🔗", label: "Copier le lien du profil",       action: copyProfileLink },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{ width: "100%", background: "none", border: "none", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>{item.icon}</span>
                <span style={{ fontSize: 15, color: "#050505" }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {displayError && (
        <div style={{ background: "#ffebee", color: "#b00020", padding: "8px 16px", fontSize: 13, textAlign: "center" }}>
          {displayError.includes("401") || displayError.includes("Erreur 401")
            ? "Session expirée — reconnecte-toi pour uploader des photos"
            : displayError}
        </div>
      )}

      {/* ── Profile card ── */}
      <div style={{ background: "#fff", margin: "8px 10px 0", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", overflow: "visible" }}>

        {/* Cover photo */}
        <div
          className="profile-cover"
          style={{
            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            cursor: "pointer",
          }}
          onClick={() => !uploadingWhat && coverInputRef.current?.click()}
        >
          {/* Abstract SVG shapes — only when no custom cover */}
          {!coverUrl && (
            <svg style={{ position: "absolute", right: 0, top: 0, opacity: 0.18, pointerEvents: "none" }} width="260" height="200" viewBox="0 0 260 200" fill="none">
              <circle cx="210" cy="30" r="110" fill="white"/>
              <circle cx="250" cy="160" r="75" fill="white"/>
              <circle cx="140" cy="180" r="55" fill="white"/>
              <circle cx="230" cy="90" r="40" fill="white"/>
            </svg>
          )}

          {/* Flag — top right white circle */}
          <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3, width: 44, height: 44, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.22)", fontSize: 26 }}>
            {localUser.flag || "🌍"}
          </div>

          {/* Ajouter une couverture — bottom right */}
          <button
            onClick={e => { e.stopPropagation(); if (!uploadingWhat) coverInputRef.current?.click(); }}
            style={{ position: "absolute", bottom: 12, right: 12, zIndex: 3, background: "rgba(0,0,0,0.58)", borderRadius: 20, padding: "6px 13px", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            {uploadingWhat === "cover" ? (
              <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            )}
            {uploadingWhat === "cover" ? `${progress}%` : (coverUrl ? "Modifier" : "Ajouter une couverture")}
          </button>

          {/* Avatar — overlapping cover */}
          <div className="profile-avatar-wrap" style={{ zIndex: 4 }}>
            <div
              onClick={e => { e.stopPropagation(); if (!uploadingWhat) avatarInputRef.current?.click(); }}
              style={{ position: "relative", cursor: "pointer" }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: 92, height: 92, borderRadius: "50%", border: "5px solid #fff", objectFit: "cover", display: "block", boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }} />
              ) : (
                <div className="profile-avatar-lg">{userInitials}</div>
              )}
              {/* Camera icon */}
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: "50%", background: "#1877F2", border: "2.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
                {uploadingWhat === "avatar"
                  ? <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Profile info */}
        <div style={{ paddingTop: 54, paddingBottom: 4 }}>
          <div style={{ padding: "0 14px" }}>

            {/* Name row + Modifier button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                {/* Name + badges */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span className="profile-name">{localUser.name}</span>
                  {/* Verified green badge */}
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#2ECC40", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  {/* Medal badge */}
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#f0f0f0", border: "1.5px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="15" r="6" stroke="#888" strokeWidth="1.8"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" stroke="#888" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="12" cy="15" r="3" fill="#C0C0C0"/></svg>
                  </div>
                  {/* Flag */}
                  {localUser.flag && <span style={{ fontSize: 18 }}>{localUser.flag}</span>}
                </div>

                {/* Bio */}
                <div className="profile-bio">{bio}</div>

                {/* Location */}
                {(localUser.countryCode || localUser.country) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, color: "#65676b", fontSize: 13 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#65676b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {localUser.countryCode || localUser.country}
                  </div>
                )}

                {/* Level badge */}
                <button
                  onClick={() => navigate("/score")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f0faf0", border: "1.5px solid #c3eacc", borderRadius: 20, padding: "4px 11px", marginTop: 8, cursor: "pointer" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="15" r="5" stroke="#888" strokeWidth="1.8"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" stroke="#888" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="12" cy="15" r="2.5" fill="#C0C0C0"/></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2ECC40" }}>Niveau {score.label} · {score.pct}%</span>
                </button>
              </div>

              {/* Modifier button */}
              <button
                onClick={() => navigate("/edit-profile")}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff", border: "1.5px solid #ccc", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, color: "#050505", cursor: "pointer", flexShrink: 0, marginTop: 4 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Modifier
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 24, marginTop: 14, marginBottom: 4 }}>
              {[
                { label: "Amis",        value: String(friends.length) },
                { label: "Abonnés",     value: "0" },
                { label: "Publications", value: String(myPosts.length) },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontWeight: 900, fontSize: 19, color: "#050505", lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#65676b", marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 14 }}>
              <button
                className="btn-primary"
                style={{ flex: 1, padding: "9px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 700, borderRadius: 8 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Ajouter à l'histoire
              </button>
              <button
                onClick={() => navigate("/edit-profile")}
                style={{ flex: 1, padding: "9px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 700, borderRadius: 8, background: "#fff", border: "1.5px solid #ccc", color: "#050505", cursor: "pointer" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Modifier le profil
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="profile-tabs">
            {([
              { id: "posts"  as const, label: "Publications" },
              { id: "about"  as const, label: "À propos" },
              { id: "amis"   as const, label: "Amis" },
              { id: "photos" as const, label: "Photos" },
            ] as const).map(tab => (
              <button key={tab.id} className={`profile-tab${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
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
                {post.imageUrl && (() => {
                  const url = post.imageUrl!;
                  const isVid = /\.(mp4|mov|webm|ogg|m4v)(\?.*)?$/i.test(url);
                  return isVid
                    ? <video src={url} controls playsInline style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block", background: "#000" }} />
                    : <img src={url} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover" }} />;
                })()}
                {post.content && <div className="post-content">{post.content}</div>}
                <div className="post-actions">
                  <button className="post-btn" style={{ display:"flex",alignItems:"center",gap:5 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>{post.likesCount}</button>
                  <button className="post-btn" style={{ display:"flex",alignItems:"center",gap:5 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>{post.commentsCount}</button>
                  <button className="post-btn" style={{ display:"flex",alignItems:"center",gap:5 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Partager</button>
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

      {showProMode && (
        <ProModeModal
          onClose={() => setShowProMode(false)}
          onActivated={() => setIsPro(true)}
        />
      )}

      {showProfileStatus && (
        <ProfileStatusModal
          userName={localUser.name}
          avatarUrl={avatarUrl || undefined}
          onClose={() => setShowProfileStatus(false)}
        />
      )}

      {showArchive && (
        <ArchiveModal onClose={() => setShowArchive(false)} />
      )}

      {showActivityHistory && (
        <ActivityHistoryModal
          onClose={() => setShowActivityHistory(false)}
          userId={localUser.id}
          userName={localUser.name}
        />
      )}

      {showFeaturedContent && (
        <FeaturedContentModal
          onClose={() => setShowFeaturedContent(false)}
          userId={localUser.id}
        />
      )}

      {showDeactivatePro && (
        <DeactivateProModal
          onClose={() => setShowDeactivatePro(false)}
          onDeactivated={() => setIsPro(false)}
        />
      )}

      {showVoirEnTantQue && (
        <VoirEnTantQueModal
          onClose={() => setShowVoirEnTantQue(false)}
          userName={localUser.name}
          avatarUrl={avatarUrl || undefined}
          bio={bio}
          country={localUser.country}
          flag={localUser.flag}
          friendsCount={friends.length}
          postsCount={myPosts.length}
        />
      )}

      {showLockProfile && (
        <LockProfileModal
          onClose={() => setShowLockProfile(false)}
          currentlyLocked={isProfileLocked}
          onToggle={(locked) => setIsProfileLocked(locked)}
        />
      )}

      {showReviewTags && (
        <ReviewTagsModal onClose={() => setShowReviewTags(false)} />
      )}

      {showTagReviewSettings && (
        <TagReviewSettingsPage
          onClose={() => setShowTagReviewSettings(false)}
          onOpenTagReview={() => {
            setShowTagReviewSettings(false);
            setShowReviewTags(true);
          }}
        />
      )}
    </div>
  );
}
