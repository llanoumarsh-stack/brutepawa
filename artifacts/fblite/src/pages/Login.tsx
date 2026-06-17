import { useState } from "react";
import { useNavigate } from "../router";
import { apiLogin, saveFbUser, setBpToken } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Veuillez remplir tous les champs."); return; }
    setLoading(true); setError("");
    try {
      const { token, user } = await apiLogin(email, password);
      setBpToken(token); saveFbUser(user); navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* ── Fond décoratif ── */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g1" cx="80%" cy="10%" r="55%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="g2" cx="10%" cy="85%" r="50%">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="g3" cx="60%" cy="50%" r="40%">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="390" height="844" fill="url(#g1)" />
        <rect width="390" height="844" fill="url(#g2)" />
        <rect width="390" height="844" fill="url(#g3)" />
        <circle cx="340" cy="60" r="120" fill="#22c55e" fillOpacity="0.05" />
        <circle cx="30" cy="200" r="80" fill="#16a34a" fillOpacity="0.06" />
        <circle cx="360" cy="700" r="140" fill="#22c55e" fillOpacity="0.05" />
        <circle cx="60" cy="750" r="60" fill="#4ade80" fillOpacity="0.07" />
        {/* Motif de points subtils */}
        {[...Array(6)].map((_, i) =>
          [...Array(4)].map((_, j) => (
            <circle key={`${i}-${j}`} cx={40 + j * 110} cy={120 + i * 130} r="1.5" fill="#22c55e" fillOpacity="0.15" />
          ))
        )}
        {/* Arc décoratif */}
        <path d="M -40 300 Q 100 180 260 280 T 430 260" stroke="#22c55e" strokeWidth="1" fill="none" strokeOpacity="0.1" />
        <path d="M -20 600 Q 150 500 300 580 T 420 560" stroke="#16a34a" strokeWidth="1" fill="none" strokeOpacity="0.08" />
      </svg>

      {/* ── Contenu principal ── */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", flex: 1, padding: "0 20px 32px", maxWidth: 440, margin: "0 auto", width: "100%" }}>

        {/* ── Logo ── */}
        <div style={{ marginTop: 52, marginBottom: 4, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src="/logo.png"
            alt="Brute Pawa"
            style={{
              width: 80, height: 80,
              borderRadius: 22,
              objectFit: "cover",
              boxShadow: "0 8px 32px rgba(34,197,94,0.35), 0 2px 8px rgba(34,197,94,0.2)",
              marginBottom: 14,
            }}
          />
          <span style={{ fontSize: 26, fontWeight: 800, color: "#16a34a", letterSpacing: "-0.5px", lineHeight: 1 }}>brutepawa</span>
        </div>

        {/* ── Slogan ── */}
        <p style={{ textAlign: "center", fontSize: 17, fontWeight: 600, color: "#111827", lineHeight: 1.45, margin: "20px 0 14px", letterSpacing: "-0.2px" }}>
          Connecte-toi, vends, recrute et développe ton activité partout en Afrique francophone.
        </p>

        {/* ── Badge de confiance ── */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 14,
          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
          border: "1px solid #bbf7d0",
          borderRadius: 50, padding: "7px 18px",
          marginBottom: 28,
        }}>
          {[
            { icon: "✓", label: "Simple" },
            { icon: "✓", label: "Sécurisé" },
            { icon: "✓", label: "100% Africain" },
          ].map(({ icon, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#15803d" }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, background: "#22c55e", borderRadius: "50%", color: "white", fontSize: 10, fontWeight: 800 }}>{icon}</span>
              {label}
            </span>
          ))}
        </div>

        {/* ── Carte de connexion ── */}
        <div style={{
          width: "100%",
          background: "#fff",
          borderRadius: 28,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)",
          padding: "28px 24px 24px",
        }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
                padding: "10px 14px", color: "#dc2626", fontSize: 13, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/><path d="M8 5v3.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="#dc2626"/></svg>
                {error}
              </div>
            )}

            {/* Champ email */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="4" width="15" height="10" rx="2" stroke="#9ca3af" strokeWidth="1.4"/><path d="M1.5 6.5l7.5 4.5 7.5-4.5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <input
                type="text"
                placeholder="Numéro de téléphone ou adresse e-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "14px 14px 14px 42px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 14,
                  fontSize: 15, color: "#111827",
                  background: "#fafafa",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.12)"; e.target.style.background = "#fff"; }}
                onBlur={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; e.target.style.background = "#fafafa"; }}
              />
            </div>

            {/* Champ mot de passe */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3.5" y="8" width="11" height="8" rx="2" stroke="#9ca3af" strokeWidth="1.4"/><path d="M6 8V6a3 3 0 016 0v2" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/><circle cx="9" cy="12" r="1.2" fill="#9ca3af"/></svg>
              </div>
              <input
                type={showPw ? "text" : "password"}
                placeholder="Mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "14px 44px 14px 42px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 14,
                  fontSize: 15, color: "#111827",
                  background: "#fafafa",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.12)"; e.target.style.background = "#fff"; }}
                onBlur={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; e.target.style.background = "#fafafa"; }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af", display: "flex", alignItems: "center" }}
                tabIndex={-1}
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 9s3-5.5 8-5.5S17 9 17 9s-3 5.5-8 5.5S1 9 1 9z" stroke="#6b7280" strokeWidth="1.4"/><circle cx="9" cy="9" r="2.2" stroke="#6b7280" strokeWidth="1.4"/><path d="M2 2l14 14" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 9s3-5.5 8-5.5S17 9 17 9s-3 5.5-8 5.5S1 9 1 9z" stroke="#6b7280" strokeWidth="1.4"/><circle cx="9" cy="9" r="2.2" stroke="#6b7280" strokeWidth="1.4"/></svg>
                )}
              </button>
            </div>

            {/* Bouton Se connecter */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "15px",
                background: loading ? "linear-gradient(135deg, #86efac 0%, #4ade80 100%)" : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                border: "none", borderRadius: 14,
                color: "#fff", fontSize: 16, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: loading ? "none" : "0 4px 16px rgba(34,197,94,0.4), 0 1px 4px rgba(34,197,94,0.2)",
                transition: "all 0.2s",
                letterSpacing: "0.1px",
                fontFamily: "inherit",
                marginTop: 2,
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(34,197,94,0.45)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? "none" : "0 4px 16px rgba(34,197,94,0.4), 0 1px 4px rgba(34,197,94,0.2)"; }}
            >
              {loading ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/><path d="M9 2a7 7 0 017 7" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                  Connexion en cours…
                </>
              ) : (
                <>
                  Se connecter
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10.5 5.5L14 9l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </>
              )}
            </button>

            {/* Mot de passe oublié */}
            <div style={{ textAlign: "center" }}>
              <a href="#" style={{ color: "#3b82f6", fontSize: 13.5, fontWeight: 500, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
              >Mot de passe oublié ?</a>
            </div>

            {/* Séparateur */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>

            {/* Créer un compte */}
            <button
              type="button"
              onClick={() => navigate("/register")}
              style={{
                width: "100%", padding: "14px",
                background: "#fff",
                border: "1.5px solid #22c55e",
                borderRadius: 14,
                color: "#16a34a", fontSize: 15, fontWeight: 700,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f0fdf4"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6.5" r="3" stroke="#16a34a" strokeWidth="1.5"/><path d="M3 15c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 9.5v4M12 11.5h4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Créer un compte
            </button>
          </form>
        </div>

        {/* ── Badge preuve sociale ── */}
        <div style={{
          marginTop: 20,
          display: "flex", alignItems: "center", gap: 10,
          background: "linear-gradient(135deg, #f0fdf4 0%, #fff 100%)",
          border: "1px solid #d1fae5",
          borderRadius: 16, padding: "11px 18px",
          width: "100%", boxSizing: "border-box",
        }}>
          <div style={{ display: "flex", flexShrink: 0 }}>
            {["#22c55e","#16a34a","#4ade80","#15803d"].map((c, i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: "2px solid #fff", marginLeft: i === 0 ? 0 : -8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700 }}>
                {["E","K","A","F"][i]}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
              {[1,2,3,4,5].map(s => (
                <svg key={s} width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1l1.1 2.2 2.4.35-1.75 1.7.41 2.4L5.5 6.5 3.35 7.65l.41-2.4L2.01 3.55l2.4-.35L5.5 1z" fill="#f59e0b"/></svg>
              ))}
              <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 2 }}>4.9/5</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#374151", fontWeight: 500, lineHeight: 1.3 }}>
              Rejoins des milliers d'entrepreneurs, vendeurs et recruteurs.
            </p>
          </div>
        </div>

        {/* ── Pied de page ── */}
        <footer style={{ marginTop: 28, textAlign: "center", width: "100%" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 8px", marginBottom: 10 }}>
            {["Français (France)", "English (US)", "العربية", "Português (Brasil)", "Español"].map(lang => (
              <a key={lang} href="#" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", fontWeight: 400 }}
                onMouseEnter={e => (e.currentTarget.style.color = "#22c55e")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
              >{lang}</a>
            ))}
          </div>
          <div style={{ height: 1, background: "#e5e7eb", marginBottom: 10 }} />
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 10px", marginBottom: 10 }}>
            {["Créer une Page", "Publicité", "Confidentialité", "Conditions", "Aide"].map(link => (
              <a key={link} href="#" style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#16a34a")}
                onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
              >{link}</a>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: "#d1d5db", fontWeight: 400 }}>Brute Pawa © 2025</p>
        </footer>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
