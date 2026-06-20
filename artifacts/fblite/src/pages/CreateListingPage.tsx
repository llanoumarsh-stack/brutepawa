import { useState, useRef } from "react";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiCreateProduct } from "../lib/api";
import { useR2Upload } from "../hooks/useR2Upload";

const BP_GREEN = "#22C55E";

/* ── SVG Icons ─────────────────────────────────────────────── */
const Ico = {
  back: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  help: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  pen: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  wallet: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  check: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={BP_GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  loc: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={BP_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  clock: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  eye: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  heart: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  upload: <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  rocket: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={BP_GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  send: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  save: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  plus: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={BP_GREEN} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  x: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  camera: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
};

const CATEGORIES = [
  { id: "Mode",         label: "Mode",         icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg> },
  { id: "Électronique", label: "Électronique", icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
  { id: "Maison",       label: "Maison",       icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: "Beauté",       label: "Beauté",       icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { id: "Automobile",   label: "Automobile",   icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg> },
  { id: "Immobilier",   label: "Immobilier",   icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18M9 21V9"/></svg> },
  { id: "Artisanat",    label: "Artisanat",    icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg> },
  { id: "Services",     label: "Services",     icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
];

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "Occasion"];

const TIPS = [
  "Ajoutez des photos claires et réelles",
  "Rédigez une description détaillée",
  "Fixez un prix juste",
  "Choisissez la bonne catégorie",
  "Répondez rapidement aux messages",
];

interface UploadedPhoto {
  localUrl: string;
  r2Url: string;
  name: string;
}

export default function CreateListingPage() {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const fbUser = rawUser ? JSON.parse(rawUser) : { name: "Moi", countryCode: "CI" };

  const defaultCountry = COUNTRIES.find(c => c.code === (fbUser.countryCode ?? "CI")) ?? COUNTRIES[0];

  const [title, setTitle]           = useState("");
  const [price, setPrice]           = useState("");
  const [category, setCategory]     = useState("Mode");
  const [condition, setCondition]   = useState("Neuf");
  const [country, setCountry]       = useState(defaultCountry.code);
  const [city, setCity]             = useState(defaultCountry.cities[0]);
  const [description, setDescription] = useState("");
  const [photos, setPhotos]         = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, progress } = useR2Upload();

  const selectedCountry = COUNTRIES.find(c => c.code === country) ?? COUNTRIES[0];

  /* ── Helpers ── */
  const formatPrice = (raw: string) => {
    const n = raw.replace(/\D/g, "");
    return n ? parseInt(n).toLocaleString("fr-FR") : "";
  };
  const rawPrice = price.replace(/\s/g, "").replace(/\u202f/g, "");

  const handleCountryChange = (code: string) => {
    const c = COUNTRIES.find(x => x.code === code) ?? COUNTRIES[0];
    setCountry(code);
    setCity(c.cities[0]);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 10 - photos.length);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const localUrl = URL.createObjectURL(file);
      const result = await upload(file);
      if (result) setPhotos(prev => [...prev, { localUrl, r2Url: result.url, name: file.name }]);
    }
    setUploading(false);
    e.target.value = "";
  };

  const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx));
  const setMain = (idx: number) => setPhotos(prev => { const a = [...prev]; const [item] = a.splice(idx, 1); return [item, ...a]; });

  const handlePublish = async () => {
    if (!title.trim() || !rawPrice) return;
    setSubmitting(true); setError(null);
    try {
      await apiCreateProduct({
        title: title.trim(),
        description: description.trim() || undefined,
        price: parseInt(rawPrice),
        currency: selectedCountry.currency,
        category,
        imageUrl: photos[0]?.r2Url,
        location: `${city}, ${selectedCountry.name}`,
      });
      navigate("/marketplace");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la publication");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Preview card data ── */
  const previewTitle = title.trim() || "Titre de votre annonce";
  const previewPrice = rawPrice ? `${parseInt(rawPrice).toLocaleString("fr-FR")} FCFA` : "0 FCFA";
  const previewCity  = city || selectedCountry.cities[0];
  const previewDesc  = description.trim() || "Voici comment votre annonce apparaîtra.";
  const previewPhoto = photos[0]?.localUrl ?? null;

  /* ── Input style ── */
  const fieldBox: React.CSSProperties = {
    background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14,
    padding: "0 14px", display: "flex", alignItems: "center", gap: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  };
  const inp: React.CSSProperties = {
    flex: 1, border: "none", outline: "none", fontSize: 15, color: "#111827",
    background: "transparent", fontFamily: "inherit", padding: "14px 0",
  };

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoSelect} />

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F1F5F9", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/marketplace")} style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
            {Ico.back}
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>Créer une annonce</span>
              <span style={{ background: `${BP_GREEN}20`, color: BP_GREEN, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20 }}>Nouveau</span>
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>Vendez rapidement à des milliers d'utilisateurs</div>
          </div>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1.5px solid #E5E7EB", borderRadius: 20, padding: "7px 14px", color: "#64748B", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
          {Ico.help}
          Conseils pour bien vendre
        </button>
      </div>

      {/* ── Body (two-column on ≥640px) ────────────────────── */}
      <div style={{ display: "flex", gap: 0, maxWidth: 1100, margin: "0 auto", padding: "20px 14px", flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* ══ LEFT: form ══════════════════════════════════ */}
        <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16, marginRight: 20 }}>

          {/* ── Informations générales ── */}
          <Section title="Informations générales">
            {/* Title */}
            <div style={{ ...fieldBox }}>
              <span style={{ flexShrink: 0 }}>{Ico.pen}</span>
              <input
                style={inp}
                placeholder="Titre de l'article *"
                value={title}
                maxLength={80}
                onChange={e => setTitle(e.target.value)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{title.length}/80</span>
                {title.length > 5 && <span style={{ color: BP_GREEN }}>{Ico.check}</span>}
              </div>
            </div>

            {/* Price */}
            <div style={{ ...fieldBox }}>
              <span style={{ flexShrink: 0 }}>{Ico.wallet}</span>
              <input
                style={inp}
                placeholder="Prix *"
                inputMode="numeric"
                value={price}
                onChange={e => setPrice(formatPrice(e.target.value))}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#64748B", flexShrink: 0 }}>FCFA</span>
              {rawPrice && <span style={{ color: BP_GREEN, flexShrink: 0 }}>{Ico.check}</span>}
            </div>
          </Section>

          {/* ── Catégorie ── */}
          <Section title="Catégorie *">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {CATEGORIES.map(cat => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    style={{
                      border: `2px solid ${active ? BP_GREEN : "#E5E7EB"}`,
                      borderRadius: 14, padding: "10px 4px 8px",
                      background: active ? `${BP_GREEN}12` : "#fff",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                      cursor: "pointer", transition: "all .15s",
                      color: active ? BP_GREEN : "#64748B",
                      boxShadow: active ? `0 2px 10px ${BP_GREEN}30` : "none",
                    }}
                  >
                    <span style={{ color: active ? BP_GREEN : "#64748B" }}>{cat.icon}</span>
                    <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, textAlign: "center", lineHeight: 1.2 }}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── État ── */}
          <Section title="État de l'article *">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CONDITIONS.map(c => {
                const active = condition === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    style={{
                      flex: "0 0 auto", padding: "8px 16px", borderRadius: 999,
                      border: `2px solid ${active ? BP_GREEN : "#E5E7EB"}`,
                      background: active ? BP_GREEN : "#fff",
                      color: active ? "#fff" : "#64748B",
                      fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer",
                      transition: "all .15s",
                      boxShadow: active ? `0 2px 10px ${BP_GREEN}40` : "none",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block" }} />}
                    {c}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Localisation ── */}
          <Section title="Localisation *">
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Pays</label>
                <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{selectedCountry.flag}</span>
                  <select
                    value={country}
                    onChange={e => handleCountryChange(e.target.value)}
                    style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "#111827", background: "transparent", fontFamily: "inherit", padding: "12px 0", cursor: "pointer" }}
                  >
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Ville</label>
                <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  {Ico.loc}
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "#111827", background: "transparent", fontFamily: "inherit", padding: "12px 0", cursor: "pointer" }}
                  >
                    {selectedCountry.cities.map(ci => <option key={ci}>{ci}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              {Ico.loc}
              <span style={{ fontSize: 12.5, color: "#64748B" }}>
                Vous publiez depuis <strong>{city}, {selectedCountry.name}</strong>
              </span>
              <button style={{ background: "none", border: "none", color: BP_GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer", marginLeft: "auto" }}>Changer</button>
            </div>
          </Section>

          {/* ── Description ── */}
          <Section title="Description (optionnel)">
            <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={1000}
                placeholder="Décrivez votre article en détail : état, dimensions, couleur, matière..."
                style={{ width: "100%", border: "none", outline: "none", resize: "none", padding: "14px", fontSize: 14, fontFamily: "inherit", color: "#111827", height: 100, boxSizing: "border-box", background: "transparent" }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderTop: "1px solid #F1F5F9", background: "#FAFAFA" }}>
                <span style={{ fontSize: 11.5, color: "#9CA3AF", fontStyle: "italic" }}>Soyez précis et honnête pour attirer plus d'acheteurs.</span>
                <span style={{ fontSize: 11.5, color: description.length > 900 ? "#EF4444" : "#9CA3AF" }}>{description.length}/1000 {description.length > 5 && <span style={{ color: BP_GREEN }}>✓</span>}</span>
              </div>
            </div>
          </Section>

          {/* ── Photos ── */}
          <Section title="Photos de l'article *" subtitle={`Ajoutez jusqu'à 10 photos claires de votre article.`} counter={`${photos.length}/10`}>
            {/* Upload zone */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || photos.length >= 10}
              style={{ width: "100%", border: "2px dashed #E5E7EB", borderRadius: 16, padding: "28px 20px", background: uploading ? "#F8FAFC" : "#fff", cursor: (uploading || photos.length >= 10) ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all .15s" }}
            >
              {Ico.upload}
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#64748B" }}>
                  {uploading ? `Envoi en cours — ${progress}%` : "Glissez vos photos ici"}
                </div>
                {!uploading && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>ou appuyez pour sélectionner</div>}
              </div>
            </button>

            {/* Thumbnails */}
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {photos.map((photo, idx) => (
                  <div key={idx} style={{ position: "relative", width: 72, height: 72, borderRadius: 12, overflow: "hidden", border: idx === 0 ? `3px solid ${BP_GREEN}` : "2px solid #E5E7EB", flexShrink: 0 }}>
                    <img src={photo.localUrl} alt={photo.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {idx === 0 && (
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: `${BP_GREEN}E0`, padding: "2px 0", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>Photo principale</div>
                    )}
                    {idx !== 0 && (
                      <button onClick={() => setMain(idx)} style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: 8, padding: "1px 6px", fontSize: 9, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                        Principale
                      </button>
                    )}
                    <button onClick={() => removePhoto(idx)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(239,68,68,0.9)", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {Ico.x}
                    </button>
                  </div>
                ))}
                {photos.length < 10 && (
                  <button onClick={() => fileInputRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 12, border: `2px dashed ${BP_GREEN}`, background: `${BP_GREEN}08`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    {Ico.plus}
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* ── Error ── */}
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: "12px 16px", color: "#EF4444", fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* ── Actions (mobile) ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 40 }}>
            <button
              onClick={handlePublish}
              disabled={!title.trim() || !rawPrice || submitting}
              style={{ background: `linear-gradient(135deg, ${BP_GREEN}, #22C55E)`, color: "#fff", border: "none", borderRadius: 16, padding: "15px 0", fontWeight: 700, fontSize: 15, cursor: (!title.trim() || !rawPrice || submitting) ? "default" : "pointer", opacity: (!title.trim() || !rawPrice || submitting) ? 0.55 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `0 6px 20px ${BP_GREEN}50`, transition: "opacity .15s" }}
            >
              {Ico.send}
              {submitting ? "Publication…" : "Publier maintenant"}
            </button>
            <button
              style={{ background: "#fff", color: "#64748B", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "13px 0", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={() => navigate("/marketplace")}
            >
              {Ico.save}
              Enregistrer comme brouillon
            </button>
          </div>
        </div>

        {/* ══ RIGHT: live preview ═══════════════════════════ */}
        <div style={{ flex: "1 1 280px", width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 80 }}>

          {/* Preview title */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Ico.eye}
            <span style={{ fontWeight: 700, fontSize: 14, color: "#64748B" }}>Aperçu en direct</span>
          </div>

          {/* Preview card */}
          <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.09)" }}>
            {/* Photo */}
            <div style={{ height: 200, background: "#F1F5F9", position: "relative", overflow: "hidden" }}>
              {previewPhoto
                ? <img src={previewPhoto} alt={previewTitle} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#E5E7EB" }}>
                    {Ico.camera}
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Ajoutez une photo</span>
                  </div>
              }
              {/* Condition badge */}
              <div style={{ position: "absolute", top: 10, left: 10, background: condition === "Neuf" ? BP_GREEN : "#F97316", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                {condition}
              </div>
              {/* Fav */}
              <div style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, background: "rgba(255,255,255,0.95)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.12)" }}>
                {Ico.heart}
              </div>
              {/* Photo dots */}
              {photos.length > 1 && (
                <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                  {photos.slice(0, 4).map((_, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "#fff" : "rgba(255,255,255,0.5)" }} />
                  ))}
                </div>
              )}
            </div>
            {/* Info */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#111827", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewTitle}</div>
              <div style={{ fontWeight: 900, color: BP_GREEN, fontSize: 18, marginBottom: 8 }}>{previewPrice}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                {Ico.loc}
                <span style={{ fontSize: 12, color: "#64748B" }}>{previewCity}, {selectedCountry.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
                {Ico.clock}
                <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>Il y a quelques secondes</span>
              </div>
              {previewDesc && (
                <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {previewDesc}
                </div>
              )}
              {previewDesc && previewDesc.length > 80 && (
                <button style={{ background: "none", border: "none", color: BP_GREEN, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0, marginTop: 4 }}>Voir plus</button>
              )}
            </div>
          </div>

          {/* Tips card */}
          <div style={{ background: `${BP_GREEN}10`, border: `1.5px solid ${BP_GREEN}30`, borderRadius: 18, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#111827", marginBottom: 10 }}>Conseils pour mieux vendre</div>
            {TIPS.map((tip, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: BP_GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.4 }}>{tip}</span>
              </div>
            ))}
          </div>

          {/* Boost card */}
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 18, padding: "16px 16px 14px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {Ico.rocket}
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Boostez votre annonce</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 12, lineHeight: 1.5 }}>
              Touchez plus d'acheteurs en mettant votre annonce en avant.
            </div>
            <button style={{ width: "100%", background: `linear-gradient(135deg, ${BP_GREEN}, #22C55E)`, color: "#fff", border: "none", borderRadius: 12, padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 3px 12px ${BP_GREEN}40` }}>
              Booster maintenant
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────────── */
function Section({ title, subtitle, counter, children }: {
  title: string; subtitle?: string; counter?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "16px 16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 4, height: 16, background: BP_GREEN, borderRadius: 2 }} />
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, paddingLeft: 10 }}>{subtitle}</div>}
        </div>
        {counter && <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>{counter}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}
