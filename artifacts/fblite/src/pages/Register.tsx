import { useState } from "react";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiRegister, saveFbUser, setBpToken } from "../lib/api";

const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const currentYear = new Date().getFullYear();
const YEARS  = Array.from({ length: 100 }, (_, i) => currentYear - 4 - i);

type ContactMode = "phone" | "email";

interface Form {
  firstName: string; lastName: string;
  day: string; month: string; year: string;
  gender: string; customGender: string;
  contactMode: ContactMode;
  phone: string; countryCode: string; email: string;
  password: string;
  code: string;
}

const INIT: Form = {
  firstName: "", lastName: "",
  day: "1", month: "1", year: String(currentYear - 20),
  gender: "", customGender: "",
  contactMode: "phone",
  phone: "", countryCode: "CI", email: "",
  password: "",
  code: "",
};

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "Créer un compte",
  "Quand êtes-vous né(e) ?",
  "Votre genre",
  "Coordonnées de contact",
  "Mot de passe",
  "Code de confirmation",
];

const STEP_SUBTITLES = [
  "C'est rapide et facile.",
  "Indiquez votre date de naissance.",
  "Vous pourrez le modifier sur votre profil.",
  "Choisissez comment vous connecter.",
  "Protégez votre compte.",
  "Vérifiez votre identité.",
];

/* ── Shared field style ── */
const fieldBase: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "14px 14px 14px 42px",
  border: "1.5px solid #e5e7eb",
  borderRadius: 14,
  fontSize: 15, color: "#111827",
  background: "#fafafa",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const selectBase: React.CSSProperties = {
  ...fieldBase,
  paddingLeft: 14,
  appearance: "none" as React.CSSProperties["appearance"],
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
};

function fieldFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "#22c55e";
  e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.12)";
  e.target.style.background = "#fff";
}
function fieldBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "#e5e7eb";
  e.target.style.boxShadow = "none";
  e.target.style.background = "#fafafa";
}

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState<Form>(INIT);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const selectedCountry = COUNTRIES.find(c => c.code === form.countryCode) ?? COUNTRIES[0];

  const next = () => { setError(""); setStep(s => s + 1); };
  const back = () => { setError(""); setStep(s => s - 1); };

  const validate = () => {
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim())
        return setError("Veuillez entrer votre prénom et votre nom de famille.");
    }
    if (step === 2) {
      const y = parseInt(form.year), m = parseInt(form.month), d = parseInt(form.day);
      const age = currentYear - y - (new Date().getMonth() + 1 < m || (new Date().getMonth() + 1 === m && new Date().getDate() < d) ? 1 : 0);
      if (age < 13) return setError("Vous devez avoir au moins 13 ans pour vous inscrire.");
    }
    if (step === 3 && !form.gender)
      return setError("Veuillez sélectionner votre genre.");
    if (step === 4) {
      if (form.contactMode === "phone" && !form.phone.trim())
        return setError("Veuillez entrer un numéro de téléphone valide.");
      if (form.contactMode === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        return setError("Veuillez entrer une adresse e-mail valide.");
    }
    if (step === 5 && form.password.length < 6)
      return setError("Le mot de passe doit contenir au moins 6 caractères.");
    if (step === 6 && form.code.trim().length < 5)
      return setError("Veuillez entrer le code de confirmation à 6 chiffres.");
    setError("");
    return true;
  };

  const handleNext = () => { if (validate() === true) next(); };

  const handleSubmit = async () => {
    if (validate() !== true) return;
    setLoading(true);
    try {
      const phone = form.contactMode === "phone"
        ? `${selectedCountry.phone} ${form.phone}`
        : `${selectedCountry.phone} 00000000`;
      const email = form.contactMode === "email"
        ? form.email
        : `${form.phone.replace(/\s/g,"")}@brutepawa.com`;
      const { token, user } = await apiRegister({
        firstName: form.firstName, lastName: form.lastName,
        email, phone, password: form.password,
        country: form.countryCode,
      });
      setBpToken(token); saveFbUser(user); navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription.");
      setLoading(false);
    }
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
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideBack { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .reg-step { animation: slideIn 0.22s ease; }
        .reg-step-back { animation: slideBack 0.22s ease; }
        .reg-field:focus { border-color: #22c55e !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.12) !important; background: #fff !important; }
        .reg-tab-btn { flex: 1; padding: 10px 0; background: none; border: none; border-bottom: 2.5px solid transparent; font-size: 14px; font-weight: 600; color: #9ca3af; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .reg-tab-btn.active { color: #16a34a; border-bottom-color: #22c55e; }
        .reg-radio-opt { display: flex; align-items: center; justify-content: space-between; border: 1.5px solid #e5e7eb; border-radius: 14px; padding: 13px 16px; cursor: pointer; font-size: 15px; color: #111827; font-weight: 500; transition: all 0.15s; background: #fafafa; }
        .reg-radio-opt:hover { border-color: #22c55e; background: #f0fdf4; }
        .reg-radio-opt.selected { border-color: #22c55e; background: #f0fdf4; color: #16a34a; }
        .reg-next-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border: none; border-radius: 14px; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(34,197,94,0.38); transition: all 0.2s; font-family: inherit; letter-spacing: 0.1px; }
        .reg-next-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(34,197,94,0.45); }
        .reg-next-btn:disabled { background: linear-gradient(135deg, #86efac 0%, #4ade80 100%); box-shadow: none; cursor: not-allowed; }
        .reg-login-btn { width: 100%; padding: 14px; background: #fff; border: 1.5px solid #22c55e; border-radius: 14px; color: #16a34a; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; font-family: inherit; }
        .reg-login-btn:hover { background: #f0fdf4; transform: translateY(-1px); }
      `}</style>

      {/* ── Fond décoratif ── */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} viewBox="0 0 390 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="rg1" cx="85%" cy="8%" r="50%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.11" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rg2" cx="5%" cy="88%" r="50%">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="390" height="900" fill="url(#rg1)" />
        <rect width="390" height="900" fill="url(#rg2)" />
        <circle cx="345" cy="55" r="110" fill="#22c55e" fillOpacity="0.05" />
        <circle cx="25" cy="180" r="70" fill="#16a34a" fillOpacity="0.06" />
        <circle cx="355" cy="820" r="130" fill="#22c55e" fillOpacity="0.05" />
        <circle cx="50" cy="760" r="55" fill="#4ade80" fillOpacity="0.07" />
        {[...Array(5)].map((_, i) => [...Array(4)].map((_, j) => (
          <circle key={`${i}-${j}`} cx={45 + j * 110} cy={130 + i * 150} r="1.4" fill="#22c55e" fillOpacity="0.14" />
        )))}
        <path d="M -30 280 Q 120 170 270 260 T 420 240" stroke="#22c55e" strokeWidth="1" fill="none" strokeOpacity="0.09" />
      </svg>

      {/* ── Contenu ── */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", flex: 1, padding: "0 20px 32px", maxWidth: 440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

        {/* Logo */}
        <div style={{ marginTop: 44, marginBottom: 4, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 28px rgba(34,197,94,0.32)",
            marginBottom: 12, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg,rgba(255,255,255,0.17) 0%,transparent 100%)", borderRadius: "20px 20px 0 0" }} />
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
              <text x="10" y="29" fontSize="26" fontWeight="800" fontFamily="Inter,sans-serif" fill="white">b</text>
              <circle cx="31" cy="27" r="6.5" fill="white" fillOpacity="0.9" />
              <circle cx="28.8" cy="27" r="1.3" fill="#16a34a" />
              <circle cx="31" cy="27" r="1.3" fill="#16a34a" />
              <circle cx="33.2" cy="27" r="1.3" fill="#16a34a" />
            </svg>
          </div>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#16a34a", letterSpacing: "-0.5px" }}>brutepawa</span>
        </div>

        {/* Slogan */}
        <p style={{ textAlign: "center", fontSize: 14.5, fontWeight: 500, color: "#374151", lineHeight: 1.5, margin: "12px 0 20px" }}>
          Rejoignez la première plateforme sociale et professionnelle dédiée à l'Afrique francophone.
        </p>

        {/* ── Carte d'inscription ── */}
        <div style={{
          width: "100%",
          background: "#fff",
          borderRadius: 28,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)",
          padding: "24px 22px 22px",
          boxSizing: "border-box",
        }}>

          {/* En-tête de carte */}
          {step === 1 ? (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
                    {STEP_TITLES[0]}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2, fontWeight: 400 }}>C'est rapide et facile.</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Étape </span>
                  <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 800 }}>1</span>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}> sur {TOTAL_STEPS}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <button
                  onClick={back}
                  style={{ background: "#f3f4f6", border: "none", borderRadius: 10, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1.2, flex: 1 }}>
                  {STEP_TITLES[step - 1]}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Étape </span>
                  <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 800 }}>{step}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}> sur {TOTAL_STEPS}</span>
                </div>
              </div>
            </div>
          )}

          {/* Barre de progression */}
          <div style={{ marginBottom: step === 1 ? 20 : 4, marginTop: 6 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 5, borderRadius: 3,
                  background: i + 1 <= step
                    ? `linear-gradient(90deg, #22c55e, #16a34a)`
                    : "#e5e7eb",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
            {step > 1 && (
              <div style={{ marginTop: 5, marginBottom: 14, fontSize: 12, fontWeight: 600, color: "#16a34a" }}>
                {Math.round((step / TOTAL_STEPS) * 100)}% complété
              </div>
            )}
          </div>

          {/* Erreur */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 14px", color: "#dc2626", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/><path d="M8 5v3.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="#dc2626"/></svg>
              {error}
            </div>
          )}

          {/* ═══════════════════════════════════════════
              ÉTAPE 1 : Prénom + Nom
          ═══════════════════════════════════════════ */}
          {step === 1 && (
            <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                {/* Prénom */}
                <div style={{ flex: 1, position: "relative" }}>
                  <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="5.5" r="2.8" stroke="#9ca3af" strokeWidth="1.4"/><path d="M2.5 14c0-3.314 2.686-4.5 6-4.5s6 1.186 6 4.5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  </div>
                  <input
                    className="reg-field"
                    style={fieldBase}
                    placeholder="Prénom"
                    value={form.firstName}
                    onChange={set("firstName")}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                    autoFocus
                  />
                </div>
                {/* Nom */}
                <div style={{ flex: 1, position: "relative" }}>
                  <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="2" y="3" width="13" height="11" rx="2" stroke="#9ca3af" strokeWidth="1.4"/><path d="M5 7h7M5 10h5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  </div>
                  <input
                    className="reg-field"
                    style={fieldBase}
                    placeholder="Nom de famille"
                    value={form.lastName}
                    onChange={set("lastName")}
                    onFocus={fieldFocus}
                    onBlur={fieldBlur}
                  />
                </div>
              </div>

              <button className="reg-next-btn" onClick={handleNext}>
                Suivant
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10.5 5.5L14 9l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>

              {/* Mentions légales */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M8 1.5L2 4v4c0 3.5 2.5 6.3 6 7 3.5-.7 6-3.5 6-7V4L8 1.5z" stroke="#22c55e" strokeWidth="1.3" fill="none"/>
                  <path d="M5.5 8l2 2 3-3" stroke="#22c55e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.55 }}>
                  En cliquant sur Suivant, vous acceptez nos <a href="#" style={{ color: "#3b82f6", textDecoration: "none" }}>Conditions</a>,{" "}
                  notre <a href="#" style={{ color: "#3b82f6", textDecoration: "none" }}>Politique de confidentialité</a> et notre{" "}
                  <a href="#" style={{ color: "#3b82f6", textDecoration: "none" }}>Politique relative aux cookies</a>.
                </p>
              </div>

              {/* Séparateur */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>ou</span>
                <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              </div>

              <button className="reg-login-btn" onClick={() => navigate("/login")}>
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="5.5" r="2.8" stroke="#16a34a" strokeWidth="1.4"/><path d="M2.5 14c0-3.314 2.686-4.5 6-4.5s6 1.186 6 4.5" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Vous avez déjà un compte ?{" "}
                <strong>Connectez-vous</strong>
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              ÉTAPE 2 : Date de naissance
          ═══════════════════════════════════════════ */}
          {step === 2 && (
            <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Label section */}
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", fontWeight: 600, letterSpacing: 0.2 }}>
                Votre date de naissance
              </p>

              {/* 3 selects avec labels flottants */}
              <div style={{ display: "flex", gap: 10 }}>
                {/* Jour */}
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#16a34a", marginBottom: 5, letterSpacing: 0.3 }}>Jour</label>
                  <div style={{ position: "relative" }}>
                    <select
                      className="reg-field"
                      style={{
                        ...selectBase,
                        width: "100%",
                        borderRadius: 16,
                        padding: "13px 32px 13px 12px",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#111827",
                        background: "#fff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                      value={form.day}
                      onChange={set("day")}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    >
                      {DAYS.map(d => <option key={d} value={d}>{String(d).padStart(2,"0")}</option>)}
                    </select>
                  </div>
                </div>

                {/* Mois */}
                <div style={{ flex: 1.8 }}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#16a34a", marginBottom: 5, letterSpacing: 0.3 }}>Mois</label>
                  <div style={{ position: "relative" }}>
                    <select
                      className="reg-field"
                      style={{
                        ...selectBase,
                        width: "100%",
                        borderRadius: 16,
                        padding: "13px 32px 13px 12px",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#111827",
                        background: "#fff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                      value={form.month}
                      onChange={set("month")}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Année */}
                <div style={{ flex: 1.4 }}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#16a34a", marginBottom: 5, letterSpacing: 0.3 }}>Année</label>
                  <div style={{ position: "relative" }}>
                    <select
                      className="reg-field"
                      style={{
                        ...selectBase,
                        width: "100%",
                        borderRadius: 16,
                        padding: "13px 32px 13px 12px",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#111827",
                        background: "#fff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                      value={form.year}
                      onChange={set("year")}
                      onFocus={fieldFocus}
                      onBlur={fieldBlur}
                    >
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Carte de confidentialité premium */}
              <div style={{
                background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                border: "1px solid #bbf7d0",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: "#fff",
                  border: "1.5px solid #86efac",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(34,197,94,0.15)",
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 1.5L3 4.5V9.5c0 4.2 3 7.9 7 8.5 4-0.6 7-4.3 7-8.5V4.5L10 1.5z" fill="#dcfce7" stroke="#22c55e" strokeWidth="1.4"/>
                    <path d="M7 10l2.5 2.5L13 7" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#15803d", lineHeight: 1.3 }}>
                    Votre date de naissance reste privée.
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                    Seuls les membres que vous autorisez peuvent la voir.
                  </p>
                </div>
              </div>

              <button className="reg-next-btn" onClick={handleNext}>
                Suivant
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10.5 5.5L14 9l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              ÉTAPE 3 : Genre
          ═══════════════════════════════════════════ */}
          {step === 3 && (
            <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "#6b7280" }}>
                Vous pouvez modifier qui voit votre genre sur votre profil plus tard.
              </p>
              {[
                {
                  value: "F", label: "Femme",
                  icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 13V19M9 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
                },
                {
                  value: "M", label: "Homme",
                  icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="10" cy="13" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M14 8L19 3M19 3h-4M19 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                },
                {
                  value: "O", label: "Personnalisé",
                  icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 4V2M11 20v-2M4 11H2M20 11h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="11" r="2" fill="currentColor" fillOpacity="0.25"/></svg>,
                },
              ].map(opt => {
                const selected = form.gender === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, gender: opt.value }))}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "15px 16px",
                      border: `1.5px solid ${selected ? "#22c55e" : "#e5e7eb"}`,
                      borderRadius: 16,
                      background: selected ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "#fafafa",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: selected ? "0 2px 8px rgba(34,197,94,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: selected ? "#fff" : "#f3f4f6",
                        border: `1.5px solid ${selected ? "#86efac" : "#e5e7eb"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: selected ? "#16a34a" : "#6b7280",
                        flexShrink: 0,
                        transition: "all 0.15s",
                      }}>
                        {opt.icon}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: selected ? "#15803d" : "#111827" }}>
                        {opt.label}
                      </span>
                    </span>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      border: `2px solid ${selected ? "#22c55e" : "#d1d5db"}`,
                      background: selected ? "#22c55e" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                      flexShrink: 0,
                    }}>
                      {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>
                );
              })}
              {form.gender === "O" && (
                <input
                  className="reg-field"
                  style={{ ...fieldBase, paddingLeft: 14 }}
                  placeholder="Genre (facultatif)"
                  value={form.customGender}
                  onChange={set("customGender")}
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                />
              )}
              {/* Carte confidentialité */}
              <div style={{
                background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                border: "1px solid #bbf7d0",
                borderRadius: 16,
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: "#fff",
                  border: "1.5px solid #86efac",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(34,197,94,0.15)",
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 1.5L3 4.5V9.5c0 4.2 3 7.9 7 8.5 4-0.6 7-4.3 7-8.5V4.5L10 1.5z" fill="#dcfce7" stroke="#22c55e" strokeWidth="1.4"/>
                    <path d="M7 10l2.5 2.5L13 7" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#15803d", lineHeight: 1.3 }}>
                    Votre genre restera privé par défaut.
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                    Seuls les membres que vous autorisez peuvent le voir.
                  </p>
                </div>
              </div>
              <button className="reg-next-btn" onClick={handleNext}>
                Suivant
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10.5 5.5L14 9l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              ÉTAPE 4 : Contact
          ═══════════════════════════════════════════ */}
          {step === 4 && (
            <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", borderBottom: "1.5px solid #e5e7eb", marginBottom: 4 }}>
                <button className={`reg-tab-btn${form.contactMode === "phone" ? " active" : ""}`} onClick={() => setForm(f => ({ ...f, contactMode: "phone" }))}>
                  Numéro de mobile
                </button>
                <button className={`reg-tab-btn${form.contactMode === "email" ? " active" : ""}`} onClick={() => setForm(f => ({ ...f, contactMode: "email" }))}>
                  Adresse e-mail
                </button>
              </div>

              {form.contactMode === "phone" && (
                <>
                  <select style={selectBase} className="reg-field" value={form.countryCode} onChange={set("countryCode")} onFocus={fieldFocus} onBlur={fieldBlur}>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.phone})</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 14, padding: "14px 12px", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", color: "#15803d", display: "flex", alignItems: "center" }}>
                      {selectedCountry.flag} {selectedCountry.phone}
                    </div>
                    <div style={{ flex: 1, position: "relative" }}>
                      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                        <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M3 3h2.5l1 3.5-1.5 1.5a10 10 0 004.5 4.5l1.5-1.5 3.5 1V14.5S13 16 11.5 16C6.5 16 1 10.5 1 5.5 1 4 3 3 3 3z" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      </div>
                      <input className="reg-field" style={fieldBase} type="tel" placeholder="Numéro de mobile" value={form.phone} onChange={set("phone")} onFocus={fieldFocus} onBlur={fieldBlur} autoFocus />
                    </div>
                  </div>
                </>
              )}

              {form.contactMode === "email" && (
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="1.5" y="3.5" width="14" height="10" rx="2" stroke="#9ca3af" strokeWidth="1.3"/><path d="M1.5 6l7 4.5 7-4.5" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  </div>
                  <input className="reg-field" style={fieldBase} type="email" placeholder="Adresse e-mail" value={form.email} onChange={set("email")} onFocus={fieldFocus} onBlur={fieldBlur} autoFocus />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 12px" }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="7.5" cy="7.5" r="6" stroke="#f59e0b" strokeWidth="1.3"/><path d="M7.5 5v3" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7.5" cy="10" r="0.7" fill="#f59e0b"/></svg>
                <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  Nous vous enverrons un code de confirmation sur{" "}
                  <strong>{form.contactMode === "phone" ? "votre numéro de mobile" : "votre adresse e-mail"}</strong>.
                </p>
              </div>

              <button className="reg-next-btn" onClick={handleNext}>
                Suivant
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10.5 5.5L14 9l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              ÉTAPE 5 : Mot de passe
          ═══════════════════════════════════════════ */}
          {step === 5 && (
            <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "#6b7280", lineHeight: 1.55 }}>
                Créez un mot de passe d'au moins 6 caractères. Mélangez lettres, chiffres et symboles pour plus de sécurité.
              </p>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="3" y="7.5" width="11" height="8" rx="2" stroke="#9ca3af" strokeWidth="1.3"/><path d="M5.5 7.5V5.5a3 3 0 016 0v2" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8.5" cy="11.5" r="1.2" fill="#9ca3af"/></svg>
                </div>
                <input
                  className="reg-field"
                  style={{ ...fieldBase, paddingRight: 44 }}
                  type={showPw ? "text" : "password"}
                  placeholder="Nouveau mot de passe"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                  onFocus={fieldFocus}
                  onBlur={fieldBlur}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af", display: "flex", alignItems: "center" }}
                  tabIndex={-1}
                >
                  {showPw ? (
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M1 8.5s3-5 7.5-5 7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z" stroke="#6b7280" strokeWidth="1.3"/><circle cx="8.5" cy="8.5" r="2" stroke="#6b7280" strokeWidth="1.3"/><path d="M2 2l13 13" stroke="#6b7280" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M1 8.5s3-5 7.5-5 7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z" stroke="#6b7280" strokeWidth="1.3"/><circle cx="8.5" cy="8.5" r="2" stroke="#6b7280" strokeWidth="1.3"/></svg>
                  )}
                </button>
              </div>

              {/* Indicateur de force */}
              {form.password.length > 0 && (() => {
                const len = form.password.length;
                const hasNum = /\d/.test(form.password);
                const hasSym = /[^a-zA-Z0-9]/.test(form.password);
                const strength = len >= 12 && hasNum && hasSym ? 3 : len >= 8 && (hasNum || hasSym) ? 2 : 1;
                const colors = ["#ef4444","#f59e0b","#22c55e"];
                const labels = ["Faible","Moyen","Fort"];
                return (
                  <div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < strength ? colors[strength-1] : "#e5e7eb", transition: "background 0.3s" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: colors[strength-1], fontWeight: 600 }}>Sécurité : {labels[strength-1]}</span>
                  </div>
                );
              })()}

              <button className="reg-next-btn" onClick={handleNext}>
                Suivant
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10.5 5.5L14 9l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              ÉTAPE 6 : Code de confirmation
          ═══════════════════════════════════════════ */}
          {step === 6 && (
            <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect x="2" y="5" width="22" height="16" rx="3" stroke="#22c55e" strokeWidth="1.6"/><path d="M2 10l11 7 11-7" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round"/></svg>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                  Nous avons envoyé un code à 6 chiffres sur{" "}
                  <strong style={{ color: "#111827" }}>
                    {form.contactMode === "phone" ? `${selectedCountry.phone} ${form.phone}` : form.email}
                  </strong>
                </p>
              </div>

              <input
                className="reg-field"
                style={{ ...fieldBase, paddingLeft: 14, textAlign: "center", fontSize: 28, fontWeight: 800, letterSpacing: 10, paddingTop: 16, paddingBottom: 16 }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="— — — — — —"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.replace(/\D/g,"").slice(0,6) }))}
                onFocus={fieldFocus}
                onBlur={fieldBlur}
                autoFocus
              />

              <button
                className="reg-next-btn"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
                      <path d="M9 2a7 7 0 017 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Inscription en cours…
                  </>
                ) : (
                  <>
                    Confirmer et s'inscrire
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10.5 5.5L14 9l-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </>
                )}
              </button>

              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, code: "123456" }))}
                  style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Renvoyer le code
                </button>
              </div>

              <div style={{ background: "#f0fdf4", border: "1px solid #d1fae5", borderRadius: 12, padding: "9px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="7" cy="7" r="5.5" stroke="#22c55e" strokeWidth="1.2"/><path d="M7 4.5v3" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round"/><circle cx="7" cy="9.5" r="0.6" fill="#22c55e"/></svg>
                <p style={{ margin: 0, fontSize: 12, color: "#15803d" }}>Pour les tests : le code <strong>123456</strong> est accepté automatiquement.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ marginTop: 24, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          Brute Pawa © 2026 · Afrique francophone
        </p>
      </div>
    </div>
  );
}
