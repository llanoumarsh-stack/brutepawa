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

/* ── tiny helpers ─────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "#f0f2f5", border: "1.5px solid #ccd0d5",
  borderRadius: 6, padding: "12px 14px",
  fontSize: 16, color: "#1c1e21",
  outline: "none", fontFamily: "inherit",
};
const sel: React.CSSProperties = { ...inp, appearance: "none" as React.CSSProperties["appearance"], cursor: "pointer" };
const btnGreen: React.CSSProperties = {
  background: "#42b72a", color: "#fff", border: "none",
  borderRadius: 6, padding: "12px 32px",
  fontSize: 17, fontWeight: 700, cursor: "pointer",
  width: "100%", marginTop: 4,
};

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

  /* ── navigation ─────────────────────────────────────── */
  const next = () => { setError(""); setStep(s => s + 1); };
  const back = () => { setError(""); setStep(s => s - 1); };

  /* ── validation per step ─────────────────────────────── */
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

  const handleNext = () => {
    if (validate() === true) next();
  };

  /* ── final submit ─────────────────────────────────────── */
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
      setBpToken(token);
      saveFbUser(user);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription.");
      setLoading(false);
    }
  };

  /* ── UI ───────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: "100vh", background: "#f0f2f5",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "20px 16px",
    }}>
      <style>{`
        .reg-radio { display:flex; align-items:center; justify-content:space-between; background:#f0f2f5; border:1.5px solid #ccd0d5; borderRadius:6px; padding:10px 14px; cursor:pointer; font-size:16px; border-radius:6px; margin-bottom:8px; }
        .reg-radio:has(input:checked) { border-color:#1877F2; background:#e7f0ff; }
        .reg-code-input { width:100%; text-align:center; font-size:24px; font-weight:700; letter-spacing:8px; }
        .reg-tab { flex:1; padding:10px 0; background:none; border:none; border-bottom:3px solid transparent; font-size:15px; font-weight:600; color:#606770; cursor:pointer; }
        .reg-tab.active { color:#1877F2; border-bottom-color:#1877F2; }
        @keyframes regSlide { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
        .reg-step { animation: regSlide 0.22s ease; }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: "#1877F2", letterSpacing: -1, lineHeight: 1 }}>brutepawa</div>
        <div style={{ fontSize: 14, color: "#606770", marginTop: 4 }}>
          Connecte-toi partout en Afrique francophone.
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: "#fff", borderRadius: 8,
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        width: "100%", maxWidth: 396,
        padding: "20px 24px 24px",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          {step > 1 && (
            <button
              onClick={back}
              style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#606770", padding: 0 }}
            >←</button>
          )}
          <div style={{ textAlign: step > 1 ? "center" : "left" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#1c1e21", lineHeight: 1.2 }}>
              {step === 1 && "Créer un compte"}
              {step === 2 && "Votre date de naissance"}
              {step === 3 && "Votre genre"}
              {step === 4 && "Coordonnées de contact"}
              {step === 5 && "Choisissez un mot de passe"}
              {step === 6 && "Entrez le code de confirmation"}
            </div>
            {step === 1 && <div style={{ fontSize: 14, color: "#606770", marginTop: 2 }}>C'est rapide et facile.</div>}
          </div>

          {/* Progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} style={{ width: i + 1 === step ? 22 : 8, height: 8, borderRadius: 4, background: i + 1 <= step ? "#1877F2" : "#d8dadf", transition: "all .2s" }} />
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #dadde1", margin: "0 -24px 18px", width: "calc(100% + 48px)" }} />

        {/* Error */}
        {error && (
          <div style={{ background: "#fff0f0", border: "1px solid #ffc0c0", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, color: "#c92a2a", marginBottom: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── STEP 1 : Nom ───────────────────────────────────── */}
        {step === 1 && (
          <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input style={inp} placeholder="Prénom" value={form.firstName} onChange={set("firstName")} autoFocus />
              <input style={inp} placeholder="Nom de famille" value={form.lastName} onChange={set("lastName")} />
            </div>
            <button style={btnGreen} onClick={handleNext}>Suivant</button>
            <p style={{ fontSize: 12, color: "#606770", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
              En cliquant sur Suivant, vous acceptez nos <a href="#" style={{ color: "#1877F2" }}>Conditions</a>,{" "}
              notre <a href="#" style={{ color: "#1877F2" }}>Politique de confidentialité</a> et notre{" "}
              <a href="#" style={{ color: "#1877F2" }}>Politique relative aux cookies</a>.
            </p>
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <a href="#" onClick={e => { e.preventDefault(); navigate("/login"); }} style={{ fontSize: 14, color: "#1877F2", fontWeight: 600 }}>
                Vous avez déjà un compte ?
              </a>
            </div>
          </div>
        )}

        {/* ── STEP 2 : Date de naissance ─────────────────────── */}
        {step === 2 && (
          <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: "#606770", lineHeight: 1.5 }}>
              Indiquez votre vrai anniversaire, même si ce compte est destiné à une entreprise, un animal de compagnie ou autre chose.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ ...sel, flex: 1 }} value={form.day} onChange={set("day")}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select style={{ ...sel, flex: 1.6 }} value={form.month} onChange={set("month")}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select style={{ ...sel, flex: 1.2 }} value={form.year} onChange={set("year")}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#90949c" }}>
              🔒 Seuls les membres dont vous autorisez l'accès peuvent voir votre anniversaire.
            </p>
            <button style={btnGreen} onClick={handleNext}>Suivant</button>
          </div>
        )}

        {/* ── STEP 3 : Genre ─────────────────────────────────── */}
        {step === 3 && (
          <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#606770" }}>
              Vous pouvez modifier qui voit votre genre sur votre profil plus tard.
            </p>
            {[
              { value: "F", label: "Femme" },
              { value: "M", label: "Homme" },
              { value: "O", label: "Personnalisé" },
            ].map(opt => (
              <label key={opt.value} className="reg-radio" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: form.gender === opt.value ? "#e7f0ff" : "#f0f2f5", border: `1.5px solid ${form.gender === opt.value ? "#1877F2" : "#ccd0d5"}`, borderRadius: 6, padding: "11px 14px", cursor: "pointer", fontSize: 16 }}>
                {opt.label}
                <input type="radio" name="gender" value={opt.value} checked={form.gender === opt.value} onChange={set("gender")} style={{ width: 20, height: 20, accentColor: "#1877F2" }} />
              </label>
            ))}
            {form.gender === "O" && (
              <input style={inp} placeholder="Genre (facultatif)" value={form.customGender} onChange={set("customGender")} />
            )}
            <p style={{ margin: 0, fontSize: 12, color: "#90949c" }}>
              🔒 Votre genre restera privé par défaut.
            </p>
            <button style={btnGreen} onClick={handleNext}>Suivant</button>
          </div>
        )}

        {/* ── STEP 4 : Contact ───────────────────────────────── */}
        {step === 4 && (
          <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #dadde1", marginBottom: 8 }}>
              <button className={`reg-tab${form.contactMode === "phone" ? " active" : ""}`} onClick={() => setForm(f => ({ ...f, contactMode: "phone" }))}>Numéro de mobile</button>
              <button className={`reg-tab${form.contactMode === "email" ? " active" : ""}`} onClick={() => setForm(f => ({ ...f, contactMode: "email" }))}>Adresse e-mail</button>
            </div>

            {form.contactMode === "phone" && (
              <>
                <select style={sel} value={form.countryCode} onChange={set("countryCode")}>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.phone})</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ background: "#f0f2f5", border: "1.5px solid #ccd0d5", borderRadius: 6, padding: "12px 14px", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", color: "#606770" }}>
                    {selectedCountry.flag} {selectedCountry.phone}
                  </div>
                  <input style={{ ...inp, flex: 1 }} type="tel" placeholder="Numéro de mobile" value={form.phone} onChange={set("phone")} autoFocus />
                </div>
              </>
            )}

            {form.contactMode === "email" && (
              <input style={inp} type="email" placeholder="Adresse e-mail" value={form.email} onChange={set("email")} autoFocus />
            )}

            <p style={{ margin: 0, fontSize: 12, color: "#90949c", lineHeight: 1.5 }}>
              Nous vous enverrons un code de confirmation sur{" "}
              {form.contactMode === "phone" ? "votre numéro de mobile" : "votre adresse e-mail"} pour confirmer votre compte.
            </p>
            <button style={btnGreen} onClick={handleNext}>Suivant</button>
          </div>
        )}

        {/* ── STEP 5 : Mot de passe ──────────────────────────── */}
        {step === 5 && (
          <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: "#606770" }}>
              Créez un mot de passe d'au moins 6 caractères. Un mot de passe sécurisé mélange des lettres, des chiffres et des signes de ponctuation.
            </p>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inp, paddingRight: 44 }}
                type={showPw ? "text" : "password"}
                placeholder="Nouveau mot de passe"
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#606770" }}
              >{showPw ? "🙈" : "👁️"}</button>
            </div>

            {/* Strength bar */}
            {form.password && (() => {
              const len = form.password.length;
              const hasNum = /\d/.test(form.password);
              const hasSym = /[^a-zA-Z0-9]/.test(form.password);
              const strength = len >= 12 && hasNum && hasSym ? 3 : len >= 8 && (hasNum || hasSym) ? 2 : 1;
              const colors = ["#f03e3e","#f59f00","#2f9e44"];
              const labels = ["Faible","Moyen","Fort"];
              return (
                <div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < strength ? colors[strength-1] : "#e0e0e0", transition: "background .3s" }} />)}
                  </div>
                  <div style={{ fontSize: 12, color: colors[strength-1], fontWeight: 600 }}>{labels[strength-1]}</div>
                </div>
              );
            })()}

            <button style={btnGreen} onClick={handleNext}>Suivant</button>
          </div>
        )}

        {/* ── STEP 6 : Code de confirmation ──────────────────── */}
        {step === 6 && (
          <div className="reg-step" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14, color: "#606770", textAlign: "center", lineHeight: 1.6 }}>
              Nous avons envoyé un code à 6 chiffres sur{" "}
              <strong>
                {form.contactMode === "phone"
                  ? `${selectedCountry.phone} ${form.phone}`
                  : form.email}
              </strong>. Saisissez ce code ci-dessous.
            </p>

            <input
              className="reg-code-input"
              style={{ ...inp, textAlign: "center", fontSize: 26, fontWeight: 700, letterSpacing: 10, padding: "14px" }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="------"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.replace(/\D/g,"").slice(0,6) }))}
              autoFocus
            />

            <button
              style={{ ...btnGreen, opacity: loading ? 0.7 : 1 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Inscription en cours…" : "Confirmer et s'inscrire"}
            </button>

            <div style={{ textAlign: "center" }}>
              <a href="#" onClick={e => { e.preventDefault(); setForm(f => ({ ...f, code: "123456" })); }} style={{ fontSize: 13, color: "#1877F2" }}>
                Renvoyer le code
              </a>
            </div>

            <p style={{ margin: 0, fontSize: 11.5, color: "#90949c", textAlign: "center" }}>
              💡 Pour les tests : le code <strong>123456</strong> est accepté automatiquement.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, fontSize: 12, color: "#90949c", textAlign: "center" }}>
        Brute Pawa © {currentYear} · Afrique francophone
      </div>
    </div>
  );
}
