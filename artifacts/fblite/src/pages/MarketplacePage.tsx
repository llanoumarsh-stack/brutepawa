import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiGetProducts, apiGetJobs, apiCreateProduct, type ApiProduct, type ApiJob } from "../lib/api";
import { getFavorites, toggleFavorite, addListing, getListings, deleteListing, type Listing } from "../lib/store";
import { useR2Upload } from "../hooks/useR2Upload";

const CATEGORY_EMOJI: Record<string, string> = {
  "Mode": "👗", "Électronique": "📱", "Bijoux": "💍", "Artisanat": "🎨",
  "Alimentation": "🍽️", "Auto/Moto": "🚗", "Beauté": "💄", "Maison": "🏠",
  "Tech": "💻",
};
const TYPE_EMOJI_JOB: Record<string, string> = { CDI: "💼", CDD: "📋", Freelance: "💡" };
function formatNumber(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n); }

type SubTab = "acheter" | "vendre" | "services" | "emplois" | "freelance" | "boutiques" | "favoris" | "commandes";

const SUB_TABS: { id: SubTab; label: string; emoji: string }[] = [
  { id: "acheter", label: "Acheter", emoji: "🛒" },
  { id: "vendre", label: "Vendre", emoji: "🏷️" },
  { id: "services", label: "Services", emoji: "🔧" },
  { id: "emplois", label: "Emplois", emoji: "💼" },
  { id: "freelance", label: "Freelance", emoji: "💡" },
  { id: "boutiques", label: "Boutiques", emoji: "🏪" },
  { id: "favoris", label: "Favoris", emoji: "❤️" },
  { id: "commandes", label: "Commandes", emoji: "📦" },
];

const CATEGORIES = ["Tous", "Mode", "Électronique", "Bijoux", "Artisanat", "Alimentation", "Auto/Moto", "Beauté", "Maison"];

const BOUTIQUES = [
  { id: 1, name: "Boutique Fatou Mode", owner: "Fatou Diop", products: 24, followers: 1102, emoji: "👗", rating: 4.8, country: "Mali", flag: "🇲🇱", verified: true },
  { id: 2, name: "Tech West Africa", owner: "Yao Kouassi", products: 12, followers: 423, emoji: "💻", rating: 4.6, country: "Côte d'Ivoire", flag: "🇨🇮", verified: true },
  { id: 3, name: "Bijoux Aïssatou", owner: "Aïssatou Barry", products: 38, followers: 567, emoji: "💍", rating: 4.9, country: "Guinée", flag: "🇬🇳", verified: true },
  { id: 4, name: "Groupe Ondoua Export", owner: "Sylvie Ondoua", products: 56, followers: 3200, emoji: "🏢", rating: 4.8, country: "Gabon", flag: "🇬🇦", verified: true },
];

const COUNTRY_OPTIONS = ["Tous pays", ...COUNTRIES.map(c => `${c.flag} ${c.name}`)];

interface UploadedFile {
  localUrl: string;
  r2Url: string;
  kind: "image" | "video" | "audio";
  name: string;
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const fbUser = rawUser ? JSON.parse(rawUser) : { name: "Moi", flag: "🌍", countryCode: "CI" };

  const [activeTab, setActiveTab] = useState<SubTab>("acheter");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [activeCountry, setActiveCountry] = useState("Tous pays");
  const [priceMax, setPriceMax] = useState("");
  const [favorites, setFavorites] = useState<number[]>(getFavorites());
  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
  const [apiJobs, setApiJobs] = useState<ApiJob[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showSellForm, setShowSellForm] = useState(false);

  useEffect(() => {
    setProductsLoading(true);
    Promise.all([apiGetProducts(), apiGetJobs()]).then(([p, j]) => {
      setApiProducts(p);
      setApiJobs(j);
    }).finally(() => setProductsLoading(false));
  }, []);
  const [sellForm, setSellForm] = useState({ name: "", price: "", category: "Mode", description: "", country: fbUser.countryCode ?? "CI", condition: "Neuf" });
  const [showFilters, setShowFilters] = useState(false);

  // R2 upload state for listings
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const { upload, progress, status: uploadStatus } = useR2Upload();

  // User's own listings from localStorage
  const [myListings, setMyListings] = useState<Listing[]>(() => getListings());

  const refreshListings = () => setMyListings(getListings());

  const filteredProducts = apiProducts.filter(p => {
    const matchCat = activeCategory === "Tous" || p.category === activeCategory;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()) || (p.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchPrice = !priceMax || p.price <= parseInt(priceMax);
    return matchCat && matchSearch && matchPrice;
  });

  const toggleFav = (id: number) => setFavorites(toggleFavorite(id));

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingCount(c => c + files.length);
    for (const file of files) {
      const localUrl = URL.createObjectURL(file);
      const result = await upload(file);
      if (result) {
        setUploadedFiles(prev => [...prev, {
          localUrl,
          r2Url: result.url,
          kind: result.kind,
          name: file.name,
        }]);
      }
      setUploadingCount(c => c - 1);
    }
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePublish = () => {
    if (!sellForm.name.trim() || !sellForm.price) return;
    const country = COUNTRIES.find(c => c.code === sellForm.country) ?? COUNTRIES[0];
    addListing({
      name: sellForm.name,
      price: parseInt(sellForm.price),
      category: sellForm.category,
      condition: sellForm.condition,
      countryCode: country.code,
      countryFlag: country.flag,
      countryName: country.name,
      description: sellForm.description,
      mediaUrls: uploadedFiles.map(f => f.r2Url),
      mediaKinds: uploadedFiles.map(f => f.kind),
      sellerName: fbUser.name,
      sellerFlag: fbUser.flag ?? "🌍",
    });
    setSellForm({ name: "", price: "", category: "Mode", description: "", country: fbUser.countryCode ?? "CI", condition: "Neuf" });
    setUploadedFiles([]);
    setShowSellForm(false);
    refreshListings();
    setActiveTab("acheter");
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 16 }}>
      {/* Sub-tabs */}
      <div style={{ background: "var(--fb-white)", borderBottom: "1px solid var(--fb-divider)", display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: "0 0 auto", padding: "12px 14px", background: "none", border: "none",
              borderBottom: activeTab === tab.id ? "3px solid var(--fb-blue)" : "3px solid transparent",
              color: activeTab === tab.id ? "var(--fb-blue)" : "var(--fb-text-secondary)",
              fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 12 }}>

        {/* Hidden file input for listing media */}
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleMediaSelect} />

        {/* ACHETER */}
        {activeTab === "acheter" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher des articles..." style={{ flex: 1 }} />
              <button onClick={() => setShowFilters(f => !f)} style={{ background: showFilters ? "var(--fb-blue)" : "var(--fb-white)", color: showFilters ? "#fff" : "var(--fb-text)", border: "1px solid var(--fb-border)", borderRadius: 6, padding: "0 12px", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                🔧 Filtres
              </button>
            </div>

            {showFilters && (
              <div style={{ background: "var(--fb-white)", border: "1px solid var(--fb-divider)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Filtres avancés</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 4 }}>Pays</label>
                  <select value={activeCountry} onChange={e => setActiveCountry(e.target.value)} style={{ width: "100%", fontFamily: "inherit", background: "var(--fb-bg)", border: "1px solid var(--fb-border)", borderRadius: 6, padding: "8px 10px", fontSize: 14 }}>
                    {COUNTRY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fb-text-secondary)", display: "block", marginBottom: 4 }}>Prix maximum (FCFA)</label>
                  <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Ex: 50000" style={{ width: "100%" }} />
                </div>
                <button onClick={() => { setActiveCountry("Tous pays"); setPriceMax(""); }} style={{ background: "none", border: "none", color: "var(--fb-blue)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Réinitialiser</button>
              </div>
            )}

            {/* Category filter */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 12, paddingBottom: 4 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  style={{ flex: "0 0 auto", padding: "6px 14px", borderRadius: 20, border: "1px solid var(--fb-border)",
                    background: activeCategory === cat ? "var(--fb-blue)" : "var(--fb-white)",
                    color: activeCategory === cat ? "#fff" : "var(--fb-text)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* User's own listings (with real R2 photos) */}
            {myListings.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "#E3F2FD", color: "var(--fb-blue)", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Mes annonces</span>
                  <span style={{ fontSize: 11 }}>{myListings.length} publiée{myListings.length > 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {myListings.map(listing => (
                    <div key={listing.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "2px solid var(--fb-blue)", overflow: "hidden", position: "relative" }}>
                      {/* Delete button */}
                      <button
                        onClick={() => { deleteListing(listing.id); refreshListings(); }}
                        style={{ position: "absolute", top: 5, right: 5, background: "rgba(244,67,54,0.85)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", fontSize: 12, cursor: "pointer", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>

                      {/* Photo or placeholder */}
                      <div style={{ height: 120, background: "var(--fb-bg)", overflow: "hidden", position: "relative" }}>
                        {listing.mediaUrls.length > 0 ? (
                          listing.mediaKinds[0] === "video" ? (
                            <video src={listing.mediaUrls[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                          ) : (
                            <img src={listing.mediaUrls[0]} alt={listing.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          )
                        ) : (
                          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>🏷️</div>
                        )}
                        {listing.mediaUrls.length > 1 && (
                          <span style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10 }}>
                            +{listing.mediaUrls.length - 1}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.name}</div>
                        <div style={{ fontWeight: 900, color: "var(--fb-blue)", fontSize: 14 }}>{listing.price.toLocaleString()} FCFA</div>
                        <div style={{ fontSize: 10, color: "var(--fb-text-secondary)", marginTop: 1 }}>📍 {listing.countryFlag} · {listing.createdAt}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 10 }}>
              {filteredProducts.length} article{filteredProducts.length !== 1 ? "s" : ""} trouvé{filteredProducts.length !== 1 ? "s" : ""}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {filteredProducts.map(p => (
                <div key={p.id} onClick={() => navigate(`/marketplace/${p.id}`)} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden", cursor: "pointer" }}>
                  <div style={{ height: 120, background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, position: "relative", overflow: "hidden" }}>
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                      : (CATEGORY_EMOJI[p.category] ?? "🛍️")}
                    <button onClick={e => { e.stopPropagation(); toggleFav(p.id); }}
                      style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.8)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 16, zIndex: 1 }}>
                      {favorites.includes(p.id) ? "❤️" : "🤍"}
                    </button>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    <div style={{ fontWeight: 900, color: "var(--fb-blue)", fontSize: 15 }}>{p.price.toLocaleString()} {p.currency}</div>
                    <div style={{ fontSize: 11, color: "var(--fb-text-secondary)", marginTop: 2 }}>📍 {p.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VENDRE */}
        {activeTab === "vendre" && (
          <>
            {!showSellForm ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 64, marginBottom: 12 }}>🏷️</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Vendez vos articles</div>
                <div style={{ color: "var(--fb-text-secondary)", marginBottom: 20 }}>Touchez des millions d'acheteurs dans 14 pays africains</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
                  <button className="btn-primary" style={{ padding: "12px 32px" }} onClick={() => setShowSellForm(true)}>
                    + Créer une annonce
                  </button>
                  {myListings.length > 0 && (
                    <button className="btn-secondary" style={{ padding: "10px" }} onClick={() => setActiveTab("acheter")}>
                      📋 Voir mes {myListings.length} annonce{myListings.length > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>Nouvelle annonce</div>
                  <button onClick={() => setShowSellForm(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-text-secondary)" }}>✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input placeholder="Titre de l'article *" value={sellForm.name} onChange={e => setSellForm(f => ({ ...f, name: e.target.value }))} />
                  <input placeholder="Prix (FCFA) *" type="number" value={sellForm.price} onChange={e => setSellForm(f => ({ ...f, price: e.target.value }))} />

                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={sellForm.category} onChange={e => setSellForm(f => ({ ...f, category: e.target.value }))} style={{ flex: 1 }}>
                      {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                    </select>
                    <select value={sellForm.condition} onChange={e => setSellForm(f => ({ ...f, condition: e.target.value }))} style={{ flex: 1 }}>
                      <option>Neuf</option>
                      <option>Occasion</option>
                      <option>Reconditionné</option>
                    </select>
                  </div>

                  <select value={sellForm.country} onChange={e => setSellForm(f => ({ ...f, country: e.target.value }))}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                  </select>

                  <textarea
                    placeholder="Description..."
                    style={{ border: "1px solid var(--fb-border)", borderRadius: 6, padding: "10px 14px", fontSize: 14, resize: "none", height: 80, fontFamily: "inherit" }}
                    value={sellForm.description}
                    onChange={e => setSellForm(f => ({ ...f, description: e.target.value }))}
                  />

                  {/* ── Media upload zone ── */}
                  <div>
                    <button
                      type="button"
                      onClick={() => mediaInputRef.current?.click()}
                      disabled={uploadingCount > 0}
                      style={{
                        width: "100%", border: "2px dashed var(--fb-border)", background: "var(--fb-bg)",
                        borderRadius: 10, padding: "16px 0", cursor: uploadingCount > 0 ? "default" : "pointer",
                        color: "var(--fb-text-secondary)", fontSize: 14, fontWeight: 600,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      {uploadingCount > 0 ? (
                        <>
                          <div style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.1)", borderTopColor: "var(--fb-blue)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                          Envoi en cours — {progress}%
                        </>
                      ) : (
                        <>📷 Ajouter des photos / vidéos</>
                      )}
                    </button>

                    {/* Thumbnails */}
                    {uploadedFiles.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {uploadedFiles.map((f, idx) => (
                          <div key={idx} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: "2px solid var(--fb-blue)" }}>
                            {f.kind === "video" ? (
                              <video src={f.localUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                            ) : (
                              <img src={f.localUrl} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                            <button
                              onClick={() => removeFile(idx)}
                              style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, background: "rgba(244,67,54,0.85)", border: "none", borderRadius: "50%", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {uploadedFiles.length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--fb-text-secondary)", marginTop: 6 }}>
                        {uploadedFiles.length} photo{uploadedFiles.length > 1 ? "s" : ""} / vidéo{uploadedFiles.length > 1 ? "s" : ""} ajoutée{uploadedFiles.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  <button
                    className="btn-primary"
                    disabled={!sellForm.name.trim() || !sellForm.price || uploadingCount > 0}
                    onClick={handlePublish}
                    style={{ opacity: (!sellForm.name.trim() || !sellForm.price || uploadingCount > 0) ? 0.5 : 1 }}
                  >
                    {uploadingCount > 0 ? "⏳ Upload en cours…" : "Publier l'annonce"}
                  </button>
                  <button className="btn-secondary" onClick={() => { setShowSellForm(false); setUploadedFiles([]); }}>Annuler</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* SERVICES */}
        {activeTab === "services" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🔧 Services disponibles</div>
            <input placeholder="🔍 Rechercher un service..." style={{ marginBottom: 12 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([] as {id:number;emoji:string;name:string;provider:string;flag:string;verified:boolean;city:string;price:string;rating:number;reviews:number;duration:string}[]).map(s => (
                <div key={s.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 36, width: 56, height: 56, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                      <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                        Par {s.provider} {s.flag} {s.verified && "✔️"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>📍 {s.city}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span style={{ color: "#FFD700" }}>★ {s.rating}</span>
                        <span style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>({s.reviews} avis)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, color: "var(--fb-blue)", fontSize: 15 }}>{s.price.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>FCFA {s.duration}</div>
                      <button className="btn-primary" style={{ width: "auto", padding: "6px 12px", fontSize: 12, marginTop: 6 }}>Contacter</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* EMPLOIS */}
        {activeTab === "emplois" && (
          <>
            <input placeholder="🔍 Rechercher un emploi, une ville, un pays..." style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 12, paddingBottom: 4 }}>
              {["Tous", "CDI", "CDD", "Stage"].map(t => (
                <button key={t} style={{ flex: "0 0 auto", padding: "5px 12px", borderRadius: 20, border: "1px solid var(--fb-border)", background: t === "Tous" ? "var(--fb-blue)" : "var(--fb-white)", color: t === "Tous" ? "#fff" : "var(--fb-text)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{t}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {apiJobs.filter(j => j.type !== "Freelance").map(job => (
                <div key={job.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 28, width: 50, height: 50, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{TYPE_EMOJI_JOB[job.type] ?? "💼"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{job.title}</div>
                      <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>{job.company}</div>
                      <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>📍 {job.location}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ background: "var(--fb-blue-light)", color: "var(--fb-blue)", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>{job.type}</span>
                        {job.salary && <span style={{ background: "#f0f9f0", color: "#42B72A", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>{job.salary.toLocaleString()} {job.currency}</span>}
                      </div>
                    </div>
                  </div>
                  <button className="btn-primary"
                    style={{ marginTop: 10, width: "100%", padding: "10px" }}
                    onClick={() => navigate(`/jobs/${job.id}`)}>
                    Postuler maintenant
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* FREELANCE */}
        {activeTab === "freelance" && (
          <>
            <input placeholder="🔍 Rechercher une mission freelance..." style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 12, paddingBottom: 4 }}>
              {["Toutes", "Tech", "Design", "Rédaction", "Marketing", "Juridique"].map(t => (
                <button key={t} style={{ flex: "0 0 auto", padding: "5px 12px", borderRadius: 20, border: "1px solid var(--fb-border)", background: t === "Toutes" ? "var(--fb-blue)" : "var(--fb-white)", color: t === "Toutes" ? "#fff" : "var(--fb-text)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{t}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {apiJobs.filter(j => j.type === "Freelance").map(job => (
                <div key={job.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ fontSize: 28, width: 50, height: 50, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>💡</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{job.title}</div>
                      <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>{job.company} · {job.location}</div>
                      <div style={{ fontWeight: 700, color: "var(--fb-blue)", marginTop: 4 }}>
                        {job.salary ? `${job.salary.toLocaleString()} ${job.currency}` : "Budget à négocier"}
                      </div>
                    </div>
                  </div>
                  <button className="btn-primary"
                    style={{ marginTop: 10, width: "100%", padding: "10px" }}
                    onClick={() => navigate(`/jobs/${job.id}`)}>
                    Soumettre une offre
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* BOUTIQUES */}
        {activeTab === "boutiques" && (
          <>
            <button className="btn-primary" style={{ marginBottom: 16 }}>+ Créer ma boutique</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {BOUTIQUES.map(b => (
                <div key={b.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 36, width: 56, height: 56, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{b.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        {b.name} {b.verified && <span style={{ color: "var(--fb-blue)", fontSize: 12 }}>✔️</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Par {b.owner} {b.flag}</div>
                      <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{b.products} produits · {formatNumber(b.followers)} abonnés</div>
                      <span style={{ color: "#FFD700", fontSize: 13 }}>★ {b.rating}</span>
                    </div>
                    <button className="btn-primary" style={{ width: "auto", padding: "7px 14px", fontSize: 13 }}>Visiter</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* FAVORIS */}
        {activeTab === "favoris" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>❤️ Mes favoris ({favorites.length})</div>
            {favorites.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--fb-text-secondary)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🤍</div>
                <div>Aucun article en favoris</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {apiProducts.filter(p => favorites.includes(p.id)).map(p => (
                  <div key={p.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
                    <div style={{ height: 100, background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, position: "relative", overflow: "hidden" }}>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                        : (CATEGORY_EMOJI[p.category] ?? "🛍️")}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.title}</div>
                      <div style={{ fontWeight: 900, color: "var(--fb-blue)", fontSize: 14 }}>{p.price.toLocaleString()} {p.currency}</div>
                      <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>📍 {p.location}</div>
                      <button onClick={() => toggleFav(p.id)} style={{ fontSize: 11, color: "#F44336", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0 }}>❌ Retirer</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* COMMANDES */}
        {activeTab === "commandes" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📦 Historique des commandes</div>
            {[
              { id: 1, product: "Tissu wax hollandais 6m", seller: "Aminata Diallo", flag: "🇸🇳", price: 15000, status: "Livré", emoji: "🧵", date: "3 juin 2026" },
              { id: 2, product: "Bijoux artisanaux or", seller: "Aïssatou Barry", flag: "🇬🇳", price: 45000, status: "En cours", emoji: "💍", date: "8 juin 2026" },
              { id: 3, product: "Boubou brodé premium", seller: "Fatou Diop", flag: "🇲🇱", price: 35000, status: "Expédié", emoji: "👗", date: "10 juin 2026" },
            ].map(order => (
              <div key={order.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 32, width: 50, height: 50, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{order.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{order.product}</div>
                    <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Vendeur : {order.seller} {order.flag}</div>
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{order.date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "var(--fb-blue)" }}>{order.price.toLocaleString()} FCFA</div>
                    <span style={{
                      background: order.status === "Livré" ? "#f0f9f0" : order.status === "Expédié" ? "#E3F2FD" : "#FFF8E1",
                      color: order.status === "Livré" ? "#42B72A" : order.status === "Expédié" ? "#1877F2" : "#FF9800",
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20
                    }}>{order.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
