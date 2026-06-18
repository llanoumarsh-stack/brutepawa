import { useState, useRef, useEffect } from "react";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiGetProducts, apiGetJobs, type ApiProduct, type ApiJob } from "../lib/api";
import { getFavorites, toggleFavorite, addListing, getListings, deleteListing, type Listing } from "../lib/store";
import { useR2Upload } from "../hooks/useR2Upload";

const BP_GREEN = "#16C24A";

function formatNumber(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

/* ── SVG Icons ──────────────────────────────────────────────── */
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IconFilter = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
  </svg>
);
const IconHeart = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill={filled ? "#F43F5E" : "none"} stroke={filled ? "#F43F5E" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const IconLocation = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconEye = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="#FBBF24" stroke="#FBBF24" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconVerified = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill={BP_GREEN}>
    <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
  </svg>
);
const IconBookmark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconBag = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IconTag = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const IconWrench = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);
const IconBriefcase = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.07 6.07l.98-.98a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconCamera = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

/* ── Mock data ──────────────────────────────────────────────── */
const CATEGORIES = ["Tous", "Mode", "Électronique", "Beauté", "Maison", "Artisanat", "Automobile", "Immobilier"];

const MOCK_PRODUCTS = [
  { id: 101, title: "Basket Nike Air Force 1", price: 35000, imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80", location: "Abidjan, Cocody", views: 1200, discount: -15, category: "Mode" },
  { id: 102, title: "Sac à main Luxe", price: 25000, imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80", location: "Dakar, Almadies", views: 890, discount: null, category: "Mode" },
  { id: 103, title: "iPhone 14 Pro Max", price: 750000, imageUrl: "https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=400&q=80", location: "Paris, France", views: 2300, discount: null, category: "Électronique" },
  { id: 104, title: "Canapé 3 places", price: 120000, imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80", location: "Abidjan, Marcory", views: 564, discount: null, category: "Maison" },
];

const MOCK_SERVICES = [
  { id: 1, name: "Martin D.", role: "Plombier", rating: 4.8, reviews: 124, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80", verified: true, color: "#E0F2FE" },
  { id: 2, name: "Aminata C.", role: "Femme de ménage", rating: 4.9, reviews: 98, avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80", verified: true, color: "#F0FDF4" },
  { id: 3, name: "Yaya S.", role: "Électricien", rating: 4.7, reviews: 76, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80", verified: true, color: "#FFF7ED" },
  { id: 4, name: "Fatou B.", role: "Maquilleuse", rating: 4.9, reviews: 63, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80", verified: true, color: "#FDF2F8" },
];

const MOCK_JOBS = [
  { id: 1, title: "Développeur Mobile", company: "Brutepawa SAS", verified: true, city: "Abidjan, Côte d'Ivoire", salary: "500 000 – 800 000 FCFA", logo: BP_GREEN, logoText: "BP" },
  { id: 2, title: "Community Manager", company: "Jumia CI", verified: true, city: "Abidjan, Côte d'Ivoire", salary: "350 000 – 500 000 FCFA", logo: "#F97316", logoText: "JU" },
  { id: 3, title: "Agent Support Client", company: "Wave Mobile", verified: true, city: "Dakar, Sénégal", salary: "250 000 – 350 000 FCFA", logo: "#0EA5E9", logoText: "WA" },
];

type MarketTab = "marketplace" | "produits" | "services" | "emplois";

interface UploadedFile {
  localUrl: string;
  r2Url: string;
  kind: "image" | "video" | "audio";
  name: string;
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const fbUser = rawUser ? JSON.parse(rawUser) : { name: "Moi", countryCode: "CI" };

  const [activeTab, setActiveTab] = useState<MarketTab>("marketplace");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [favorites, setFavorites] = useState<number[]>(getFavorites());
  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
  const [apiJobs, setApiJobs] = useState<ApiJob[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showSellForm, setShowSellForm] = useState(false);
  const [sellForm, setSellForm] = useState({ name: "", price: "", category: "Mode", description: "", country: fbUser.countryCode ?? "CI", condition: "Neuf" });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const { upload, progress } = useR2Upload();
  const [myListings, setMyListings] = useState<Listing[]>(() => getListings());
  const refreshListings = () => setMyListings(getListings());

  useEffect(() => {
    setProductsLoading(true);
    Promise.all([apiGetProducts(), apiGetJobs()]).then(([p, j]) => {
      setApiProducts(p); setApiJobs(j);
    }).finally(() => setProductsLoading(false));
  }, []);

  const allProducts = [
    ...MOCK_PRODUCTS,
    ...apiProducts.map(p => ({ id: p.id, title: p.title, price: p.price, imageUrl: p.imageUrl ?? null, location: p.location ?? "", views: 0, discount: null, category: p.category })),
  ];
  const filteredProducts = allProducts.filter(p => {
    const matchCat = activeCategory === "Tous" || p.category === activeCategory;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const displayJobs = apiJobs.length > 0
    ? apiJobs.map(j => ({ id: j.id, title: j.title, company: j.company, verified: true, city: j.location ?? "", salary: j.salary ?? "", logo: BP_GREEN, logoText: j.company.slice(0, 2).toUpperCase() }))
    : MOCK_JOBS;

  const toggleFav = (id: number) => setFavorites(toggleFavorite(id));

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingCount(c => c + files.length);
    for (const file of files) {
      const localUrl = URL.createObjectURL(file);
      const result = await upload(file);
      if (result) setUploadedFiles(prev => [...prev, { localUrl, r2Url: result.url, kind: result.kind, name: file.name }]);
      setUploadingCount(c => c - 1);
    }
    e.target.value = "";
  };

  const handlePublish = () => {
    if (!sellForm.name.trim() || !sellForm.price) return;
    const country = COUNTRIES.find(c => c.code === sellForm.country) ?? COUNTRIES[0];
    addListing({ name: sellForm.name, price: parseInt(sellForm.price), category: sellForm.category, condition: sellForm.condition, countryCode: country.code, countryFlag: country.flag, countryName: country.name, description: sellForm.description, mediaUrls: uploadedFiles.map(f => f.r2Url), mediaKinds: uploadedFiles.map(f => f.kind), sellerName: fbUser.name, sellerFlag: "" });
    setSellForm({ name: "", price: "", category: "Mode", description: "", country: fbUser.countryCode ?? "CI", condition: "Neuf" });
    setUploadedFiles([]); setShowSellForm(false); refreshListings(); setActiveTab("produits");
  };

  const TABS: { id: MarketTab; label: string; icon: React.ReactNode }[] = [
    { id: "marketplace", label: "Marketplace", icon: <IconBag /> },
    { id: "produits",    label: "Produits",    icon: <IconTag /> },
    { id: "services",    label: "Services",    icon: <IconWrench /> },
    { id: "emplois",     label: "Emplois",     icon: <IconBriefcase /> },
  ];

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", paddingBottom: 80 }}>
      <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={handleMediaSelect} />

      {/* ── Tabs ──────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F1F5F9", display: "flex", padding: "0 12px", gap: 4, overflowX: "auto", scrollbarWidth: "none", position: "sticky", top: 0, zIndex: 10 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "12px 14px",
              background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: activeTab === tab.id ? `3px solid ${BP_GREEN}` : "3px solid transparent",
              color: activeTab === tab.id ? BP_GREEN : "#64748B",
              fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13, transition: "all .15s",
            }}
          >
            <span style={{ color: activeTab === tab.id ? BP_GREEN : "#94A3B8" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 14px 0" }}>

        {/* ── Search bar ─────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <div className="bp-search" style={{ flex: 1 }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit, service..."
            />
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 24, padding: "0 16px", height: 52, color: "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
            <IconFilter />
            Filtres
          </button>
        </div>

        {/* ── Category capsules ──────────────────────── */}
        {(activeTab === "marketplace" || activeTab === "produits") && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", marginBottom: 20, paddingBottom: 2 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flex: "0 0 auto", padding: "7px 16px", borderRadius: 999, border: "1.5px solid",
                  borderColor: activeCategory === cat ? BP_GREEN : "#E2E8F0",
                  background: activeCategory === cat ? BP_GREEN : "#fff",
                  color: activeCategory === cat ? "#fff" : "#475569",
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  boxShadow: activeCategory === cat ? `0 4px 12px ${BP_GREEN}40` : "0 1px 4px rgba(0,0,0,0.05)",
                  transition: "all .15s",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* MARKETPLACE TAB                            */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "marketplace" && (
          <>
            {/* ── Produits populaires ── */}
            <SectionHeader title="Produits populaires" onSeeAll={() => setActiveTab("produits")} />
            {productsLoading ? (
              <Skeleton />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
                {filteredProducts.slice(0, 4).map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isFav={favorites.includes(p.id)}
                    onFav={() => toggleFav(p.id)}
                    onClick={() => navigate(`/marketplace/${p.id}`)}
                  />
                ))}
              </div>
            )}

            {/* ── Services recommandés ── */}
            <SectionHeader title="Services recommandés" onSeeAll={() => setActiveTab("services")} />
            <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", marginBottom: 28, paddingBottom: 4 }}>
              {MOCK_SERVICES.map(s => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>

            {/* ── Emplois récents ── */}
            <SectionHeader title="Emplois récents" onSeeAll={() => setActiveTab("emplois")} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {displayJobs.slice(0, 3).map(j => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* PRODUITS TAB                               */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "produits" && (
          <>
            {/* Sell button */}
            <button
              onClick={() => navigate("/marketplace/create")}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: BP_GREEN, color: "#fff", border: "none", borderRadius: 14, padding: "13px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 16, boxShadow: `0 4px 14px ${BP_GREEN}50` }}
            >
              <IconPlus />
              Déposer une annonce
            </button>

            {/* My listings */}
            {myListings.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Mes annonces</span>
                  <span style={{ background: `${BP_GREEN}15`, color: BP_GREEN, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{myListings.length}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {myListings.map(listing => (
                    <div key={listing.id} style={{ background: "#fff", borderRadius: 16, border: `2px solid ${BP_GREEN}`, overflow: "hidden", position: "relative" }}>
                      <button onClick={() => { deleteListing(listing.id); refreshListings(); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(244,67,54,0.85)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", fontSize: 12, cursor: "pointer", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
                      <div style={{ height: 120, background: "#F1F5F9", overflow: "hidden" }}>
                        {listing.mediaUrls.length > 0
                          ? <img src={listing.mediaUrls[0]} alt={listing.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><IconTag /></div>
                        }
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0F172A" }}>{listing.name}</div>
                        <div style={{ fontWeight: 900, color: BP_GREEN, fontSize: 14, marginTop: 2 }}>{listing.price.toLocaleString()} FCFA</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products grid */}
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A", marginBottom: 12 }}>
              {filteredProducts.length} article{filteredProducts.length !== 1 ? "s" : ""} disponible{filteredProducts.length !== 1 ? "s" : ""}
            </div>
            {productsLoading ? <Skeleton /> : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {filteredProducts.map(p => (
                  <ProductCard key={p.id} product={p} isFav={favorites.includes(p.id)} onFav={() => toggleFav(p.id)} onClick={() => navigate(`/marketplace/${p.id}`)} />
                ))}
              </div>
            )}

            {/* Sell form sheet */}
            {showSellForm && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end" }} onClick={() => setShowSellForm(false)}>
                <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 16px 40px" }} onClick={e => e.stopPropagation()}>
                  <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "0 auto 20px" }} />
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A", marginBottom: 20 }}>Nouvelle annonce</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <FieldInput placeholder="Titre de l'article *" value={sellForm.name} onChange={v => setSellForm(f => ({ ...f, name: v }))} />
                    <FieldInput placeholder="Prix (FCFA) *" type="number" value={sellForm.price} onChange={v => setSellForm(f => ({ ...f, price: v }))} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <select value={sellForm.category} onChange={e => setSellForm(f => ({ ...f, category: e.target.value }))} style={selectStyle}>
                        {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                      </select>
                      <select value={sellForm.condition} onChange={e => setSellForm(f => ({ ...f, condition: e.target.value }))} style={selectStyle}>
                        <option>Neuf</option><option>Occasion</option><option>Reconditionné</option>
                      </select>
                    </div>
                    <select value={sellForm.country} onChange={e => setSellForm(f => ({ ...f, country: e.target.value }))} style={selectStyle}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                    </select>
                    <textarea
                      placeholder="Description (optionnel)..."
                      value={sellForm.description}
                      onChange={e => setSellForm(f => ({ ...f, description: e.target.value }))}
                      style={{ border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", fontSize: 14, resize: "none", height: 80, fontFamily: "inherit", outline: "none", color: "#0F172A" }}
                    />
                    {/* Photo upload */}
                    <button type="button" onClick={() => mediaInputRef.current?.click()} disabled={uploadingCount > 0} style={{ border: "2px dashed #E2E8F0", background: "#F8FAFC", borderRadius: 14, padding: "16px 0", cursor: "pointer", color: "#94A3B8", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <IconCamera />
                      {uploadingCount > 0 ? `Envoi en cours — ${progress}%` : "Ajouter des photos"}
                    </button>
                    {uploadedFiles.length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {uploadedFiles.map((f, idx) => (
                          <div key={idx} style={{ position: "relative", width: 70, height: 70, borderRadius: 10, overflow: "hidden", border: `2px solid ${BP_GREEN}` }}>
                            <img src={f.localUrl} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, background: "rgba(244,67,54,0.9)", border: "none", borderRadius: "50%", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      disabled={!sellForm.name.trim() || !sellForm.price || uploadingCount > 0}
                      onClick={handlePublish}
                      style={{ background: BP_GREEN, color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: (!sellForm.name.trim() || !sellForm.price || uploadingCount > 0) ? 0.5 : 1, boxShadow: `0 4px 14px ${BP_GREEN}40` }}
                    >
                      Publier l'annonce
                    </button>
                    <button onClick={() => { setShowSellForm(false); setUploadedFiles([]); }} style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 14, padding: "13px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SERVICES TAB                               */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "services" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A", marginBottom: 16 }}>Services recommandés</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {MOCK_SERVICES.map(s => (
                <div key={s.id} style={{ background: "#fff", borderRadius: 20, padding: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                      <img src={s.avatar} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    {s.verified && (
                      <div style={{ position: "absolute", bottom: 0, right: 0, background: "#fff", borderRadius: "50%", padding: 1 }}>
                        <IconVerified />
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{s.role}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 6 }}>
                      <IconStar />
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>{s.rating}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>({s.reviews})</span>
                    </div>
                  </div>
                  <button style={{ background: BP_GREEN, color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 3px 10px ${BP_GREEN}40` }}>
                    <IconPhone />
                    Contacter
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* EMPLOIS TAB                                */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === "emplois" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#0F172A", marginBottom: 16 }}>Emplois récents</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {displayJobs.map(j => (
                <JobCard key={j.id} job={j} full />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>{title}</span>
      <button onClick={onSeeAll} style={{ background: "none", border: "none", color: BP_GREEN, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Voir tout</button>
    </div>
  );
}

function ProductCard({ product, isFav, onFav, onClick }: {
  product: { id: number; title: string; price: number; imageUrl: string | null; location: string; views: number; discount: number | null };
  isFav: boolean; onFav: () => void; onClick: () => void;
}) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", position: "relative" }}>
      {/* Discount badge */}
      {product.discount && (
        <div style={{ position: "absolute", top: 10, left: 10, background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: 11, padding: "3px 8px", borderRadius: 20, zIndex: 2 }}>
          {product.discount}%
        </div>
      )}
      {/* Fav button */}
      <button
        onClick={e => { e.stopPropagation(); onFav(); }}
        style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.95)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.12)" }}
      >
        <IconHeart filled={isFav} />
      </button>
      {/* Image */}
      <div style={{ height: 130, background: "#F1F5F9", overflow: "hidden" }}>
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><IconTag /></div>
        }
      </div>
      {/* Info */}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{product.title}</div>
        <div style={{ fontWeight: 900, color: BP_GREEN, fontSize: 15, marginBottom: 6 }}>{product.price.toLocaleString()} FCFA</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
          <IconLocation />
          <span style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.location}</span>
        </div>
        {product.views > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconEye />
            <span style={{ fontSize: 11, color: "#94A3B8" }}>{formatNumber(product.views)} vues</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: typeof MOCK_SERVICES[0] }) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 140, flexShrink: 0 }}>
      <div style={{ position: "relative" }}>
        <div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <img src={service.avatar} alt={service.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        {service.verified && (
          <div style={{ position: "absolute", bottom: 0, right: 0, background: "#fff", borderRadius: "50%", padding: 1 }}><IconVerified /></div>
        )}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0F172A" }}>{service.name}</div>
        <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 1 }}>{service.role}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 5 }}>
          <IconStar />
          <span style={{ fontWeight: 700, fontSize: 12, color: "#0F172A" }}>{service.rating}</span>
          <span style={{ fontSize: 11, color: "#94A3B8" }}>({service.reviews})</span>
        </div>
      </div>
      <button style={{ background: BP_GREEN, color: "#fff", border: "none", borderRadius: 10, padding: "8px 0", fontWeight: 700, fontSize: 12, cursor: "pointer", width: "100%", boxShadow: `0 3px 10px ${BP_GREEN}40` }}>
        Contacter
      </button>
    </div>
  );
}

function JobCard({ job, full }: { job: typeof MOCK_JOBS[0]; full?: boolean }) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: job.logo, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
        {job.logoText}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
          <span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>{job.company}</span>
          {job.verified && <IconVerified />}
        </div>
        <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>{job.city}</div>
        {(full || true) && (
          <div style={{ fontSize: 12.5, color: BP_GREEN, fontWeight: 700, marginTop: 4 }}>{job.salary}</div>
        )}
      </div>
      <button style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
        <IconBookmark />
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ height: 130, background: "#F1F5F9" }} />
          <div style={{ padding: "10px 12px 12px" }}>
            <div style={{ height: 13, background: "#F1F5F9", borderRadius: 6, marginBottom: 8 }} />
            <div style={{ height: 15, background: "#F1F5F9", borderRadius: 6, width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldInput({ placeholder, value, onChange, type = "text" }: { placeholder: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "13px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", color: "#0F172A", background: "#fff" }}
    />
  );
}

const selectStyle: React.CSSProperties = {
  flex: 1, border: "1.5px solid #E2E8F0", borderRadius: 12, padding: "12px 14px",
  fontSize: 14, fontFamily: "inherit", outline: "none", color: "#0F172A", background: "#fff",
};
