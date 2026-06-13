import { useState } from "react";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiRegister, saveFbUser, setBpToken } from "../lib/api";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - 4 - i);

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    phone: "", countryCode: "CI",
    password: "", day: "1", month: "1", year: String(currentYear - 20),
    gender: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const selectedCountry = COUNTRIES.find(c => c.code === form.countryCode) ?? COUNTRIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || (!form.email && !form.phone)) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (!form.gender) {
      setError("Veuillez indiquer votre genre.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const phone = form.phone ? `${selectedCountry.phone} ${form.phone}` : `${selectedCountry.phone} 00000000`;
      const email = form.email || `${form.phone.replace(/\s/g, "")}@brutepawa.com`;
      const { token, user } = await apiRegister({
        firstName: form.firstName,
        lastName: form.lastName,
        email,
        phone,
        password: form.password,
        country: form.countryCode,
      });
      setBpToken(token);
      saveFbUser(user);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-modal">
        <div className="register-header">
          <div className="register-title">Créer un compte</div>
          <div className="register-subtitle">C'est rapide et facile.</div>
        </div>
        <form className="register-form" onSubmit={handleSubmit}>
          {error && <div style={{ color: "#b00020", fontSize: 13, background: "#fff0f0", padding: "8px 12px", borderRadius: 6 }}>{error}</div>}

          <div className="name-row">
            <input placeholder="Prénom" value={form.firstName} onChange={set("firstName")} disabled={loading} />
            <input placeholder="Nom de famille" value={form.lastName} onChange={set("lastName")} disabled={loading} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "var(--fb-text-secondary)", fontWeight: 600 }}>Pays</label>
            <select value={form.countryCode} onChange={set("countryCode")} style={{ background: "var(--fb-white)", fontFamily: "inherit" }} disabled={loading}>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", background: "var(--fb-bg)", border: "1px solid var(--fb-border)", borderRadius: 6, padding: "0 12px", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", color: "var(--fb-text-secondary)" }}>
              {selectedCountry.flag} {selectedCountry.phone}
            </div>
            <input
              placeholder="Numéro de téléphone"
              value={form.phone}
              onChange={set("phone")}
              type="tel"
              style={{ flex: 1 }}
              disabled={loading}
            />
          </div>

          <input
            placeholder="Adresse e-mail (optionnel)"
            value={form.email}
            onChange={set("email")}
            type="email"
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Nouveau mot de passe (min. 6 caractères)"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            disabled={loading}
          />

          <div className="label-sm">Date de naissance</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={form.day} onChange={set("day")} style={{ flex: 1 }} disabled={loading}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={form.month} onChange={set("month")} style={{ flex: 1.5 }} disabled={loading}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={form.year} onChange={set("year")} style={{ flex: 1.3 }} disabled={loading}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="label-sm">Genre</div>
          <div className="gender-row">
            <label className="gender-option">
              Femme
              <input type="radio" name="gender" value="F" checked={form.gender === "F"} onChange={set("gender")} disabled={loading} />
            </label>
            <label className="gender-option">
              Homme
              <input type="radio" name="gender" value="M" checked={form.gender === "M"} onChange={set("gender")} disabled={loading} />
            </label>
            <label className="gender-option">
              Autre
              <input type="radio" name="gender" value="O" checked={form.gender === "O"} onChange={set("gender")} disabled={loading} />
            </label>
          </div>

          <p className="terms-text">
            En cliquant sur S'inscrire, vous acceptez nos <a href="#">Conditions générales</a>,
            notre <a href="#">Politique de confidentialité</a> et notre <a href="#">Politique relative aux cookies</a>.
          </p>

          <div className="register-btn-wrap">
            <button type="submit" className="btn-green" style={{ padding: "12px 48px", fontSize: 17 }} disabled={loading}>
              {loading ? "Inscription…" : "S'inscrire"}
            </button>
          </div>

          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate("/login"); }} style={{ fontSize: 14, fontWeight: 600 }}>
              Vous avez déjà un compte ?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
