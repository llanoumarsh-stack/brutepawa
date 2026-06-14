import { useState } from "react";
import { useNavigate } from "../router";
import { apiLogin, saveFbUser, setBpToken } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token, user } = await apiLogin(email, password);
      setBpToken(token);
      saveFbUser(user);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <img src="/logo.png" alt="Brute Pawa" style={{ width: 96, height: 96, borderRadius: 22, marginBottom: 8, display: "block", marginLeft: "auto", marginRight: "auto" }} />
      <p className="fb-tagline">Connecte-toi, vends, recrute et développe ton activité partout en Afrique francophone.</p>

      <div className="login-card">
        <form className="login-form" onSubmit={handleLogin}>
          {error && <div style={{ color: "#b00020", fontSize: 14, textAlign: "center" }}>{error}</div>}
          <input
            type="text"
            placeholder="Adresse e-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading} style={{ background: loading ? "#36A420" : "#42B72A", boxShadow: "0 2px 8px rgba(66,183,42,0.35)" }}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>
          <div className="forgotten-link">
            <a href="#">Mot de passe oublié ?</a>
          </div>
          <div className="divider"><span>ou</span></div>
          <div style={{ textAlign: "center" }}>
            <button type="button" className="btn-green" style={{ padding: "12px 24px", fontSize: 15 }} onClick={() => navigate("/register")}>
              Créer un compte
            </button>
          </div>
        </form>
      </div>

      <footer className="fb-footer">
        <div>
          <a href="#">Français (France)</a>
          {" · "}
          <a href="#">English (US)</a>
          {" · "}
          <a href="#">العربية</a>
          {" · "}
          <a href="#">Português (Brasil)</a>
          {" · "}
          <a href="#">Español</a>
        </div>
        <div style={{ marginTop: 8 }}>
          <a href="#">Créer une Page</a>
          {" · "}
          <a href="#">Publicité</a>
          {" · "}
          <a href="#">Confidentialité</a>
          {" · "}
          <a href="#">Conditions</a>
          {" · "}
          <a href="#">Aide</a>
        </div>
        <div style={{ marginTop: 8 }}>Brute Pawa © 2025</div>
      </footer>
    </div>
  );
}
