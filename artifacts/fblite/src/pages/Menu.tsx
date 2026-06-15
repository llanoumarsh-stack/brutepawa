import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { isAdmin, ADMIN_SECRET_PATH } from "../lib/admin";
import { apiGetTontines, apiGetCourses, apiGetEnrollments, apiGetWallet, apiGetBlockedUsers, apiUnblockUser, type ApiTontine, type ApiCourse, type ApiEnrollment, type BlockedUser } from "../lib/api";

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

  useEffect(() => {
    Promise.all([apiGetTontines(), apiGetCourses(), apiGetEnrollments(), apiGetWallet()]).then(([t, c, e, w]) => {
      setTontines(t);
      setCourses(c);
      setEnrollments(e);
      if (w) setWallet({ balance: w.balance, currency: w.currency });
    }).catch(() => {});
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

  // MAIN MENU — grille 2 colonnes style Facebook
  const GRID_ITEMS = [
    { icon: "🎬", label: "Reels",            bg: "#FFE0E0", action: () => navigate("/reels") },
    { icon: "💬", label: "Messages",         bg: "#E3F2FD", action: () => navigate("/messages") },
    { icon: "👥", label: "Groupes",          bg: "#E3F2FD", action: () => navigate("/groups") },
    { icon: "👫", label: "Ami(e)s",          bg: "#E3F2FD", action: () => navigate("/friends") },
    { icon: "🏪", label: "Marketplace",      bg: "#E0F7FA", action: () => navigate("/marketplace") },
    { icon: "💳", label: "Wallet",           bg: "#E8F5E9", action: () => navigate("/wallet") },
    { icon: "🚩", label: "Pages",            bg: "#FFF3E0", action: () => navigate("/pages") },
    { icon: "🔖", label: "Enregistrements", bg: "#F3E5F5", action: () => navigate("/saved") },
    { icon: "✨", label: "Souvenirs",        bg: "#E3F2FD", action: () => navigate("/memories") },
    { icon: "🎁", label: "Anniversaires",    bg: "#E8F5E9", action: () => {} },
    { icon: "📅", label: "Évènements",       bg: "#FFEBEE", action: () => navigate("/events") },
    { icon: "✅", label: "Brute Vérifié",   bg: "#E3F2FD", action: () => setActiveSection("settings-verify") },
    { icon: "💰", label: "Tontines",         bg: "#FFF8E1", action: () => navigate("/tontines") },
    { icon: "📰", label: "Fils",             bg: "#FFF3E0", action: () => navigate("/") },
    { icon: "🎓", label: "Formations",       bg: "#F3E5F5", action: () => navigate("/formations") },
    { icon: "🏅", label: "Score",            bg: "#FFF8E1", action: () => setActiveSection("score") },
    { icon: "💼", label: "Emplois",          bg: "#E8F5E9", action: () => navigate("/jobs") },
    ...(isAdmin(user.email) ? [{ icon: "🛡️", label: "Admin", bg: "#FCE4EC", action: () => navigate(ADMIN_SECRET_PATH) }] : []),
  ];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", background: "var(--fb-bg)", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{ background: "var(--fb-white)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--fb-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => window.history.back()} style={{ background: "var(--fb-bg)", border: "none", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <span style={{ fontWeight: 900, fontSize: 22 }}>Menu</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ background: "var(--fb-bg)", border: "none", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>↕</button>
          <button style={{ background: "var(--fb-bg)", border: "none", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>🔍</button>
        </div>
      </div>

      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* ── Profil card ── */}
        <div
          onClick={() => navigate("/profile")}
          style={{ background: "var(--fb-white)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="Profil" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
              : <div className="avatar" style={{ width: 56, height: 56, fontSize: 20, background: "#42B72A", flexShrink: 0 }}>{userInitials}</div>
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{user.name}</div>
            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Voir votre profil</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--fb-divider)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📷</div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⌄</div>
          </div>
        </div>

        {/* ── Changer de compte ── */}
        <div style={{ background: "var(--fb-white)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Changer de compte</div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, position: "relative" }}>
            ⌄
            <div style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, background: "#F44336", borderRadius: "50%", border: "2px solid #fff" }} />
          </div>
        </div>

        {/* ── Inviter des ami(e)s ── */}
        <div style={{ background: "var(--fb-white)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFF0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>❤️</div>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Inviter des ami(e)s</div>
        </div>

        {/* ── Grille 2 colonnes ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {GRID_ITEMS.map((item, i) => (
            <div
              key={i}
              onClick={item.action}
              style={{
                background: "var(--fb-white)", borderRadius: 12, padding: "16px 14px",
                cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                display: "flex", flexDirection: "column", gap: 8,
                transition: "background 0.15s",
              }}
              onPointerDown={e => (e.currentTarget.style.background = "var(--fb-bg)")}
              onPointerUp={e => (e.currentTarget.style.background = "var(--fb-white)")}
              onPointerLeave={e => (e.currentTarget.style.background = "var(--fb-white)")}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {item.icon}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--fb-text)", lineHeight: 1.3 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── Paramètres et confidentialité (accordéon) ── */}
        <div style={{ background: "var(--fb-white)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div
            onClick={() => setSettingsOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", cursor: "pointer" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⚙️</div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Paramètres et confidentialité</div>
            <span style={{ fontSize: 18, transform: settingsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
          </div>
          {settingsOpen && (
            <div style={{ borderTop: "1px solid var(--fb-divider)" }}>
              {[
                { label: "Paramètres", action: () => setActiveSection("settings") },
                { label: "Confidentialité", action: () => setActiveSection("settings-privacy") },
                { label: "Notifications", action: () => setActiveSection("settings-notifs") },
                { label: "Langue", action: () => setActiveSection("settings-lang") },
                { label: "Apparence", action: () => setActiveSection("settings-appearance") },
                { label: "Mode données", action: () => setActiveSection("settings-data") },
                { label: "Vérification du compte", action: () => setActiveSection("settings-verify") },
              ].map((item, i, arr) => (
                <div key={i} onClick={item.action} style={{ padding: "12px 16px 12px 70px", fontSize: 14, fontWeight: 500, cursor: "pointer", borderBottom: i < arr.length - 1 ? "1px solid var(--fb-divider)" : "none", color: "var(--fb-text)" }}>
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Aide et assistance (accordéon) ── */}
        <div style={{ background: "var(--fb-white)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div
            onClick={() => setHelpOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", cursor: "pointer" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>❓</div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Aide et assistance</div>
            <span style={{ fontSize: 18, transform: helpOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
          </div>
          {helpOpen && (
            <div style={{ borderTop: "1px solid var(--fb-divider)" }}>
              {[
                { label: "Centre d'aide", action: () => setActiveSection("help") },
                { label: "Signaler un problème", action: () => {} },
                { label: "Conditions d'utilisation", action: () => {} },
              ].map((item, i, arr) => (
                <div key={i} onClick={item.action} style={{ padding: "12px 16px 12px 70px", fontSize: 14, fontWeight: 500, cursor: "pointer", borderBottom: i < arr.length - 1 ? "1px solid var(--fb-divider)" : "none", color: "var(--fb-text)" }}>
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Ajouter un compte ── */}
        <div style={{ background: "var(--fb-white)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--fb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>➕</div>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Ajouter un compte</div>
        </div>

        {/* ── Déconnexion ── */}
        <div
          onClick={logout}
          style={{ background: "var(--fb-white)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 16 }}
        >
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFF0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🚪</div>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15, color: "#F44336" }}>Déconnexion</div>
        </div>

      </div>
    </div>
  );
}
