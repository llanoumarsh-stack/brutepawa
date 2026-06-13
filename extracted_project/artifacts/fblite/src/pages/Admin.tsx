import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { STATS_BY_COUNTRY, formatNumber } from "../data/mock";
import { isAdmin } from "../lib/admin";
import { apiGetUsers, type PublicUser } from "../lib/api";

type AdminSection = "dashboard" | "users" | "content" | "jobs" | "reports" | "monetization" | "settings";

const REPORTS = [
  { id: 1, type: "Contenu inapproprié", reporter: "Aminata Diallo", target: "Publication #231", country: "🇸🇳 Sénégal", date: "Il y a 10 min", status: "En attente" },
  { id: 2, type: "Compte suspect", reporter: "Moussa Coulibaly", target: "Profil Jean-Claude M.", country: "🇧🇫 Burkina", date: "Il y a 1 h", status: "En cours" },
  { id: 3, type: "Arnaque marketplace", reporter: "Fatou Diop", target: "Annonce #889", country: "🇲🇱 Mali", date: "Il y a 3 h", status: "Résolu" },
  { id: 4, type: "Spam", reporter: "Yao Kouassi", target: "Commentaire #44", country: "🇨🇮 Côte d'Ivoire", date: "Hier", status: "Résolu" },
];

const PENDING_VERIFS = [
  { id: 1, name: "Ibrahim Traoré", country: "🇹🇬 Togo", request: "Badge vérifié", date: "Hier" },
  { id: 2, name: "Marie-Claire Mbaye", country: "🇨🇲 Cameroun", request: "Boutique Premium", date: "Il y a 2 j" },
  { id: 3, name: "Sylvie Ondoua", country: "🇬🇦 Gabon", request: "Publication sponsorisée", date: "Il y a 3 j" },
];

export default function Admin() {
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [reportStatuses, setReportStatuses] = useState<Record<number, string>>({});
  const [apiUsers, setApiUsers] = useState<PublicUser[]>([]);

  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : null;

  useEffect(() => {
    if (!user || !isAdmin(user.email)) {
      navigate("/");
      return;
    }
    apiGetUsers().then(setApiUsers).catch(() => {});
  }, []);

  if (!user || !isAdmin(user.email)) return null;

  const totalUsers = STATS_BY_COUNTRY.reduce((sum, c) => sum + c.users, 0);
  const totalActive = STATS_BY_COUNTRY.reduce((sum, c) => sum + c.active, 0);
  const totalPosts = STATS_BY_COUNTRY.reduce((sum, c) => sum + c.posts, 0);
  const totalJobs = STATS_BY_COUNTRY.reduce((sum, c) => sum + c.jobs, 0);

  const navBtn = (id: AdminSection, emoji: string, label: string) => (
    <button
      key={id}
      onClick={() => setSection(id)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "11px 16px", border: "none", textAlign: "left",
        cursor: "pointer", borderRadius: 8,
        background: section === id ? "var(--fb-blue-light)" : "transparent",
        color: section === id ? "var(--fb-blue)" : "var(--fb-text)",
        fontWeight: section === id ? 700 : 500, fontSize: 14,
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span> {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ background: "var(--fb-blue)", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>🛡️ Panneau Admin</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Brute Pawa · Tableau de bord régional</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background: "var(--fb-white)", padding: "8px", borderBottom: "1px solid var(--fb-divider)", display: "flex", overflowX: "auto", scrollbarWidth: "none", gap: 4 }}>
        {(["dashboard", "users", "content", "jobs", "reports", "monetization", "settings"] as AdminSection[]).map(id => {
          const labels: Record<AdminSection, [string, string]> = {
            dashboard: ["📊", "Stats"], users: ["👤", "Utilisateurs"], content: ["📝", "Contenus"],
            jobs: ["💼", "Emplois"], reports: ["⚠️", "Signalements"], monetization: ["💳", "Revenus"], settings: ["⚙️", "Config"]
          };
          const [emoji, label] = labels[id];
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                flex: "0 0 auto", padding: "8px 12px", background: "none", border: "none",
                borderBottom: section === id ? "3px solid var(--fb-blue)" : "3px solid transparent",
                color: section === id ? "var(--fb-blue)" : "var(--fb-text-secondary)",
                fontWeight: section === id ? 700 : 500, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {emoji} {label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 16 }}>

        {/* DASHBOARD */}
        {section === "dashboard" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>📊 Vue d'ensemble — Afrique francophone</div>

            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Utilisateurs total", value: formatNumber(totalUsers), icon: "👤", color: "#1877F2" },
                { label: "Actifs ce mois", value: formatNumber(totalActive), icon: "🟢", color: "#42B72A" },
                { label: "Publications", value: formatNumber(totalPosts), icon: "📝", color: "#9C27B0" },
                { label: "Offres d'emploi", value: formatNumber(totalJobs), icon: "💼", color: "#FF9800" },
              ].map((kpi, i) => (
                <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{kpi.icon}</div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Pending verifications */}
            {PENDING_VERIFS.length > 0 && (
              <div style={{ background: "#FFF8E1", border: "1px solid #FFD700", borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <div style={{ fontWeight: 700, marginBottom: 10, color: "#F57F17" }}>⏳ En attente de validation ({PENDING_VERIFS.length})</div>
                {PENDING_VERIFS.map(v => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #FFE082" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name} {v.country}</div>
                      <div style={{ fontSize: 12, color: "#F57F17" }}>{v.request} · {v.date}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ background: "#42B72A", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✓</button>
                      <button style={{ background: "#F44336", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✗</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Stats by country */}
            <div style={{ fontWeight: 700, marginBottom: 12 }}>🌍 Statistiques par pays</div>
            <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", overflow: "hidden" }}>
              {STATS_BY_COUNTRY.map((c, i) => {
                const maxUsers = STATS_BY_COUNTRY[0].users;
                const pct = Math.round((c.users / maxUsers) * 100);
                return (
                  <div key={c.code} style={{ padding: "12px 14px", borderTop: i > 0 ? "1px solid var(--fb-divider)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{c.flag}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>
                            {formatNumber(c.active)} actifs · {c.jobs} emplois
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, color: "var(--fb-blue)", fontSize: 14 }}>{formatNumber(c.users)}</div>
                        <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>utilisateurs</div>
                      </div>
                    </div>
                    <div style={{ background: "var(--fb-bg)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                      <div style={{ background: "var(--fb-blue)", height: "100%", width: `${pct}%`, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* UTILISATEURS */}
        {section === "users" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>👤 Gestion des utilisateurs</div>
            <input placeholder="🔍 Rechercher un utilisateur..." style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["Tous", "Vérifiés", "Premium", "Signalés", "Suspendus"].map(f => (
                <button key={f} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid var(--fb-border)", background: f === "Tous" ? "var(--fb-blue)" : "var(--fb-white)", color: f === "Tous" ? "#fff" : "var(--fb-text)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>{f}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {apiUsers.map(u => {
                const fullName = `${u.firstName} ${u.lastName}`.trim() || "Utilisateur";
                const initials = (u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "") || "?";
                return (
                <div key={u.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--fb-blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0, overflow: "hidden" }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      {fullName} {u.country && <span>{u.country}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>#{u.id} · {u.bio ?? "Membre Brute Pawa"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ background: "var(--fb-blue-light)", color: "var(--fb-blue)", border: "none", borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Voir</button>
                    <button style={{ background: "#FFF8E1", color: "#FF9800", border: "none", borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>⚠️</button>
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}

        {/* CONTENUS */}
        {section === "content" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>📝 Gestion des contenus</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Publications actives", value: "124 812", icon: "📝", action: "Voir tout" },
                { label: "Annonces marketplace", value: "18 430", icon: "🛍️", action: "Modérer" },
                { label: "Contenus signalés", value: "47", icon: "⚠️", action: "Traiter" },
                { label: "Pubs sponsorisées", value: "1 204", icon: "📢", action: "Gérer" },
              ].map((item, i) => (
                <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontWeight: 900, fontSize: 20, color: "var(--fb-blue)" }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginBottom: 8 }}>{item.label}</div>
                  <button style={{ background: "var(--fb-blue-light)", color: "var(--fb-blue)", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{item.action}</button>
                </div>
              ))}
            </div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Contenus récents à modérer</div>
            {["Publication signalée – Spam publicitaire", "Annonce suspecte – Électronique", "Commentaire haineux détecté", "Photo inappropriée signalée"].map((c, i) => (
              <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, flex: 1 }}>⚠️ {c}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ background: "#42B72A", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✓ Approuver</button>
                  <button style={{ background: "#F44336", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✗ Supprimer</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* EMPLOIS */}
        {section === "jobs" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>💼 Gestion des emplois & entreprises</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Offres actives", value: "4 289", icon: "💼" },
                { label: "Candidatures", value: "28 400", icon: "📋" },
                { label: "Entreprises inscrites", value: "1 840", icon: "🏢" },
                { label: "Recrutements réussis", value: "3 120", icon: "✅" },
              ].map((item, i) => (
                <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontWeight: 900, fontSize: 20, color: "var(--fb-blue)" }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Offres sponsorisées en attente</div>
            {[
              { title: "DG Commercial", company: "Groupe Ondoua", country: "🇬🇦 Gabon", budget: "45 000 FCFA" },
              { title: "Ingénieur DevOps", company: "TechHub Douala", country: "🇨🇲 Cameroun", budget: "80 000 FCFA" },
            ].map((job, i) => (
              <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{job.title}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{job.company} · {job.country} · {job.budget}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ background: "#42B72A", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Publier</button>
                  <button style={{ background: "#F44336", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Refuser</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* SIGNALEMENTS */}
        {section === "reports" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>⚠️ Gestion des signalements</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["Tous", "En attente", "En cours", "Résolu"].map(f => (
                <button key={f} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid var(--fb-border)", background: f === "Tous" ? "var(--fb-blue)" : "var(--fb-white)", color: f === "Tous" ? "#fff" : "var(--fb-text)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>{f}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {REPORTS.map(r => {
                const status = reportStatuses[r.id] ?? r.status;
                return (
                  <div key={r.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>⚠️ {r.type}</div>
                      <span style={{
                        background: status === "Résolu" ? "#f0f9f0" : status === "En cours" ? "#FFF8E1" : "#ffebee",
                        color: status === "Résolu" ? "#42B72A" : status === "En cours" ? "#FF9800" : "#F44336",
                        fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20
                      }}>{status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginBottom: 8 }}>
                      Signalé par : <strong>{r.reporter}</strong> · {r.country} · {r.date}
                      <br />Cible : {r.target}
                    </div>
                    {status !== "Résolu" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setReportStatuses(s => ({ ...s, [r.id]: "Résolu" }))}
                          style={{ flex: 1, background: "#42B72A", color: "#fff", border: "none", borderRadius: 6, padding: "7px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                          ✓ Résoudre
                        </button>
                        <button style={{ flex: 1, background: "#F44336", color: "#fff", border: "none", borderRadius: 6, padding: "7px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                          🚫 Suspendre
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* MONÉTISATION */}
        {section === "monetization" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>💳 Revenus & Monétisation</div>
            <div style={{ background: "linear-gradient(135deg, #1877F2, #9C27B0)", borderRadius: 16, padding: "20px", color: "#fff", marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>Revenus du mois (juin 2026)</div>
              <div style={{ fontSize: 40, fontWeight: 900, margin: "8px 0" }}>18 240 000 <span style={{ fontSize: 20 }}>FCFA</span></div>
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12, fontSize: 13 }}>
                <div><div style={{ fontWeight: 700 }}>+24%</div><div style={{ opacity: 0.8 }}>vs mai</div></div>
                <div><div style={{ fontWeight: 700 }}>14 pays</div><div style={{ opacity: 0.8 }}>actifs</div></div>
              </div>
            </div>
            {[
              { label: "Comptes Premium actifs", value: "8 420", icon: "⭐", revenue: "4 210 000 FCFA" },
              { label: "Publications sponsorisées", value: "1 204", icon: "📢", revenue: "7 824 000 FCFA" },
              { label: "Offres d'emploi sponsorisées", value: "312", icon: "💼", revenue: "3 120 000 FCFA" },
              { label: "Badges vérifiés vendus", value: "890", icon: "✅", revenue: "2 225 000 FCFA" },
              { label: "Boutiques Premium", value: "156", icon: "🏪", revenue: "780 000 FCFA" },
              { label: "Publicités entreprises", value: "84", icon: "🏢", revenue: "84 000 FCFA" },
            ].map((item, i) => (
              <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px", marginBottom: 8, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 28, width: 48, height: 48, background: "var(--fb-blue-light)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>{item.value} actifs</div>
                </div>
                <div style={{ fontWeight: 900, color: "#42B72A", fontSize: 14, textAlign: "right" }}>{item.revenue}</div>
              </div>
            ))}
          </>
        )}

        {/* SETTINGS */}
        {section === "settings" && (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>⚙️ Configuration plateforme</div>
            {[
              { emoji: "🌍", label: "Gestion des pays actifs", desc: "14 pays configurés" },
              { emoji: "💱", label: "Devises & taux de change", desc: "FCFA, GNF, CDF — synchronisé" },
              { emoji: "📱", label: "Mode économie de données", desc: "Activé par défaut" },
              { emoji: "🔔", label: "Paramètres de notification", desc: "Push, SMS, Email" },
              { emoji: "🔒", label: "Modération automatique", desc: "IA + équipe humaine" },
              { emoji: "📊", label: "Rapports hebdomadaires", desc: "Envoyés chaque lundi" },
              { emoji: "🎨", label: "Thèmes régionaux", desc: "Couleurs et langues par pays" },
            ].map((item, i) => (
              <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "13px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div style={{ fontSize: 22, width: 40, height: 40, background: "var(--fb-bg)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{item.desc}</div>
                </div>
                <span style={{ color: "var(--fb-text-secondary)", fontSize: 18 }}>›</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
