import { useState, useEffect, useRef } from "react";
import {
  apiSearchUsers,
  apiGetProducts,
  apiGetJobs,
  type PublicUserWithStatus,
  type ApiProduct,
  type ApiJob,
} from "../lib/api";

interface Props {
  query: string;
  onClose: () => void;
  navigate: (path: string) => void;
  recentSearches: string[];
  onSelectRecent: (q: string) => void;
  onRemoveRecent: (q: string) => void;
  onCommitSearch?: (q: string) => void;
}

const AVATAR_COLORS = ["#1877F2","#E91E63","#9C27B0","#F57C00","#388E3C","#D32F2F","#00838F","#5D4037"];
function colorForId(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

export default function SearchSuggestionsDropdown({ query, onClose, navigate, recentSearches, onSelectRecent, onRemoveRecent, onCommitSearch }: Props) {
  const [users, setUsers]       = useState<PublicUserWithStatus[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [jobs, setJobs]         = useState<ApiJob[]>([]);
  const [loading, setLoading]   = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setUsers([]); setProducts([]); setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const [u, p, j] = await Promise.all([
          apiSearchUsers(query),
          apiGetProducts({ search: query }),
          apiGetJobs({ search: query }),
        ]);
        if (ctrl.signal.aborted) return;
        setUsers(u.slice(0, 4));
        setProducts(p.slice(0, 4));
        setJobs(j.slice(0, 4));
      } catch {
        if (ctrl.signal.aborted) return;
        setUsers([]); setProducts([]); setJobs([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const hasResults = users.length > 0 || products.length > 0 || jobs.length > 0;
  const noResults  = !loading && query.length >= 2 && !hasResults;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const goSearch = () => {
    onCommitSearch?.(query.trim());
    onClose();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const showRecents = query.length < 2 && recentSearches.length > 0;

  return (
    <div className="search-dropdown">

      {/* Recent searches (shown when input is empty / < 2 chars) */}
      {showRecents && (
        <div className="search-dropdown-section">
          <div className="search-dropdown-section-title">🕐 Récentes</div>
          {recentSearches.map(q => (
            <div key={q} className="search-dropdown-recent-row">
              <button
                className="search-dropdown-recent-query"
                onClick={() => onSelectRecent(q)}
              >
                <span className="search-dropdown-recent-icon">🔍</span>
                {q}
              </button>
              <button
                className="search-dropdown-recent-remove"
                title="Supprimer"
                onClick={e => { e.stopPropagation(); onRemoveRecent(q); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* "See all results" shortcut */}
      {query.length >= 2 && (
        <button className="search-dropdown-see-all" onClick={goSearch}>
          🔍 Voir tous les résultats pour « {query} »
        </button>
      )}

      {loading && (
        <div className="search-dropdown-loading">
          <span className="search-dropdown-spinner" />
          Recherche en cours…
        </div>
      )}

      {!loading && noResults && (
        <div className="search-dropdown-empty">
          Aucun résultat pour « {query} »
        </div>
      )}

      {/* People */}
      {!loading && users.length > 0 && (
        <div className="search-dropdown-section">
          <div className="search-dropdown-section-title">👥 Personnes</div>
          {users.map(u => {
            const name = `${u.firstName} ${u.lastName}`;
            const initials = `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
            return (
              <button
                key={u.id}
                className="search-dropdown-item"
                onClick={() => go(`/profile/${u.id}`)}
              >
                <div className="search-dropdown-avatar" style={{ background: colorForId(u.id) }}>
                  {u.avatarUrl
                    ? <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span>{initials}</span>
                  }
                </div>
                <div className="search-dropdown-item-info">
                  <div className="search-dropdown-item-name">{name}</div>
                  {u.country && <div className="search-dropdown-item-sub">📍 {u.country}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Products */}
      {!loading && products.length > 0 && (
        <div className="search-dropdown-section">
          <div className="search-dropdown-section-title">🛍️ Articles</div>
          {products.map(p => (
            <button
              key={p.id}
              className="search-dropdown-item"
              onClick={() => go(`/marketplace/${p.id}`)}
            >
              <div className="search-dropdown-avatar search-dropdown-avatar-square" style={{ background: "#f5f5f5" }}>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 18 }}>🛍️</span>
                }
              </div>
              <div className="search-dropdown-item-info">
                <div className="search-dropdown-item-name">{p.title}</div>
                <div className="search-dropdown-item-sub">
                  {p.price.toLocaleString("fr-FR")} {p.currency}
                  {p.location ? ` · ${p.location}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Jobs */}
      {!loading && jobs.length > 0 && (
        <div className="search-dropdown-section">
          <div className="search-dropdown-section-title">💼 Emplois</div>
          {jobs.map(j => (
            <button
              key={j.id}
              className="search-dropdown-item"
              onClick={() => go(`/jobs/${j.id}`)}
            >
              <div className="search-dropdown-avatar" style={{ background: "#E3F2FD" }}>
                <span style={{ fontSize: 18 }}>💼</span>
              </div>
              <div className="search-dropdown-item-info">
                <div className="search-dropdown-item-name">{j.title}</div>
                <div className="search-dropdown-item-sub">{j.company} · {j.location}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
