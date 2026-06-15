import React, { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { isAdmin, ADMIN_SECRET_PATH } from "../lib/admin";
import { apiGetTontines, apiGetCourses, apiGetEnrollments, apiGetWallet, apiGetBlockedUsers, apiUnblockUser, apiGetConversations, apiGetFriendRequests, apiGetGroups, apiGetUserStats, type ApiTontine, type ApiCourse, type ApiEnrollment, type BlockedUser } from "../lib/api";

const SCORE_MAP: Record<string, { label: string; color: string; next: string; emoji: string; progress: number; bg: string }> = {
  bronze:  { label: "Bronze",  color: "#CD7F32", bg: "#FFF8E1", next: "Argent",  emoji: "🥉", progress: 45 },
  argent:  { label: "Argent",  color: "#9E9E9E", bg: "#F5F5F5", next: "Or",      emoji: "🥈", progress: 70 },
  or:      { label: "Or",      color: "#FFD700", bg: "#FFFDE7", next: "Platine", emoji: "🏅", progress: 88 },
  platine: { label: "Platine", color: "#78909C", bg: "#ECEFF1", next: "Elite",   emoji: "💎", progress: 94 },
  elite:   { label: "Elite",   color: "#9C27B0", bg: "#F3E5F5", next: "Maximum", emoji: "⭐", progress: 100 },
};

type Section = "main" | "wallet" | "tontines" | "formations" | "emplois" | "boutiques" | "score" | "premium" | "settings" | "settings-privacy" | "settings-notifs" | "settings-lang" | "settings-appearance" | "settings-data" | "settings-verify" | "help" | "admin";

export default function Menu() {
  const navigate = useNavigate();
  const rawUser = localStorage.getItem("fb_user");
  const user = rawUser ? JSON.parse(rawUser) : { name: "Utilisateur", email: "", flag: "🌍", country: "" };
  const userInitials = user.name ? user.name.slice(0, 2).toUpperCase() : "ME";

  const [activeSection, setActiveSection] = useState<Section>("main");
  const [tontines, setTontines] = useState<ApiTontine[]>([]);
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [enrollments, setEnrollments] = useState<ApiEnrollment[]>([]);
  const [wallet, setWallet] = useState<{ balance: number; currency: string } | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedFetched, setBlockedFetched] = useState(false);

  const [userStats, setUserStats] = useState<{ postsCount: number; followersCount: number; followingCount: number } | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);

  useEffect(() => {
    Promise.all([apiGetTontines(), apiGetCourses(), apiGetEnrollments(), apiGetWallet()]).then(([t, c, e, w]) => {
      setTontines(t);
      setCourses(c);
      setEnrollments(e);
      if (w) setWallet({ balance: w.balance, currency: w.currency });
    }).catch(() => {});

    if (user.id) {
      apiGetUserStats(Number(user.id)).then(setUserStats).catch(() => {});
    }
    apiGetConversations().then(convs => {
      setUnreadMessages(convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0));
    }).catch(() => {});
    apiGetFriendRequests().then(reqs => setPendingRequests(reqs.length)).catch(() => {});
    apiGetGroups().then(groups => setGroupsCount(groups.length)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSection === "settings-privacy" && !blockedFetched && !blockedLoading) {
      setBlockedLoading(true);
      apiGetBlockedUsers().then(users => {
        setBlockedUsers(users);
        setBlockedFetched(true);
        setBlockedLoading(false);
      }).catch(() => {
        setBlockedFetched(true);
        setBlockedLoading(false);
      });
    }
  }, [activeSection, blockedFetched, blockedLoading]);

  const [isPremium, setIsPremium] = useState(false);

  // Settings state
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifJobs, setNotifJobs] = useState(true);
  const [notifTontines, setNotifTontines] = useState(true);
  const [dataSaver, setDataSaver] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedLang, setSelectedLang] = useState("Français");
  const [selectedCountry, setSelectedCountry] = useState(user.country || "Côte d'Ivoire");
  const [profilePublic, setProfilePublic] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);

  const score = SCORE_MAP["or"];

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("fb_user");
    navigate("/login");
  };

  const Back = ({ label }: { label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <button onClick={() => setActiveSection("main")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
      <div style={{ fontWeight: 800, fontSize: 20 }}>{label}</div>
    </div>
  );

  if (activeSection === "wallet") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="💳 Mon Portefeuille" />
      <div style={{ background: "linear-gradient(135deg, #1877F2, #42b0ff)", borderRadius: 16, padding: "24px 20px", color: "#fff", marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Solde disponible</div>
        <div style={{ fontSize: 36, fontWeight: 900 }}>{(wallet?.balance ?? 0).toLocaleString()} <span style={{ fontSize: 18 }}>{wallet?.currency ?? "FCFA"}</span></div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Mis à jour il y a 2 min</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[["📲 Dépôt", "MTN/Orange/Moov"], ["💸 Transfert", "P2P instantané"], ["🧾 Historique", "Transactions"], ["📊 Statistiques", "Revenus/Dépenses"]].map(([label, sub]) => (
          <button key={label} style={{ background: "var(--fb-white)", border: "1px solid var(--fb-divider)", borderRadius: 10, padding: "14px", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 2 }}>{sub}</div>
          </button>
        ))}
      </div>
      <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Transactions récentes</div>
        {[
          { desc: "Transfert reçu – Aminata", amount: "+25 000", date: "Hier", icon: "↙️", color: "#42B72A" },
          { desc: "Achat marketplace", amount: "-15 000", date: "3 juin", icon: "🛍️", color: "#F44336" },
          { desc: "Cotisation tontine", amount: "-50 000", date: "1er juin", icon: "💰", color: "#F44336" },
          { desc: "Vente article", amount: "+35 000", date: "28 mai", icon: "🏷️", color: "#42B72A" },
        ].map((tx, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? "1px solid var(--fb-divider)" : "none" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 24 }}>{tx.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{tx.desc}</div>
                <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{tx.date}</div>
              </div>
            </div>
            <div style={{ fontWeight: 700, color: tx.color }}>{tx.amount} FCFA</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (activeSection === "tontines") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="💰 Mes Tontines" />
      <button className="btn-primary" style={{ marginBottom: 16 }}>+ Créer une nouvelle tontine</button>
      {tontines.map(t => (
        <div key={t.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 32, width: 50, height: 50, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>💰</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
              <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>{t.membersCount} membres · {t.cycle}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div style={{ background: "var(--fb-bg)", borderRadius: 8, padding: 10, textAlign: "center" }}>
              <div style={{ fontWeight: 900, color: "var(--fb-blue)", fontSize: 16 }}>{t.contributionAmount.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>{t.currency}/{t.cycle}</div>
            </div>
            <div style={{ background: "var(--fb-bg)", borderRadius: 8, padding: 10, textAlign: "center" }}>
              <div style={{ fontWeight: 900, color: "#42B72A", fontSize: 16 }}>{t.status}</div>
              <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>statut</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--fb-text-secondary)" }}>
            📅 Prochaine échéance : <strong>{t.nextContributionDate ? new Date(t.nextContributionDate).toLocaleDateString('fr-FR') : "À définir"}</strong>
          </div>
          <button className="btn-primary" style={{ marginTop: 10, width: "100%", padding: 10 }}>💸 Payer ma cotisation</button>
        </div>
      ))}
    </div>
  );

  if (activeSection === "formations") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="🎓 Mes Formations" />
      <div style={{ fontWeight: 700, marginBottom: 12 }}>En cours</div>
      {courses.filter(c => enrollments.some(e => e.courseId === c.id)).map(course => {
        const cEmoji = ({"Tech":"💻","Business":"💼","Marketing":"📈","Finance":"💰","Design":"🎨","Santé":"🏥","Droit":"⚖️","Langue":"🌐","Développement personnel":"🧠","Agriculture":"🌾","Mode":"👗"} as Record<string, string>)[course.category] ?? "🎓";
        const cProg = enrollments.find(e => e.courseId === course.id)?.progress ?? 0;
        return (
          <div key={course.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ fontSize: 32, width: 50, height: 50, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cEmoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{course.title}</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Par Formateur</div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: "var(--fb-text-secondary)" }}>Progression</span>
                    <span style={{ fontWeight: 700, color: "var(--fb-blue)" }}>{cProg}%</span>
                  </div>
                  <div style={{ background: "var(--fb-bg)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ background: "var(--fb-blue)", height: "100%", width: `${cProg}%`, borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: 10, width: "100%", padding: 10 }}>▶ Continuer</button>
          </div>
        );
      })}
      <div style={{ fontWeight: 700, marginBottom: 12, marginTop: 8 }}>Recommandés</div>
      {courses.filter(c => !enrollments.some(e => e.courseId === c.id)).map(course => {
        const cEmoji = ({"Tech":"💻","Business":"💼","Marketing":"📈","Finance":"💰","Design":"🎨","Santé":"🏥","Droit":"⚖️","Langue":"🌐","Développement personnel":"🧠","Agriculture":"🌾","Mode":"👗"} as Record<string, string>)[course.category] ?? "🎓";
        const fmtD = (m: number) => !m ? "" : m >= 60 ? `${Math.round(m / 60)}h` : `${m}min`;
        return (
          <div key={course.id} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ fontSize: 32, width: 50, height: 50, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cEmoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{course.title}</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Par Formateur · {fmtD(course.duration)}</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>👥 {course.enrollmentsCount.toLocaleString()} apprenants</div>
                <div style={{ fontWeight: 700, color: (course.isFree || !course.price) ? "#42B72A" : "var(--fb-blue)", marginTop: 4 }}>
                  {(course.isFree || !course.price) ? "GRATUIT" : `${(course.price ?? 0).toLocaleString()} ${course.currency ?? "FCFA"}`}
                </div>
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: 10, width: "100%", padding: 10 }}>S'inscrire maintenant</button>
          </div>
        );
      })}
    </div>
  );

  if (activeSection === "score") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="🏅 Score de confiance" />
      <div style={{ background: `linear-gradient(135deg, ${score.color}44, ${score.bg})`, borderRadius: 16, padding: "24px 20px", textAlign: "center", marginBottom: 16, border: `2px solid ${score.color}` }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{score.emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#333" }}>Niveau {score.label}</div>
        <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>Prochain niveau : {score.next}</div>
        <div style={{ marginTop: 12, background: "rgba(255,255,255,0.6)", borderRadius: 8, height: 10, overflow: "hidden" }}>
          <div style={{ background: score.color, height: "100%", width: `${score.progress}%`, borderRadius: 8 }} />
        </div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{score.progress}% vers {score.next}</div>
      </div>

      <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Critères d'évaluation</div>
        {[
          { label: "Ancienneté du compte", value: 95, desc: "Compte créé il y a 2 ans" },
          { label: "Vérification téléphone", value: 100, desc: "✅ Téléphone vérifié" },
          { label: "Vérification identité", value: 80, desc: "Pièce d'identité soumise" },
          { label: "Activité du compte", value: 80, desc: "Très actif" },
          { label: "Avis reçus", value: 88, desc: "4.8/5 · 24 avis" },
          { label: "Transactions réussies", value: 92, desc: "48 transactions" },
          { label: "Fiabilité (délais)", value: 90, desc: "Livraisons à temps" },
          { label: "Signalements", value: 100, desc: "✅ Aucun signalement" },
        ].map(c => (
          <div key={c.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontSize: 13, color: "var(--fb-blue)", fontWeight: 700 }}>{c.value}%</span>
            </div>
            <div style={{ background: "var(--fb-bg)", borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{ background: "var(--fb-blue)", height: "100%", width: `${c.value}%`, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--fb-text-secondary)", marginTop: 2 }}>{c.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Les 5 niveaux</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Bronze",  emoji: "🥉", color: "#CD7F32", desc: "Score 0–49" },
            { label: "Argent",  emoji: "🥈", color: "#9E9E9E", desc: "Score 50–69" },
            { label: "Or",      emoji: "🏅", color: "#FFD700", desc: "Score 70–89", current: true },
            { label: "Platine", emoji: "💎", color: "#78909C", desc: "Score 90–95" },
            { label: "Elite",   emoji: "⭐", color: "#9C27B0", desc: "Score 96–100" },
          ].map(n => (
            <div key={n.label} style={{ background: n.current ? `${n.color}22` : "var(--fb-bg)", borderRadius: 8, padding: 10, textAlign: "center", border: n.current ? `2px solid ${n.color}` : "2px solid transparent" }}>
              <div style={{ fontSize: 24 }}>{n.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{n.label}</div>
              <div style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>{n.desc}</div>
              {n.current && <div style={{ fontSize: 10, color: n.color, fontWeight: 700, marginTop: 2 }}>← VOUS</div>}
            </div>
          ))}
          <div style={{ background: "linear-gradient(135deg, #F3E5F5, #E1BEE7)", borderRadius: 8, padding: 10, textAlign: "center", border: "2px solid #9C27B0" }}>
            <div style={{ fontSize: 24 }}>👑</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#9C27B0" }}>Elite Pro</div>
            <div style={{ fontSize: 11, color: "#7B1FA2" }}>Badge exclusif</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (activeSection === "premium") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="⭐ Compte Premium" />
      {isPremium ? (
        <div style={{ background: "linear-gradient(135deg, #9C27B0, #E91E63)", borderRadius: 16, padding: "24px 20px", color: "#fff", textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>👑</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Vous êtes Premium !</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>Renouvellement le 11 juillet 2026</div>
        </div>
      ) : (
        <div style={{ background: "linear-gradient(135deg, #1877F2, #9C27B0)", borderRadius: 16, padding: "24px 20px", color: "#fff", textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⭐</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Passez à Premium</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>Boostez votre visibilité sur toute l'Afrique</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Mensuel", price: "2 500 FCFA/mois" },
          { label: "Annuel", price: "24 000 FCFA/an", badge: "-20%" },
        ].map((plan, i) => (
          <button
            key={i}
            onClick={() => setIsPremium(true)}
            style={{ flex: 1, background: i === 1 ? "var(--fb-blue)" : "var(--fb-white)", color: i === 1 ? "#fff" : "var(--fb-text)", border: `2px solid ${i === 1 ? "var(--fb-blue)" : "var(--fb-border)"}`, borderRadius: 10, padding: "14px 10px", cursor: "pointer", position: "relative", textAlign: "center" }}
          >
            {plan.badge && <span style={{ position: "absolute", top: -10, right: 8, background: "#42B72A", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10 }}>{plan.badge}</span>}
            <div style={{ fontWeight: 700 }}>{plan.label}</div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>{plan.price}</div>
          </button>
        ))}
      </div>

      <div style={{ fontWeight: 700, marginBottom: 12 }}>Avantages Premium</div>
      {[
        { icon: "🔝", title: "Profil mis en avant", desc: "Apparaissez en premier dans les recherches" },
        { icon: "📢", title: "Publications boostées", desc: "+3x de visibilité sur vos posts" },
        { icon: "✅", title: "Badge vérifié doré", desc: "Crédibilité et confiance renforcées" },
        { icon: "📊", title: "Statistiques avancées", desc: "Vues, clics, portée par pays" },
        { icon: "🛍️", title: "Boutique Premium", desc: "Bannière publicitaire + catalogue enrichi" },
        { icon: "💼", title: "Offres d'emploi sponsorisées", desc: "Vos annonces en tête de liste" },
        { icon: "💬", title: "Messagerie prioritaire", desc: "Notifications push en temps réel" },
        { icon: "🌍", title: "Visibilité multi-pays", desc: "Diffusion dans les 14 pays cibles" },
      ].map((benefit, i) => (
        <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "12px 14px", marginBottom: 8, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 22, width: 40, height: 40, background: "var(--fb-blue-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{benefit.icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{benefit.title}</div>
            <div style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>{benefit.desc}</div>
          </div>
        </div>
      ))}
      {!isPremium && (
        <button className="btn-primary" style={{ width: "100%", padding: 14, marginTop: 8, fontSize: 16 }} onClick={() => setIsPremium(true)}>
          ⭐ Activer Premium maintenant
        </button>
      )}
    </div>
  );

  if (activeSection === "emplois") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="💼 Mes offres d'emploi" />
      <button className="btn-primary" style={{ marginBottom: 16 }}>+ Publier une offre</button>
      <div style={{ textAlign: "center", padding: 40, color: "var(--fb-text-secondary)", background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontWeight: 600 }}>Aucune offre publiée</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>Créez votre première offre pour attirer des talents</div>
      </div>
    </div>
  );

  if (activeSection === "boutiques") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="🏪 Mes boutiques" />
      <button className="btn-primary" style={{ marginBottom: 16 }}>+ Créer ma boutique</button>
      <div style={{ textAlign: "center", padding: 40, color: "var(--fb-text-secondary)", background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
        <div style={{ fontWeight: 600 }}>Vous n'avez pas encore de boutique</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>Lancez votre boutique et vendez à toute l'Afrique francophone</div>
      </div>
    </div>
  );

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <div onClick={onChange} style={{
      width: 48, height: 26, borderRadius: 13, background: value ? "var(--fb-blue)" : "#ccc",
      position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 2, left: value ? 24 : 2, transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
      }} />
    </div>
  );

  if (activeSection === "settings") return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setActiveSection("main")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <div style={{ fontWeight: 900, fontSize: 20 }}>⚙️ Paramètres</div>
      </div>
      <div style={{ padding: "8px 0" }}>
        {[
          { emoji: "🔒", label: "Confidentialité", desc: "Gérer qui voit vos informations", action: () => setActiveSection("settings-privacy") },
          { emoji: "🔔", label: "Notifications", desc: "Personnaliser vos alertes", action: () => setActiveSection("settings-notifs") },
          { emoji: "🌐", label: "Langue & région", desc: `${selectedLang} · ${selectedCountry}`, action: () => setActiveSection("settings-lang") },
          { emoji: "📱", label: "Mode données", desc: `Économiseur : ${dataSaver ? "Activé" : "Désactivé"}`, action: () => setActiveSection("settings-data") },
          { emoji: "🎨", label: "Apparence", desc: darkMode ? "Thème sombre" : "Thème clair", action: () => setActiveSection("settings-appearance") },
          { emoji: "📞", label: "Vérification du compte", desc: phoneSaved ? `✅ Téléphone vérifié` : "Ajouter votre numéro de téléphone", action: () => setActiveSection("settings-verify") },
          { emoji: "✅", label: "Badge vérifié", desc: "Vérification identité · 2 500 FCFA", action: () => setActiveSection("premium") },
          { emoji: "💳", label: "Compte Premium", desc: isPremium ? "✅ Actif" : "Passer à Premium · 2 500 FCFA/mois", action: () => setActiveSection("premium") },
        ].map((item, i) => (
          <div key={i} onClick={item.action} style={{
            background: "var(--fb-white)", padding: "14px 16px", borderBottom: "1px solid var(--fb-divider)",
            display: "flex", alignItems: "center", gap: 12, cursor: "pointer"
          }}>
            <div style={{ fontSize: 22, width: 42, height: 42, background: "var(--fb-bg)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>{item.desc}</div>
            </div>
            <span style={{ color: "var(--fb-text-secondary)", fontSize: 20 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (activeSection === "settings-privacy") {
    const handleUnblock = async (userId: number) => {
      try {
        await apiUnblockUser(userId);
        setBlockedUsers(prev => prev.filter(u => u.id !== userId));
      } catch {}
    };

    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setActiveSection("settings")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
          <div style={{ fontWeight: 900, fontSize: 18 }}>🔒 Confidentialité</div>
        </div>
        <div style={{ padding: "8px 0" }}>
          {[
            { label: "Profil public", desc: "Tout le monde peut voir votre profil", value: profilePublic, onChange: () => setProfilePublic(v => !v) },
            { label: "Afficher mon téléphone", desc: "Visible par vos contacts", value: showPhone, onChange: () => setShowPhone(v => !v) },
            { label: "Afficher mon email", desc: "Visible dans votre profil public", value: showEmail, onChange: () => setShowEmail(v => !v) },
          ].map((item, i) => (
            <div key={i} style={{ background: "var(--fb-white)", padding: "14px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>{item.desc}</div>
              </div>
              <Toggle value={item.value} onChange={item.onChange} />
            </div>
          ))}
          <div style={{ padding: "14px 16px", background: "var(--fb-white)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Utilisateurs bloqués</div>
            {blockedLoading ? (
              <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", padding: "8px 0" }}>Chargement…</div>
            ) : blockedUsers.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Aucun utilisateur bloqué</div>
            ) : (
              blockedUsers.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--fb-divider)" }}>
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--fb-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                      {u.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{u.firstName} {u.lastName}</div>
                  <button
                    onClick={() => handleUnblock(u.id)}
                    style={{ background: "none", border: "1px solid var(--fb-blue)", color: "var(--fb-blue)", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    Débloquer
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "settings-notifs") return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setActiveSection("settings")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <div style={{ fontWeight: 900, fontSize: 18 }}>🔔 Notifications</div>
      </div>
      <div style={{ padding: "8px 0" }}>
        {[
          { emoji: "❤️", label: "J'aime & réactions", value: notifLikes, onChange: () => setNotifLikes(v => !v) },
          { emoji: "💬", label: "Commentaires", value: notifComments, onChange: () => setNotifComments(v => !v) },
          { emoji: "✉️", label: "Messages privés", value: notifMessages, onChange: () => setNotifMessages(v => !v) },
          { emoji: "💼", label: "Nouvelles offres d'emploi", value: notifJobs, onChange: () => setNotifJobs(v => !v) },
          { emoji: "💰", label: "Rappels tontines", value: notifTontines, onChange: () => setNotifTontines(v => !v) },
        ].map((item, i) => (
          <div key={i} style={{ background: "var(--fb-white)", padding: "14px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{item.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
            </div>
            <Toggle value={item.value} onChange={item.onChange} />
          </div>
        ))}
      </div>
    </div>
  );

  if (activeSection === "settings-lang") return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setActiveSection("settings")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <div style={{ fontWeight: 900, fontSize: 18 }}>🌐 Langue & région</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Langue</div>
        {["Français", "English", "Wolof", "Hausa", "Bambara"].map(lang => (
          <div key={lang} onClick={() => setSelectedLang(lang)} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "13px 16px", background: "var(--fb-white)", borderRadius: 10, marginBottom: 6,
            border: selectedLang === lang ? "2px solid var(--fb-blue)" : "1px solid var(--fb-divider)", cursor: "pointer"
          }}>
            <span style={{ fontWeight: selectedLang === lang ? 800 : 500 }}>{lang}</span>
            {selectedLang === lang && <span style={{ color: "var(--fb-blue)", fontWeight: 700 }}>✓</span>}
          </div>
        ))}
        <div style={{ fontWeight: 700, marginTop: 16, marginBottom: 10 }}>Pays / Région</div>
        {["Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Bénin", "Togo", "Guinée", "RD Congo"].map(c => (
          <div key={c} onClick={() => setSelectedCountry(c)} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "13px 16px", background: "var(--fb-white)", borderRadius: 10, marginBottom: 6,
            border: selectedCountry === c ? "2px solid var(--fb-blue)" : "1px solid var(--fb-divider)", cursor: "pointer"
          }}>
            <span style={{ fontWeight: selectedCountry === c ? 800 : 500 }}>{c}</span>
            {selectedCountry === c && <span style={{ color: "var(--fb-blue)", fontWeight: 700 }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  );

  if (activeSection === "settings-appearance") return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setActiveSection("settings")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <div style={{ fontWeight: 900, fontSize: 18 }}>🎨 Apparence</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Thème</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Clair", emoji: "☀️", active: !darkMode, onClick: () => setDarkMode(false) },
            { label: "Sombre", emoji: "🌙", active: darkMode, onClick: () => setDarkMode(true) },
          ].map(t => (
            <div key={t.label} onClick={t.onClick} style={{
              flex: 1, textAlign: "center", padding: "20px 0", borderRadius: 12, cursor: "pointer",
              border: t.active ? "2px solid var(--fb-blue)" : "2px solid var(--fb-divider)",
              background: t.active ? "var(--fb-blue-light)" : "var(--fb-white)"
            }}>
              <div style={{ fontSize: 32 }}>{t.emoji}</div>
              <div style={{ fontWeight: 700, marginTop: 6, color: t.active ? "var(--fb-blue)" : "var(--fb-text)" }}>{t.label}</div>
              {t.active && <div style={{ fontSize: 12, color: "var(--fb-blue)" }}>✓ Actif</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--fb-divider)" }}>
          <div>
            <div style={{ fontWeight: 700 }}>Lecture auto des vidéos</div>
            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Lire automatiquement les vidéos dans le fil</div>
          </div>
          <Toggle value={autoPlay} onChange={() => setAutoPlay(v => !v)} />
        </div>
      </div>
    </div>
  );

  if (activeSection === "settings-data") return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setActiveSection("settings")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <div style={{ fontWeight: 900, fontSize: 18 }}>📱 Mode données</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--fb-white)", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid var(--fb-divider)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Économiseur de données</div>
            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>Réduit la qualité des images et vidéos</div>
          </div>
          <Toggle value={dataSaver} onChange={() => setDataSaver(v => !v)} />
        </div>
        <div style={{ background: dataSaver ? "#E8F5E9" : "var(--fb-bg)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: dataSaver ? "#2E7D32" : "var(--fb-text-secondary)" }}>
            {dataSaver ? "✅ Économiseur actif — données réduites" : "Mode normal — qualité maximale"}
          </div>
          <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 4 }}>
            {dataSaver ? "Vous économisez jusqu'à 70% de données mobiles." : "Toutes les images et vidéos sont chargées en haute qualité."}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--fb-white)", borderRadius: 12, padding: 16, border: "1px solid var(--fb-divider)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Téléchargements auto</div>
            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginTop: 2 }}>Télécharger les médias en Wi-Fi uniquement</div>
          </div>
          <Toggle value={!dataSaver} onChange={() => setDataSaver(v => !v)} />
        </div>
      </div>
    </div>
  );

  if (activeSection === "settings-verify") return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setActiveSection("settings")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-blue)" }}>←</button>
        <div style={{ fontWeight: 900, fontSize: 18 }}>📞 Vérification du compte</div>
      </div>
      <div style={{ padding: 16 }}>
        {phoneSaved ? (
          <div style={{ background: "#E8F5E9", borderRadius: 16, padding: 20, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, color: "#2E7D32" }}>Téléphone vérifié</div>
            <div style={{ fontSize: 14, color: "#388E3C", marginTop: 4 }}>{phone}</div>
          </div>
        ) : (
          <div style={{ background: "var(--fb-white)", borderRadius: 16, padding: 20, border: "1px solid var(--fb-divider)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Numéro de téléphone</div>
            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 14 }}>
              Ajoutez votre numéro pour sécuriser votre compte et permettre aux autres de vous trouver.
            </div>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+225 07 XX XX XX XX"
              style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 15, marginBottom: 14, boxSizing: "border-box" }}
            />
            <button
              onClick={() => { if (phone.trim()) setPhoneSaved(true); }}
              disabled={!phone.trim()}
              style={{ width: "100%", background: phone.trim() ? "var(--fb-blue)" : "#ccc", color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer" }}
            >
              Envoyer le code de vérification
            </button>
          </div>
        )}
        <div style={{ background: "var(--fb-white)", borderRadius: 12, padding: 16, border: "1px solid var(--fb-divider)", marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Sécurité du compte</div>
          {[
            { icon: "🔑", label: "Changer le mot de passe", action: () => {} },
            { icon: "📧", label: "Modifier l'email", action: () => {} },
            { icon: "🛡️", label: "Authentification à deux facteurs", action: () => {} },
          ].map((item, i) => (
            <div key={i} onClick={item.action} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i > 0 ? "1px solid var(--fb-divider)" : "none", cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
              </div>
              <span style={{ color: "var(--fb-text-secondary)" }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (activeSection === "help") return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <Back label="❓ Centre d'aide" />
      <input placeholder="🔍 Que puis-je vous aider ?" style={{ marginBottom: 16 }} />
      {[
        { emoji: "🔑", title: "Compte et sécurité", items: ["Réinitialiser mon mot de passe", "Protéger mon compte", "Vérification en deux étapes"] },
        { emoji: "💬", title: "Publications et fil", items: ["Créer une publication", "Signaler un contenu", "Paramètres de confidentialité"] },
        { emoji: "💳", title: "Paiements et wallet", items: ["Déposer de l'argent", "Envoyer un transfert", "Problème de transaction"] },
        { emoji: "🛍️", title: "Marketplace", items: ["Acheter en toute sécurité", "Signaler une annonce", "Politique de remboursement"] },
        { emoji: "🌍", title: "Multi-pays", items: ["Acheter depuis un autre pays", "Taux de change", "Livraison internationale"] },
      ].map((section, i) => (
        <div key={i} style={{ background: "var(--fb-white)", borderRadius: 10, border: "1px solid var(--fb-divider)", padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>{section.emoji}</span> {section.title}
          </div>
          {section.items.map((item, j) => (
            <div key={j} style={{ padding: "8px 0", borderTop: j > 0 ? "1px solid var(--fb-divider)" : "none", fontSize: 14, color: "var(--fb-blue)", cursor: "pointer" }}>
              {item} →
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // ─── MAIN MENU — Ultra Premium 2026 ───
  const handle = user.name
    ? "@" + user.name.toLowerCase().replace(/\s+/g, "_")
    : "@utilisateur";

  type GridCard = {
    label: string;
    sub: string;
    bg: string;
    iconColor: string;
    badge: number;
    action: () => void;
    icon: (c: string) => React.ReactNode;
  };

  const gridCards: GridCard[] = [
    {
      label: "Reels", sub: "Découvrez et partagez des vidéos courtes",
      bg: "#FFE8E8", iconColor: "#EF5350", badge: 0, action: () => navigate("/reels"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <rect x="1" y="6" width="28" height="23" rx="5" fill="#EF5350"/>
          <rect x="1" y="3" width="28" height="8" rx="4" fill="#C62828"/>
          <rect x="5" y="1" width="4" height="10" rx="2" fill="#EF5350"/>
          <rect x="13" y="1" width="4" height="10" rx="2" fill="#EF5350"/>
          <rect x="21" y="1" width="4" height="10" rx="2" fill="#EF5350"/>
          <circle cx="5.5" cy="16" r="2.2" fill="#FFCDD2"/>
          <circle cx="5.5" cy="23" r="2.2" fill="#FFCDD2"/>
          <circle cx="24.5" cy="16" r="2.2" fill="#FFCDD2"/>
          <circle cx="24.5" cy="23" r="2.2" fill="#FFCDD2"/>
          <circle cx="15" cy="19.5" r="6.5" fill="#B71C1C"/>
          <polygon points="12.5,17.5 20,19.5 12.5,21.5" fill="white"/>
        </svg>
      ),
    },
    {
      label: "Messages", sub: "Discutez avec vos amis en privé",
      bg: "#E8F0FE", iconColor: "#1E88E5", badge: unreadMessages, action: () => navigate("/messages"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <path d="M3 3 H27 A3 3 0 0 1 30 6 V20 A3 3 0 0 1 27 23 H11 L3 29 V23 A3 3 0 0 1 0 20 V6 A3 3 0 0 1 3 3 Z" fill="#1E88E5"/>
          <circle cx="9" cy="13" r="2.3" fill="white"/>
          <circle cx="15" cy="13" r="2.3" fill="white"/>
          <circle cx="21" cy="13" r="2.3" fill="white"/>
        </svg>
      ),
    },
    {
      label: "Groupes", sub: "Rejoignez des communautés qui vous passionnent",
      bg: "#E8F5E9", iconColor: "#43A047", badge: groupsCount, action: () => navigate("/groups"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <circle cx="20" cy="10" r="5" fill="#81C784"/>
          <path d="M13 28 C13 22 16.5 18 20 18 C23.5 18 27 22 27 28 Z" fill="#81C784"/>
          <circle cx="11" cy="11" r="6.5" fill="#2E7D32"/>
          <path d="M2 29 C2 22.5 6 17 11 17 C16 17 20 22.5 20 29 Z" fill="#2E7D32"/>
        </svg>
      ),
    },
    {
      label: "Ami(e)s", sub: "Retrouvez vos amis et faites-en de nouveaux",
      bg: "#FFF8E1", iconColor: "#FB8C00", badge: pendingRequests, action: () => navigate("/friends"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <circle cx="11" cy="11" r="6.5" fill="#FB8C00"/>
          <path d="M2 29 C2 22 6.5 17 11 17 C14.5 17 17.5 18.5 19.5 21.5" fill="#FB8C00" fillOpacity="0.8"/>
          <circle cx="23" cy="23" r="7" fill="#FFB74D"/>
          <rect x="19.5" y="21.5" width="7" height="3" rx="1.5" fill="white"/>
          <rect x="21.5" y="19.5" width="3" height="7" rx="1.5" fill="white"/>
        </svg>
      ),
    },
    {
      label: "Marketplace", sub: "Achetez et vendez en toute sécurité",
      bg: "#EDE7F6", iconColor: "#7E57C2", badge: 0, action: () => navigate("/marketplace"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <rect x="3" y="11" width="24" height="17" rx="4" fill="#7E57C2"/>
          <path d="M10 11 V8 A5 5 0 0 1 20 8 V11" stroke="#CE93D8" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <rect x="9" y="17" width="12" height="3" rx="1.5" fill="#CE93D8"/>
          <circle cx="15" cy="23" r="2.5" fill="#9575CD"/>
        </svg>
      ),
    },
    {
      label: "Portefeuille", sub: "Gérez vos paiements et transactions",
      bg: "#E0F2F1", iconColor: "#00897B", badge: 0, action: () => navigate("/wallet"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <rect x="2" y="9" width="26" height="18" rx="5" fill="#00897B"/>
          <rect x="2" y="9" width="26" height="6" rx="3" fill="#00695C"/>
          <rect x="16" y="15" width="11" height="7" rx="3" fill="#B2DFDB"/>
          <circle cx="21.5" cy="18.5" r="2.5" fill="#00897B"/>
          <rect x="4" y="16" width="9" height="2" rx="1" fill="#B2DFDB"/>
          <rect x="4" y="20" width="6" height="2" rx="1" fill="#B2DFDB"/>
        </svg>
      ),
    },
    {
      label: "Pages", sub: "Gérez vos pages et développez votre audience",
      bg: "#E1F5FE", iconColor: "#039BE5", badge: 0, action: () => {},
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <rect x="6" y="4" width="3.5" height="24" rx="1.75" fill="#0277BD"/>
          <path d="M9.5 5 L27 5 L22.5 13.5 L27 22 L9.5 22 Z" fill="#039BE5"/>
          <path d="M9.5 5 L27 5 L22.5 13.5" fill="#29B6F6" opacity="0.35"/>
        </svg>
      ),
    },
    {
      label: "Évènements", sub: "Découvrez les événements autour de vous",
      bg: "#FFF3E0", iconColor: "#F4511E", badge: 0, action: () => navigate("/events"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <rect x="2" y="7" width="26" height="22" rx="5" fill="#F4511E"/>
          <rect x="2" y="7" width="26" height="9" rx="5" fill="#BF360C"/>
          <rect x="2" y="12" width="26" height="4" fill="#BF360C"/>
          <rect x="8" y="3" width="4" height="8" rx="2" fill="#FFCCBC"/>
          <rect x="18" y="3" width="4" height="8" rx="2" fill="#FFCCBC"/>
          <text x="15" y="24.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="system-ui,Arial,sans-serif">17</text>
        </svg>
      ),
    },
    {
      label: "Brute Vérifié", sub: "Compte vérifié et sécurisé",
      bg: "#E8F5E9", iconColor: "#22C55E", badge: 0, action: () => setActiveSection("settings-verify"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <path d="M15 2 L28 7.5 V15 C28 22.5 22 27.5 15 30 C8 27.5 2 22.5 2 15 V7.5 Z" fill="#2E7D32"/>
          <path d="M15 2 L28 7.5 V15 C28 22.5 22 27.5 15 30" fill="#388E3C" opacity="0.45"/>
          <polyline points="9,16 13,20 21,11" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: "Tontines", sub: "Gérez et participez à des tontines",
      bg: "#FFF8E1", iconColor: "#F9A825", badge: tontines.length, action: () => navigate("/tontines"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <ellipse cx="15" cy="8" rx="5.5" ry="3.5" fill="#F57F17"/>
          <ellipse cx="15" cy="21" rx="12" ry="10" fill="#F9A825"/>
          <ellipse cx="11" cy="17" rx="4" ry="5" fill="#FFD54F" opacity="0.45"/>
          <text x="15" y="25" textAnchor="middle" fontSize="12" fontWeight="900" fill="#E65100" fontFamily="system-ui,Arial,sans-serif">$</text>
        </svg>
      ),
    },
    {
      label: "Fils", sub: "Actualités et contenus personnalisés",
      bg: "#E3F2FD", iconColor: "#1E88E5", badge: 0, action: () => navigate("/"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <path d="M2 10 H13.5 L16.5 7 H28 A2 2 0 0 1 30 9 V12 H2 Z" fill="#1565C0"/>
          <rect x="2" y="11" width="26" height="17" rx="4" fill="#1E88E5"/>
          <rect x="7" y="16.5" width="14" height="2.5" rx="1.25" fill="#BBDEFB"/>
          <rect x="7" y="21" width="10" height="2.5" rx="1.25" fill="#BBDEFB"/>
        </svg>
      ),
    },
    {
      label: "Formations", sub: "Développez vos compétences et apprenez",
      bg: "#EDE7F6", iconColor: "#7E57C2", badge: 0, action: () => navigate("/formations"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <polygon points="15,4 29,12 15,20 1,12" fill="#7E57C2"/>
          <rect x="26" y="12" width="3" height="9" rx="1.5" fill="#9575CD"/>
          <circle cx="27.5" cy="23" r="2.5" fill="#673AB7"/>
          <path d="M8 16 V22 C8 22 11 27 15 27 C19 27 22 22 22 22 V16 L15 20 Z" fill="#5E35B1"/>
        </svg>
      ),
    },
    {
      label: "Score", sub: "Boostez votre score et gagnez en visibilité",
      bg: "#FFF8E1", iconColor: "#FB8C00", badge: 0, action: () => setActiveSection("score"),
      icon: (_c) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <path d="M10.5 13 L7.5 29 L15 24 L22.5 29 L19.5 13" fill="#E65100"/>
          <circle cx="15" cy="13" r="11" fill="#FF8F00"/>
          <circle cx="15" cy="13" r="8.5" fill="#FFB300"/>
          <polygon points="15,7 16.8,12 22,12 17.6,15.2 19.4,20.5 15,17.3 10.6,20.5 12.4,15.2 8,12 13.2,12" fill="#E65100"/>
        </svg>
      ),
    },
    ...(isAdmin(user.email) ? [{
      label: "Admin", sub: "Panneau d'administration",
      bg: "#FCE4EC", iconColor: "#E91E63", badge: 0, action: () => navigate(ADMIN_SECRET_PATH),
      icon: (_c: string) => (
        <svg width="30" height="30" viewBox="0 0 30 30">
          <path d="M15 2 L28 7.5 V15 C28 22.5 22 27.5 15 30 C8 27.5 2 22.5 2 15 V7.5 Z" fill="#C2185B"/>
          <text x="15" y="20" textAnchor="middle" fontSize="13" fontWeight="900" fill="white" fontFamily="system-ui,Arial,sans-serif">A</text>
        </svg>
      ),
    } as GridCard] : []),
  ];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", background: "#F8FAFC", minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── HEADER ── */}
      <div style={{ background: "#fff", padding: "16px 16px 14px", borderBottom: "1px solid #E8EEF4" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 26, color: "#0D1B2A", letterSpacing: -0.5, lineHeight: 1.2 }}>Menu</div>
            <div style={{ fontSize: 13, color: "#8896A6", marginTop: 3, lineHeight: 1.4 }}>Accédez rapidement à tout ce dont vous avez besoin.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ background: "#F1F5F9", border: "none", width: 38, height: 38, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </button>
            <button onClick={() => setActiveSection("settings")} style={{ background: "#F1F5F9", border: "none", width: 38, height: 38, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── USER CARD ── */}
        <div
          onClick={() => navigate("/profile")}
          style={{
            background: "linear-gradient(135deg, #fff 55%, #F0FDF4)",
            borderRadius: 20, padding: 16, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(34,197,94,0.12), 0 1px 4px rgba(0,0,0,0.06)",
            border: "1px solid #DCFCE7", overflow: "hidden", position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(34,197,94,0.07)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -32, right: 36, width: 90, height: 90, borderRadius: "50%", background: "rgba(34,197,94,0.05)", pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid #22C55E" }} />
                : <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #22C55E, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", border: "3px solid #fff", boxShadow: "0 2px 8px rgba(34,197,94,0.4)" }}>{userInitials}</div>
              }
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: "50%", background: "#22C55E", border: "2.5px solid #fff" }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 900, fontSize: 17, color: "#0D1B2A" }}>{user.name}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1E88E5" stroke="none">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, color: "#8896A6", marginTop: 2 }}>{handle}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, background: "#DCFCE7", borderRadius: 20, padding: "3px 10px" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>Vérifié</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
              <div style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#FFD700" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Niveau 4</span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <div style={{ display: "flex", marginTop: 14, paddingTop: 14, borderTop: "1px solid #DCFCE7" }}>
            {[
              { value: "23", label: "Publications" },
              { value: "1.2K", label: "Abonnés" },
              { value: "320", label: "Abonnements" },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid #DCFCE7" : "none" }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#0D1B2A" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#8896A6", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CHANGER DE COMPTE ── */}
        <div
          style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}
          onPointerDown={e => (e.currentTarget.style.background = "#F8FAFC")}
          onPointerUp={e => (e.currentTarget.style.background = "#fff")}
          onPointerLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1B2A" }}>Changer de compte</div>
            <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2 }}>Gérez vos comptes facilement</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {/* ── INVITER DES AMI(E)S ── */}
        <div
          style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}
          onPointerDown={e => (e.currentTarget.style.background = "#F8FAFC")}
          onPointerUp={e => (e.currentTarget.style.background = "#fff")}
          onPointerLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#FFF0F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#EF5350" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1B2A" }}>Inviter des ami(e)s</div>
            <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2 }}>Plus d'amis, plus de fun</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#FFF8E1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FB8C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"/>
                <rect x="2" y="7" width="20" height="5"/>
                <line x1="12" y1="22" x2="12" y2="7"/>
                <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
                <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
              </svg>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* ── GRILLE 2 COLONNES ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {gridCards.map((card, i) => (
            <div
              key={i}
              onClick={card.action}
              style={{
                background: "#fff", borderRadius: 16, padding: "14px 14px 12px",
                cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                display: "flex", flexDirection: "column", gap: 10, position: "relative",
                border: "1px solid rgba(0,0,0,0.04)", transition: "transform 0.1s",
              }}
              onPointerDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
              onPointerUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
              onPointerLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {card.badge > 0 && (
                <div style={{ position: "absolute", top: 10, right: 10, background: "#22C55E", color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {card.badge > 99 ? "99+" : card.badge}
                </div>
              )}
              <div style={{ width: 50, height: 50, borderRadius: 14, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {card.icon(card.iconColor)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0D1B2A", lineHeight: 1.3 }}>{card.label}</div>
                <div style={{ fontSize: 11, color: "#8896A6", marginTop: 3, lineHeight: 1.4 }}>{card.sub}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={card.iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── EMPLOIS (pleine largeur) ── */}
        <div
          onClick={() => navigate("/jobs")}
          style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}
          onPointerDown={e => (e.currentTarget.style.background = "#F8FAFC")}
          onPointerUp={e => (e.currentTarget.style.background = "#fff")}
          onPointerLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="30" height="30" viewBox="0 0 30 30">
              <rect x="2" y="11" width="26" height="17" rx="4" fill="#388E3C"/>
              <rect x="2" y="11" width="26" height="5" rx="2" fill="#2E7D32"/>
              <rect x="9" y="4" width="12" height="9" rx="3" fill="#43A047"/>
              <rect x="9" y="4" width="12" height="4" rx="2" fill="#2E7D32"/>
              <rect x="12" y="7" width="6" height="2" rx="1" fill="#A5D6A7"/>
              <rect x="6" y="16" width="5" height="7" rx="2" fill="#A5D6A7"/>
              <rect x="13" y="16" width="5" height="7" rx="2" fill="#A5D6A7"/>
              <rect x="20" y="16" width="5" height="7" rx="2" fill="#A5D6A7"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1B2A" }}>Emplois</div>
            <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2 }}>Trouvez des offres d'emploi qui vous correspondent</div>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#43A047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* ── PARAMÈTRES ET CONFIDENTIALITÉ ── */}
        <div
          onClick={() => setActiveSection("settings")}
          style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}
          onPointerDown={e => (e.currentTarget.style.background = "#F8FAFC")}
          onPointerUp={e => (e.currentTarget.style.background = "#fff")}
          onPointerLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="30" height="30" viewBox="0 0 30 30">
              <path d="M15 2 L28 7.5 V15 C28 22.5 22 27.5 15 30 C8 27.5 2 22.5 2 15 V7.5 Z" fill="#2E7D32"/>
              <path d="M15 2 L28 7.5 V15 C28 22.5 22 27.5 15 30" fill="#388E3C" opacity="0.4"/>
              <rect x="13" y="10" width="4" height="6" rx="2" fill="white"/>
              <circle cx="15" cy="20" r="2.2" fill="white"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1B2A" }}>Paramètres et confidentialité</div>
            <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2 }}>Gérez votre compte, la sécurité et vos préférences.</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {/* ── AIDE ET ASSISTANCE ── */}
        <div
          onClick={() => setActiveSection("help")}
          style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.04)" }}
          onPointerDown={e => (e.currentTarget.style.background = "#F8FAFC")}
          onPointerUp={e => (e.currentTarget.style.background = "#fff")}
          onPointerLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "#E0F2F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="30" height="30" viewBox="0 0 30 30">
              <path d="M15 3 C8 3 3 8 3 14 V20" stroke="#00897B" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
              <path d="M15 3 C22 3 27 8 27 14 V20" stroke="#00695C" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
              <rect x="1" y="18" width="6" height="8" rx="3" fill="#00897B"/>
              <rect x="23" y="18" width="6" height="8" rx="3" fill="#00695C"/>
              <rect x="12" y="24" width="6" height="3" rx="1.5" fill="#00897B"/>
              <circle cx="15" cy="27" r="2" fill="#00695C"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1B2A" }}>Aide et assistance</div>
            <div style={{ fontSize: 12, color: "#8896A6", marginTop: 2 }}>FAQ, assistance et centre d'aide.</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {/* ── AJOUTER UN COMPTE ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
            borderRadius: 20, padding: "18px 18px",
            display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
            boxShadow: "0 8px 24px rgba(34,197,94,0.35)",
          }}
          onPointerDown={e => (e.currentTarget.style.opacity = "0.88")}
          onPointerUp={e => (e.currentTarget.style.opacity = "1")}
          onPointerLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(255,255,255,0.22)", border: "2px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>Ajouter un compte</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 3, lineHeight: 1.4 }}>Ajoutez un autre compte et basculez facilement entre vos profils</div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* ── DÉCONNEXION ── */}
        <div
          onClick={logout}
          style={{ background: "#FFF1F2", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 2px 8px rgba(239,68,68,0.08)", border: "1px solid #FFE4E6", marginBottom: 8 }}
          onPointerDown={e => (e.currentTarget.style.background = "#FFE4E6")}
          onPointerUp={e => (e.currentTarget.style.background = "#FFF1F2")}
          onPointerLeave={e => (e.currentTarget.style.background = "#FFF1F2")}
        >
          <div style={{ width: 50, height: 50, borderRadius: 14, background: "#FFE4E6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#EF4444" }}>Déconnexion</div>
            <div style={{ fontSize: 12, color: "#FDA4AF", marginTop: 2 }}>Se déconnecter de votre compte en toute sécurité</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

      </div>
    </div>
  );
}
