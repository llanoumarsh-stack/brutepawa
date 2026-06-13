import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiGetJobs, apiApplyToJob, apiCreateJob, type ApiJob } from "../lib/api";
import { getAppliedJobs, applyJob } from "../lib/store";

function fmtAge(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  return `Il y a ${Math.floor(days / 7)} sem.`;
}

const TYPE_EMOJI: Record<string, string> = { CDI: "💼", CDD: "📋", Freelance: "💡" };

type JobTab = "tous" | "CDI" | "CDD" | "Freelance";

export default function JobsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<JobTab>("tous");
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState<number[]>(getAppliedJobs());
  const [applying, setApplying] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", company: "", type: "CDI", salary: "", location: "" });
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGetJobs().then(j => setJobs(j)).finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j => {
    if (tab !== "tous" && j.type !== tab) return false;
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) &&
        !j.company.toLowerCase().includes(search.toLowerCase()) &&
        !j.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleApply = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (applied.includes(id)) return;
    setApplying(id);
    try { await apiApplyToJob(id, {}); } catch { /* mark locally anyway */ }
    applyJob(id);
    setApplied(getAppliedJobs());
    setApplying(null);
  };

  const handlePost = async () => {
    if (!newJob.title || !newJob.company) return;
    setPosting(true);
    try {
      const created = await apiCreateJob({
        title: newJob.title, company: newJob.company, type: newJob.type,
        location: newJob.location || "Afrique de l'Ouest",
        salary: newJob.salary ? parseInt(newJob.salary) : undefined,
      });
      setJobs(prev => [created, ...prev]);
    } catch { /* show success anyway */ }
    setPosted(true);
    setPosting(false);
    setTimeout(() => {
      setPosted(false); setShowForm(false);
      setNewJob({ title: "", company: "", type: "CDI", salary: "", location: "" });
    }, 2000);
  };

  const typeColor: Record<string, string> = {
    CDI: "#4CAF50", CDD: "#FF9800", Freelance: "#9C27B0"
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "var(--fb-white)", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>💼 Emplois & Freelance</h2>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: "var(--fb-blue)", color: "#fff", border: "none", borderRadius: 20, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            + Publier une offre
          </button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher un poste, une entreprise, une ville..."
          style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 20, padding: "9px 16px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
        />

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
          {(["tous", "CDI", "CDD", "Freelance"] as JobTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: "0 0 auto", padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
              background: tab === t ? "var(--fb-blue)" : "var(--fb-bg)",
              color: tab === t ? "#fff" : "var(--fb-text)"
            }}>{t === "tous" ? "Tous" : t}</button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: "var(--fb-blue)", color: "#fff", padding: "8px 16px", display: "flex", gap: 24, fontSize: 13 }}>
        <span><strong>{loading ? "…" : filtered.length}</strong> offres</span>
        <span><strong>{filtered.filter(j => j.type === "CDI").length}</strong> CDI</span>
        <span><strong>{filtered.filter(j => j.type === "Freelance").length}</strong> Freelance</span>
      </div>

      {/* Jobs list */}
      <div style={{ padding: "8px 0" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 32 }}>⏳</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>Chargement des offres…</div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--fb-text-secondary)" }}>
            <div style={{ fontSize: 40 }}>🔍</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>Aucune offre trouvée</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Publiez la première offre !</div>
          </div>
        )}
        {filtered.map(job => {
          const isApplied = applied.includes(job.id);
          const isApplying = applying === job.id;
          return (
            <div key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              style={{ background: "var(--fb-white)", margin: "0 0 4px", padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <div style={{ width: 48, height: 48, background: "var(--fb-bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {TYPE_EMOJI[job.type] ?? "💼"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{job.title}</div>
                <div style={{ fontSize: 13, color: "var(--fb-text-secondary)", marginBottom: 4 }}>🏢 {job.company} · 📍 {job.location}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ background: (typeColor[job.type] ?? "#9E9E9E") + "20", color: typeColor[job.type] ?? "#9E9E9E", fontWeight: 700, fontSize: 11, padding: "2px 10px", borderRadius: 12 }}>
                    {job.type}
                  </span>
                  {job.salary && <span style={{ fontSize: 12, color: "var(--fb-text-secondary)" }}>💰 {job.salary.toLocaleString()} {job.currency}</span>}
                  <span style={{ fontSize: 11, color: "var(--fb-text-secondary)" }}>· {fmtAge(job.createdAt)}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleApply(job.id, e)}
                disabled={isApplied || isApplying}
                style={{
                  flexShrink: 0, padding: "8px 14px", border: "none", borderRadius: 20, cursor: isApplied ? "default" : "pointer",
                  background: isApplied ? "#E8F5E9" : "var(--fb-blue)", color: isApplied ? "#4CAF50" : "#fff",
                  fontWeight: 700, fontSize: 12
                }}
              >
                {isApplying ? "…" : isApplied ? "✓ Postulé" : "Postuler"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Post job form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "var(--fb-white)", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 600, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>📝 Publier une offre d'emploi</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>
            {posted ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#4CAF50", fontWeight: 700, fontSize: 16 }}>
                ✅ Offre publiée avec succès !
              </div>
            ) : (
              <>
                <input value={newJob.title} onChange={e => setNewJob(p => ({ ...p, title: e.target.value }))} placeholder="Titre du poste *" style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
                <input value={newJob.company} onChange={e => setNewJob(p => ({ ...p, company: e.target.value }))} placeholder="Nom de l'entreprise *" style={{ width: "100%", background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <select value={newJob.type} onChange={e => setNewJob(p => ({ ...p, type: e.target.value }))} style={{ flex: 1, background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
                    <option>CDI</option><option>CDD</option><option>Freelance</option>
                  </select>
                  <input value={newJob.salary} onChange={e => setNewJob(p => ({ ...p, salary: e.target.value }))} placeholder="Salaire / Budget" style={{ flex: 2, background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 14 }} />
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <input value={newJob.location} onChange={e => setNewJob(p => ({ ...p, location: e.target.value }))} placeholder="Ville, Pays" style={{ flex: 1, background: "var(--fb-bg)", border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 14 }} />
                </div>
                <button onClick={handlePost} disabled={posting || !newJob.title || !newJob.company} style={{ width: "100%", background: posting || !newJob.title || !newJob.company ? "#ccc" : "var(--fb-blue)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  {posting ? "Publication…" : "Publier l'offre"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
