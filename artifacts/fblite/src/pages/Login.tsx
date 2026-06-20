import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "../router";
import { apiLogin, saveFbUser, setBpToken } from "../lib/api";
import {
  getPopularLanguages,
  searchLanguages,
  type Language,
} from "../services/languageService";

/* ─── Language Bottom Sheet ─── */
function LanguageSheet({
  current,
  onSelect,
  onClose,
}: {
  current: Language;
  onSelect: (l: Language) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = query.trim() ? searchLanguages(query) : getPopularLanguages();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation: "fadeIn 0.2s ease",
        }}
      />
      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9001,
        background: "#fff",
        borderRadius: "28px 28px 0 0",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        maxHeight: "82vh",
        display: "flex", flexDirection: "column",
        animation: "slideUpSheet 0.3s cubic-bezier(0.32,0.72,0,1)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 5, background: "#E2E8F0", borderRadius: 99 }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px" }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9.5" stroke="#22C55E" strokeWidth="1.6"/>
            <ellipse cx="11" cy="11" rx="4" ry="9.5" stroke="#22C55E" strokeWidth="1.6"/>
            <path d="M2 8h18M2 14h18" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Choisir une langue</span>
        </div>

        {/* Search */}
        <div style={{ padding: "0 16px 8px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#F3F4F6", borderRadius: 14,
            padding: "0 14px", height: 44,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#9CA3AF" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une langue"
              style={{
                flex: 1, border: "none", background: "none",
                fontSize: 15, color: "#111827", outline: "none",
                fontFamily: "inherit",
              }}
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
        </div>

        {/* Language list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "0 8px" }}>
          {results.map(lang => (
            <button
              key={lang.code}
              onClick={() => { onSelect(lang); onClose(); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14,
                height: 56, padding: "0 12px", borderRadius: 14,
                background: "none", border: "none", cursor: "pointer",
                textAlign: "left", transition: "background 0.12s",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{lang.flag}</span>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 500, color: "#111827", dir: lang.dir }}>
                {lang.nameNative}
              </span>
              {lang.code === current.code && (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l4.5 4.5L16 6" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
          {results.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 14 }}>
              Aucune langue trouvée
            </div>
          )}
        </div>

        {/* Région */}
        <div style={{ padding: "12px 20px 28px", borderTop: "1px solid #F3F4F6" }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Région de l'application
          </p>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            border: "1.5px solid #E5E7EB", borderRadius: 14,
            padding: "12px 16px",
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5C6.51 1.5 4.5 3.51 4.5 6c0 3.75 4.5 10.5 4.5 10.5s4.5-6.75 4.5-10.5c0-2.49-2.01-4.5-4.5-4.5z" stroke="#9CA3AF" strokeWidth="1.4"/>
              <circle cx="9" cy="6" r="1.5" stroke="#9CA3AF" strokeWidth="1.4"/>
            </svg>
            <span style={{ flex: 1, fontSize: 14, color: "#374151", fontWeight: 500 }}>Région actuelle : Bénin</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─── Main Login Page ─── */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLangSheet, setShowLangSheet] = useState(false);
  const [lang, setLang] = useState<Language>(getPopularLanguages()[0]);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Veuillez remplir tous les champs."); return; }
    setLoading(true); setError("");
    try {
      const { token, user } = await apiLogin(email, password);
      setBpToken(token); saveFbUser(user);
      const redirect = sessionStorage.getItem("bp_redirect");
      sessionStorage.removeItem("bp_redirect");
      navigate(redirect && redirect !== "/login" && redirect !== "/register" ? redirect : "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #f0fdf4 0%, #ffffff 45%, #f0fdf4 100%)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: "relative",
      overflowX: "hidden",
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes floatLogo {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .login-field {
          width: 100%; box-sizing: border-box;
          height: 64px;
          border: 1.5px solid #E5E7EB;
          border-radius: 18px;
          font-size: 15px; color: #111827;
          background: #fff;
          outline: none;
          transition: border-color 250ms, box-shadow 250ms;
          font-family: inherit;
        }
        .login-field:focus {
          border-color: #22C55E;
          box-shadow: 0 0 0 4px rgba(34,197,94,0.15);
        }
        .login-field::placeholder { color: #9CA3AF; }
        .btn-primary {
          width: 100%; height: 64px;
          background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
          border: none; border-radius: 18px;
          color: #fff; font-size: 20px; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          box-shadow: 0 4px 20px rgba(34,197,94,0.38);
          transition: transform 0.15s, box-shadow 0.15s;
          font-family: inherit; letter-spacing: -0.1px;
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(34,197,94,0.48);
        }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled {
          background: linear-gradient(135deg, #86efac 0%, #4ade80 100%);
          box-shadow: none; cursor: not-allowed;
        }
        .btn-outline {
          width: 100%; height: 64px;
          background: transparent;
          border: 2px solid #22C55E; border-radius: 18px;
          color: #16A34A; font-size: 16px; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
          font-family: inherit;
        }
        .btn-outline:hover {
          background: #f0fdf4;
          box-shadow: 0 0 0 4px rgba(34,197,94,0.10);
        }
        .btn-outline:active { transform: scale(0.98); }
        .lang-pill {
          display: flex; align-items: center; gap: 6px;
          height: 44px; padding: 0 16px;
          background: rgba(255,255,255,0.95);
          border: 1.5px solid #E5E7EB;
          border-radius: 99px;
          font-size: 15px; font-weight: 600; color: #111827;
          cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          transition: transform 0.12s, box-shadow 0.12s;
          font-family: inherit;
        }
        .lang-pill:active { transform: scale(1.03); }
      `}</style>

      {/* ── Déco bg cercles ── */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(22,163,74,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* ── Language pill (top left) ── */}
      <div style={{ position: "absolute", top: 24, left: 20, zIndex: 10 }}>
        <button className="lang-pill" onClick={() => setShowLangSheet(true)}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7.5" stroke="#22C55E" strokeWidth="1.5"/>
            <ellipse cx="9" cy="9" rx="3" ry="7.5" stroke="#22C55E" strokeWidth="1.5"/>
            <path d="M2 6.5h14M2 11.5h14" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>{lang.nameNative}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Contenu centré ── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        flex: 1, padding: "90px 20px 40px",
        maxWidth: 560, margin: "0 auto", width: "100%",
      }}>

        {/* ── Logo ── */}
        <div style={{
          width: 120, height: 120,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", marginBottom: 18,
        }}>
          {/* Halo derrière */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "rgba(34,197,94,0.08)",
          }} />
          <img
            src="/logo.png"
            alt="BrutePawa"
            style={{
              width: 120, height: 120,
              objectFit: "contain",
              animation: "floatLogo 6s ease-in-out infinite",
              position: "relative", zIndex: 1,
            }}
          />
        </div>

        {/* ── Titre ── */}
        <div style={{
          textAlign: "center", marginBottom: 10,
          animation: "fadeInUp 0.5s ease both",
        }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#111827", lineHeight: "1.15", letterSpacing: "-0.5px" }}>
            Connectez-vous
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#22C55E", lineHeight: "1.15", letterSpacing: "-0.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            au monde
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <circle cx="15" cy="15" r="13" stroke="#22C55E" strokeWidth="2"/>
              <ellipse cx="15" cy="15" rx="5.5" ry="13" stroke="#22C55E" strokeWidth="2"/>
              <path d="M2 10h26M2 20h26" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* ── Sous-titre ── */}
        <p style={{
          textAlign: "center", fontSize: 16, fontWeight: 500,
          color: "#6B7280", lineHeight: 1.5,
          maxWidth: 300, margin: "0 0 28px",
          animation: "fadeInUp 0.5s ease 0.1s both",
        }}>
          Créez, partagez, développez et monétisez{" "}
          <span style={{ color: "#22C55E", fontWeight: 600 }}>sans frontières.</span>
        </p>

        {/* ── Carte de connexion ── */}
        <div style={{
          width: "92%", maxWidth: 520,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 32,
          boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
          padding: "32px 28px",
          animation: "fadeInUp 0.6s ease 0.15s both",
          boxSizing: "border-box",
        }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Error */}
            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14,
                padding: "12px 16px", color: "#dc2626", fontSize: 13, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/><path d="M8 5v3.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="#dc2626"/></svg>
                {error}
              </div>
            )}

            {/* Champ téléphone / email */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 1 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="7" r="3.5" stroke="#22C55E" strokeWidth="1.6"/>
                  <path d="M3 18c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <input
                className="login-field"
                type="text"
                placeholder="Numéro de téléphone ou e-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                style={{ paddingLeft: 52, paddingRight: 20 }}
              />
            </div>

            {/* Champ mot de passe */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 1 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="9" width="12" height="9" rx="2.5" stroke="#22C55E" strokeWidth="1.6"/>
                  <path d="M7 9V7a3 3 0 016 0v2" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
                  <circle cx="10" cy="13.5" r="1.2" fill="#22C55E"/>
                </svg>
              </div>
              <input
                className="login-field"
                type={showPw ? "text" : "password"}
                placeholder="Mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                style={{ paddingLeft: 52, paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9CA3AF", display: "flex", alignItems: "center" }}
                tabIndex={-1}
              >
                {showPw ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="#9CA3AF" strokeWidth="1.5"/><circle cx="10" cy="10" r="2.5" stroke="#9CA3AF" strokeWidth="1.5"/><path d="M3 3l14 14" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="#9CA3AF" strokeWidth="1.5"/><circle cx="10" cy="10" r="2.5" stroke="#9CA3AF" strokeWidth="1.5"/></svg>
                )}
              </button>
            </div>

            {/* Remember me + Forgot password */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <div
                  onClick={() => setRememberMe(v => !v)}
                  style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: rememberMe ? "none" : "1.5px solid #D1D5DB",
                    background: rememberMe ? "#22C55E" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s", flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  {rememberMe && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>Se souvenir de moi</span>
              </label>
              <a href="#" style={{ fontSize: 14, fontWeight: 600, color: "#22C55E", textDecoration: "none" }}>
                Mot de passe oublié ?
              </a>
            </div>

            {/* Bouton Se connecter */}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                    <circle cx="10" cy="10" r="8" stroke="rgba(255,255,255,0.35)" strokeWidth="2.2"/>
                    <path d="M10 2a8 8 0 018 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
                  </svg>
                  Connexion…
                </>
              ) : (
                <>
                  Se connecter
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M4 11h14M12 5l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            </div>

            {/* Créer un compte */}
            <button type="button" className="btn-outline" onClick={() => navigate("/register")}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="7" r="3.5" stroke="#16A34A" strokeWidth="1.6"/>
                <path d="M3 18c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M16 11v5M13.5 13.5h5" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Créer un compte
            </button>
          </form>
        </div>

        {/* ── Sécurisé footer ── */}
        <div style={{
          marginTop: 28, display: "flex", alignItems: "center", gap: 7,
          color: "#9CA3AF", fontSize: 13, fontWeight: 500,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L2 4v4c0 3.5 2.667 6.5 6 7 3.333-.5 6-3.5 6-7V4L8 1.5z" stroke="#9CA3AF" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M5.5 8l2 2 3-3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Sécurisé. Privé. Sans limites.
        </div>
      </div>

      {/* Language sheet */}
      {showLangSheet && (
        <LanguageSheet
          current={lang}
          onSelect={setLang}
          onClose={() => setShowLangSheet(false)}
        />
      )}
    </div>
  );
}
