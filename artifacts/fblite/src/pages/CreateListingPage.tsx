import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "../router";
import { COUNTRIES } from "../data/mock";
import { apiCreateProduct } from "../lib/api";
import { useR2Upload, phaseLabel } from "../hooks/useR2Upload";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */
const G  = "#22C55E";
const GD = "#16A34A";
const BG = "#F8FAFC";

const CATEGORIES = [
  "Électronique","Mode","Maison","Beauté","Automobile","Immobilier","Artisanat","Services","Alimentation","Agriculture","Santé","Éducation",
];
const CONDITIONS = ["Neuf","Très bon état","Bon état","Occasion"];

const VISIBILITY_PLANS = [
  { id:"standard",     label:"Publication standard",         price:0,    priceLabel:"Gratuit",    desc:"Votre annonce sera visible dans votre ville",                    popular:false },
  { id:"local",        label:"Mise en avant locale",         price:1200,  priceLabel:"1 200 FCFA", desc:"Visible dans tout Bamako pendant 7 jours",                      popular:true  },
  { id:"national",     label:"Mise en avant nationale",      price:2500,  priceLabel:"2 500 FCFA", desc:"Visible dans tout le Mali pendant 7 jours",                     popular:false },
  { id:"continental",  label:"Mise en avant continentale",   price:5000,  priceLabel:"5 000 FCFA", desc:"Visible dans plusieurs pays d'Afrique",                         popular:false },
];

const DURATIONS = [
  { days:7,  discount:0   },
  { days:14, discount:10  },
  { days:30, discount:20  },
  { days:60, discount:30  },
];

function perf(visibility: string, days: number) {
  const base: Record<string, [number,number,number,number,number,number]> = {
    standard:    [450,800,25,45,2,5],
    local:       [2450,3800,120,210,10,18],
    national:    [5000,8000,250,450,20,35],
    continental: [15000,25000,800,1500,65,120],
  };
  const b = base[visibility] ?? base.standard;
  const mult = days/7;
  return {
    viewsMin: Math.round(b[0]*mult),viewsMax: Math.round(b[1]*mult),
    clicksMin:Math.round(b[2]*mult),clicksMax:Math.round(b[3]*mult),
    ctMin:    Math.round(b[4]*mult),ctMax:    Math.round(b[5]*mult),
  };
}

interface Photo { localUrl:string; r2Url:string; name:string; }

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════════════════ */
const IcBack   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>;
const IcCloud  = () => <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>;
const IcPlus   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcX      = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcCheck  = (c="white") => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcStar   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="#F4C542" stroke="#F4C542" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcLoc    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IcShield = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcAI     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>;
const IcPen    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcEye    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcMouse  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="6"/><line x1="12" y1="8" x2="12" y2="12"/></svg>;
const IcMsg    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const IcRocket = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="m12 15-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>;
const IcBulb   = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>;

/* ═══════════════════════════════════════════════════════════════════════════
   STEP PROGRESS BAR
═══════════════════════════════════════════════════════════════════════════ */
const STEP_LABELS = ["Médias","Informations","Visibilité","Aperçu"];
function StepBar({ step }: { step: number }) {
  return (
    <div style={{ padding:"14px 16px 10px", background:"#fff", borderBottom:"1px solid #F1F5F9" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth:340, margin:"0 auto" }}>
        {[1,2,3,4].map((n,i) => {
          const done   = n < step;
          const active = n === step;
          return (
            <div key={n} style={{ display:"flex", alignItems:"center", flex: i < 3 ? 1 : "none" }}>
              {/* Circle */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{
                  width:28, height:28, borderRadius:"50%",
                  background: done||active ? G : "#E5E7EB",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.3s ease",
                  boxShadow: active ? `0 0 0 3px ${G}30` : "none",
                }}>
                  {done
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <span style={{ fontSize:12, fontWeight:700, color: active ? "#fff" : "#9CA3AF", lineHeight:1 }}>{n}</span>
                  }
                </div>
                <span style={{ fontSize:10, fontWeight: active ? 700 : 500, color: active ? G : "#9CA3AF", whiteSpace:"nowrap", letterSpacing:-0.2 }}>{STEP_LABELS[i]}</span>
              </div>
              {/* Line */}
              {i < 3 && (
                <div style={{ flex:1, height:2, background: done ? G : "#E5E7EB", margin:"0 4px", marginBottom:16, transition:"background 0.3s ease" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1 — MÉDIAS
═══════════════════════════════════════════════════════════════════════════ */
function Step1({
  photos, uploading, progress, phase,
  onSelectFiles, onRemove, onSetMain, onDragOver, onDrop,
}: {
  photos:Photo[]; uploading:boolean; progress:number; phase:string;
  onSelectFiles:(files:File[])=>void; onRemove:(i:number)=>void;
  onSetMain:(i:number)=>void; onDragOver:(e:React.DragEvent)=>void; onDrop:(e:React.DragEvent)=>void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const qualityScore = Math.min(100, 40 + (photos.length>=1?15:0) + (photos.length>=3?15:0) + (photos.length>=5?10:0) + (photos.length>=7?10:0) + (photos.length>=10?10:0));

  const checklist = [
    { label:"Photo principale",    ok: photos.length >= 1 },
    { label:"Au moins 3 photos",   ok: photos.length >= 3 },
    { label:"Bonne luminosité",    ok: photos.length >= 1 },
    { label:"Photo de face",       ok: photos.length >= 1 },
    { label:"Photo en extérieur",  ok: photos.length >= 2 },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple style={{ display:"none" }}
        onChange={e => { if (e.target.files) { onSelectFiles(Array.from(e.target.files)); e.target.value=""; } }} />

      {/* ── Hero upload zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); onDragOver(e); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(e); }}
        onClick={() => !uploading && photos.length < 10 && fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? G : "#D1D5DB"}`,
          borderRadius:20, padding:"32px 20px",
          background: dragOver ? `${G}08` : uploading ? "#F8FAFC" : "#fff",
          cursor: (uploading||photos.length>=10) ? "default" : "pointer",
          display:"flex", flexDirection:"column", alignItems:"center", gap:10,
          transition:"all 0.2s ease",
          boxShadow: dragOver ? `0 0 0 4px ${G}20` : "none",
        }}
      >
        <IcCloud />
        <div style={{ textAlign:"center" }}>
          {uploading ? (
            <>
              <div style={{ fontWeight:600, fontSize:14, color:"#374151" }}>{phaseLabel(phase as never, progress)}</div>
              <div style={{ marginTop:8, width:200, height:4, background:"#E5E7EB", borderRadius:99 }}>
                <div style={{ width:`${progress}%`, height:"100%", background:G, borderRadius:99, transition:"width 0.3s" }} />
              </div>
            </>
          ) : photos.length >= 10 ? (
            <div style={{ fontWeight:600, fontSize:14, color:"#9CA3AF" }}>Maximum 10 photos atteint</div>
          ) : (
            <>
              <div style={{ fontWeight:700, fontSize:15, color:"#374151" }}>Ajoutez jusqu'à 10 photos ou vidéos</div>
              <div style={{ fontSize:13, color:"#9CA3AF", marginTop:4 }}>Glissez-déposez ou sélectionnez</div>
              <div style={{ fontSize:12, color:"#D1D5DB", marginTop:3 }}>JPG, PNG, WEBP, MP4 · Max 50 Mo</div>
            </>
          )}
        </div>
      </div>

      {/* ── Thumbnails grid ── */}
      {photos.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {photos.map((ph,i) => (
            <div key={i} style={{
              position:"relative", width:80, height:80, borderRadius:14, overflow:"hidden",
              border: i===0 ? `3px solid ${G}` : "2px solid #E5E7EB",
              flexShrink:0, boxShadow: i===0 ? `0 2px 8px ${G}30` : "none",
            }}>
              <img src={ph.localUrl} alt={ph.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              {i===0 && (
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:`${G}DD`, padding:"3px 0", textAlign:"center", fontSize:9.5, fontWeight:700, color:"#fff", letterSpacing:0.3 }}>
                  Photo principale
                </div>
              )}
              {i!==0 && (
                <button onClick={e => { e.stopPropagation(); onSetMain(i); }} style={{
                  position:"absolute", bottom:3, left:"50%", transform:"translateX(-50%)",
                  background:"rgba(0,0,0,0.55)", border:"none", borderRadius:6, padding:"1px 5px",
                  fontSize:8.5, color:"#fff", cursor:"pointer", whiteSpace:"nowrap",
                }}>Principale</button>
              )}
              <button onClick={e => { e.stopPropagation(); onRemove(i); }} style={{
                position:"absolute", top:4, right:4, background:"rgba(239,68,68,0.92)", border:"none",
                borderRadius:"50%", width:18, height:18, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}><IcX/></button>
            </div>
          ))}
          {photos.length < 10 && (
            <button onClick={() => fileRef.current?.click()} style={{
              width:80, height:80, borderRadius:14, border:`2px dashed ${G}`,
              background:`${G}08`, display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", cursor:"pointer", gap:4,
            }}>
              <IcPlus/>
              <span style={{ fontSize:10, color:G, fontWeight:600 }}>Ajouter</span>
            </button>
          )}
        </div>
      )}

      {/* ── Quality score card ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>Qualité des médias</span>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:G, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:11, fontWeight:800, color:"#fff" }}>{qualityScore}</span>
            </div>
            <span style={{ fontSize:12, color:"#6B7280", fontWeight:600 }}>/100</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {checklist.map(item => (
            <div key={item.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background: item.ok ? G : "#E5E7EB", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {item.ok && IcCheck()}
              </div>
              <span style={{ fontSize:13, color: item.ok ? "#111827" : "#9CA3AF", fontWeight: item.ok ? 500 : 400 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI tip card ── */}
      <div style={{ background:`${G}0D`, borderRadius:16, padding:"12px 14px", border:`1px solid ${G}30`, display:"flex", gap:10, alignItems:"flex-start" }}>
        <div style={{ width:32, height:32, borderRadius:10, background:G, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <IcBulb/>
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:13, color:GD, marginBottom:3 }}>Conseil BrutePawa</div>
          <div style={{ fontSize:12.5, color:"#374151", lineHeight:1.5 }}>Les annonces avec 5+ photos se vendent 3x plus vite ! Ajoutez des photos sous plusieurs angles.</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2 — INFORMATIONS
═══════════════════════════════════════════════════════════════════════════ */
function Step2({
  title,setTitle,price,setPrice,category,setCategory,condition,setCondition,
  country,setCountry,city,setCity,description,setDescription,negotiable,setNegotiable,
}: {
  title:string;setTitle:(v:string)=>void;price:string;setPrice:(v:string)=>void;
  category:string;setCategory:(v:string)=>void;condition:string;setCondition:(v:string)=>void;
  country:string;setCountry:(v:string)=>void;city:string;setCity:(v:string)=>void;
  description:string;setDescription:(v:string)=>void;negotiable:boolean;setNegotiable:(v:boolean)=>void;
}) {
  const selectedCountry = COUNTRIES.find(c => c.code === country) ?? COUNTRIES[0];
  const fmtPrice = (raw:string) => { const n=raw.replace(/\D/g,""); return n ? parseInt(n).toLocaleString("fr-FR") : ""; };
  const rawPrice = price.replace(/[\s\u202f]/g,"");

  const marketMin = rawPrice ? Math.round(parseInt(rawPrice)*0.9).toLocaleString("fr-FR") : null;
  const marketMax = rawPrice ? Math.round(parseInt(rawPrice)*1.1).toLocaleString("fr-FR") : null;

  const inp: React.CSSProperties = {
    flex:1, border:"none", outline:"none", fontSize:15, color:"#111827",
    background:"transparent", fontFamily:"inherit", padding:"14px 0",
  };

  const [aiTitle, setAiTitle] = useState(false);
  const [aiDesc, setAiDesc]   = useState(false);

  const generateTitle = () => {
    if (aiTitle) return;
    setAiTitle(true);
    const suggestions = ["iPhone 15 Pro Max 256 Go","Samsung Galaxy S24 Ultra","MacBook Pro M3 14 pouces","AirPods Pro 2ème génération","iPad Air 5 Wifi 64 Go"];
    setTimeout(() => {
      if (!title.trim()) setTitle(suggestions[Math.floor(Math.random()*suggestions.length)]);
      setAiTitle(false);
    }, 1200);
  };

  const generateDesc = () => {
    if (aiDesc) return;
    setAiDesc(true);
    setTimeout(() => {
      if (!description.trim()) setDescription(`${title || "Article"} en parfait état.\nAucune rayure, batterie à 100%.\nVendu avec chargeur et boîte d'origine.\nPrix légèrement négociable.`);
      setAiDesc(false);
    }, 1500);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── Titre ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:10 }}>Titre de l'annonce *</label>
        <div style={{ background:"#F8FAFC", border:"1.5px solid #E5E7EB", borderRadius:14, padding:"0 14px", display:"flex", alignItems:"center", gap:8 }}>
          <IcPen/>
          <input style={inp} placeholder="Ex: iPhone 15 Pro Max 256 Go" value={title} maxLength={80}
            onChange={e=>setTitle(e.target.value)} />
          <span style={{ fontSize:12, color:"#9CA3AF", flexShrink:0 }}>{title.length}/80</span>
          {title.length>5 && <span style={{ color:G, flexShrink:0 }}>{IcCheck(G)}</span>}
        </div>
        <button onClick={generateTitle} disabled={aiTitle} style={{
          marginTop:8, display:"flex", alignItems:"center", gap:6, background:`${G}12`,
          border:`1px solid ${G}30`, borderRadius:10, padding:"7px 12px",
          color:G, fontWeight:600, fontSize:12.5, cursor:"pointer", width:"100%", justifyContent:"center",
          opacity: aiTitle ? 0.7 : 1,
        }}>
          <IcAI/> {aiTitle ? "Génération…" : "✨ Générer un titre avec l'IA"}
        </button>
      </div>

      {/* ── Prix ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:10 }}>Prix (FCFA) *</label>
        <div style={{ background:"#F8FAFC", border:"1.5px solid #E5E7EB", borderRadius:14, padding:"0 14px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16, fontWeight:700, color:"#9CA3AF", flexShrink:0 }}>₣</span>
          <input style={inp} placeholder="350 000" inputMode="numeric" value={price}
            onChange={e=>setPrice(fmtPrice(e.target.value))} />
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#6B7280" }}>Négociable</span>
            <div onClick={()=>setNegotiable(!negotiable)} style={{
              width:44, height:24, borderRadius:12, background: negotiable ? G : "#D1D5DB",
              position:"relative", cursor:"pointer", transition:"background 0.2s",
            }}>
              <div style={{ position:"absolute", top:2, left: negotiable?20:2, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
            </div>
          </div>
        </div>
        {marketMin && (
          <div style={{ marginTop:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, color:"#9CA3AF" }}>Prix du marché : <span style={{ color:G, fontWeight:600 }}>{marketMin} – {marketMax} FCFA</span></span>
            <button style={{ background:"none", border:"none", color:G, fontWeight:700, fontSize:12, cursor:"pointer" }}>Ajuster le prix</button>
          </div>
        )}
      </div>

      {/* ── Catégorie + État ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <div style={{ display:"flex", gap:12 }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:8 }}>Catégorie *</label>
            <div style={{ background:"#F8FAFC", border:"1.5px solid #E5E7EB", borderRadius:14, padding:"0 12px" }}>
              <select value={category} onChange={e=>setCategory(e.target.value)}
                style={{ width:"100%", border:"none", outline:"none", fontSize:14, color:"#111827", background:"transparent", fontFamily:"inherit", padding:"12px 0", cursor:"pointer" }}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:8 }}>État *</label>
            <div style={{ background:"#F8FAFC", border:"1.5px solid #E5E7EB", borderRadius:14, padding:"0 12px" }}>
              <select value={condition} onChange={e=>setCondition(e.target.value)}
                style={{ width:"100%", border:"none", outline:"none", fontSize:14, color:"#111827", background:"transparent", fontFamily:"inherit", padding:"12px 0", cursor:"pointer" }}>
                {CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Localisation ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:10 }}>Localisation *</label>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#9CA3AF", display:"block", marginBottom:5 }}>Pays *</label>
            <div style={{ background:"#F8FAFC", border:"1.5px solid #E5E7EB", borderRadius:14, padding:"0 12px", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>{selectedCountry.flag}</span>
              <select value={country} onChange={e=>{ const c=COUNTRIES.find(x=>x.code===e.target.value)??COUNTRIES[0]; setCountry(e.target.value); setCity(c.cities[0]); }}
                style={{ flex:1, border:"none", outline:"none", fontSize:13.5, color:"#111827", background:"transparent", fontFamily:"inherit", padding:"12px 0", cursor:"pointer" }}>
                {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#9CA3AF", display:"block", marginBottom:5 }}>Ville *</label>
            <div style={{ background:"#F8FAFC", border:"1.5px solid #E5E7EB", borderRadius:14, padding:"0 12px", display:"flex", alignItems:"center", gap:8 }}>
              <IcLoc/>
              <select value={city} onChange={e=>setCity(e.target.value)}
                style={{ flex:1, border:"none", outline:"none", fontSize:13.5, color:"#111827", background:"transparent", fontFamily:"inherit", padding:"12px 0", cursor:"pointer" }}>
                {selectedCountry.cities.map(ci=><option key={ci}>{ci}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Description ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:10 }}>Description *</label>
        <div style={{ background:"#F8FAFC", border:"1.5px solid #E5E7EB", borderRadius:14, overflow:"hidden" }}>
          <textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000}
            placeholder="Décrivez votre article : état, dimensions, couleur, matière, défauts éventuels..."
            style={{ width:"100%", border:"none", outline:"none", resize:"none", padding:"14px", fontSize:14, fontFamily:"inherit", color:"#111827", height:110, boxSizing:"border-box", background:"transparent" }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", borderTop:"1px solid #F1F5F9", background:"#FAFAFA" }}>
            <span style={{ fontSize:11.5, color:"#9CA3AF", fontStyle:"italic" }}>Soyez précis et honnête</span>
            <span style={{ fontSize:11.5, color: description.length>900 ? "#EF4444" : "#9CA3AF" }}>{description.length}/1000 {description.length>5 && <span style={{ color:G }}>✓</span>}</span>
          </div>
        </div>
        {/* AI assistant bar */}
        <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
          <button onClick={generateDesc} disabled={aiDesc} style={{
            display:"flex", alignItems:"center", gap:5, background:`${G}0F`, border:`1px solid ${G}25`,
            borderRadius:10, padding:"6px 10px", color:G, fontWeight:600, fontSize:12, cursor:"pointer",
            opacity: aiDesc ? 0.7 : 1,
          }}>
            <IcAI/> {aiDesc ? "Génération…" : "Assistant IA"}
          </button>
          <button onClick={generateDesc} style={{ display:"flex", alignItems:"center", gap:5, background:`${G}0F`, border:`1px solid ${G}25`, borderRadius:10, padding:"6px 10px", color:G, fontWeight:600, fontSize:12, cursor:"pointer" }}>
            Suggérer une description
          </button>
          <button style={{ display:"flex", alignItems:"center", gap:5, background:"#F1F5F9", border:"1px solid #E5E7EB", borderRadius:10, padding:"6px 10px", color:"#6B7280", fontWeight:600, fontSize:12, cursor:"pointer" }}>
            Mots-clés recommandés
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3 — VISIBILITÉ
═══════════════════════════════════════════════════════════════════════════ */
function Step3({
  visibility, setVisibility, duration, setDuration,
}: {
  visibility:string; setVisibility:(v:string)=>void;
  duration:number;   setDuration:(v:number)=>void;
}) {
  const p = perf(visibility, duration);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── Visibility options ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#374151", marginBottom:12 }}>Choisissez votre option de visibilité</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {VISIBILITY_PLANS.map(plan => {
            const active = visibility === plan.id;
            return (
              <div key={plan.id} onClick={()=>setVisibility(plan.id)} style={{
                border:`2px solid ${active ? G : "#E5E7EB"}`,
                borderRadius:16, padding:"12px 14px", cursor:"pointer",
                background: active ? `${G}08` : "#fff",
                display:"flex", alignItems:"center", gap:12,
                transition:"all 0.2s ease",
                boxShadow: active ? `0 4px 16px ${G}20` : "none",
              }}>
                {/* Radio */}
                <div style={{
                  width:20, height:20, borderRadius:"50%", border:`2px solid ${active ? G : "#D1D5DB"}`,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  background: active ? G : "#fff",
                }}>
                  {active && <div style={{ width:8, height:8, borderRadius:"50%", background:"#fff" }} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>{plan.label}</span>
                    {plan.popular && <span style={{ fontSize:10.5, fontWeight:700, color:G, background:`${G}15`, padding:"2px 7px", borderRadius:20 }}>Populaire</span>}
                    <span style={{ marginLeft:"auto", fontWeight:700, fontSize:14, color: plan.price===0 ? G : "#111827", flexShrink:0 }}>{plan.priceLabel}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:"#6B7280" }}>{plan.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Duration ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#374151", marginBottom:12 }}>Durée de publication</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {DURATIONS.map(d => {
            const active = duration === d.days;
            return (
              <div key={d.days} onClick={()=>setDuration(d.days)} style={{
                border:`2px solid ${active ? G : "#E5E7EB"}`,
                borderRadius:14, padding:"10px 6px", cursor:"pointer", textAlign:"center",
                background: active ? G : "#fff",
                transition:"all 0.2s ease",
                boxShadow: active ? `0 4px 14px ${G}35` : "none",
              }}>
                <div style={{ fontWeight:800, fontSize:16, color: active ? "#fff" : "#111827" }}>{d.days} jours</div>
                {d.discount>0 && (
                  <div style={{ fontSize:11.5, fontWeight:700, color: active ? "rgba(255,255,255,0.85)" : G, marginTop:3 }}>-{d.discount}%</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Performance estimates ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
          <span style={{ fontSize:14, fontWeight:700, color:"#374151" }}>Estimation des performances</span>
          <div style={{ width:16, height:16, borderRadius:"50%", border:"1.5px solid #9CA3AF", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:10, color:"#9CA3AF", fontWeight:700 }}>i</span>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[
            { icon:<IcEye/>,   label:"Vues estimées",     min:p.viewsMin,  max:p.viewsMax  },
            { icon:<IcMouse/>, label:"Clics estimés",     min:p.clicksMin, max:p.clicksMax },
            { icon:<IcMsg/>,   label:"Contacts estimés",  min:p.ctMin,     max:p.ctMax     },
          ].map(stat => (
            <div key={stat.label} style={{ background:"#F8FAFC", borderRadius:14, padding:"10px", textAlign:"center" }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:5 }}>{stat.icon}</div>
              <div style={{ fontSize:13, fontWeight:800, color:"#111827" }}>{stat.min.toLocaleString("fr-FR")} – {stat.max.toLocaleString("fr-FR")}</div>
              <div style={{ fontSize:10.5, color:"#9CA3AF", marginTop:2, lineHeight:1.3 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 4 — APERÇU & PUBLICATION
═══════════════════════════════════════════════════════════════════════════ */
function Step4({
  title, price, category, condition, country, city, description, photos, visibility,
  termsOk, setTermsOk, infoOk, setInfoOk, onPublish, publishing, error,
}: {
  title:string; price:string; category:string; condition:string;
  country:string; city:string; description:string; photos:Photo[];
  visibility:string; termsOk:boolean; setTermsOk:(v:boolean)=>void;
  infoOk:boolean; setInfoOk:(v:boolean)=>void;
  onPublish:()=>void; publishing:boolean; error:string|null;
}) {
  const raw         = useRef(localStorage.getItem("fb_user"));
  const fbUser      = raw.current ? JSON.parse(raw.current) : { firstName:"Vous", lastName:"", avatarUrl:null, countryCode:"CI" };
  const sellerName  = `${fbUser.firstName??""} ${fbUser.lastName??""}`.trim() || "Vous";
  const selectedCo  = COUNTRIES.find(c=>c.code===country)??COUNTRIES[0];
  const rawPrice    = price.replace(/[\s\u202f]/g,"");
  const displayPrice= rawPrice ? `${parseInt(rawPrice).toLocaleString("fr-FR")} FCFA` : "—";

  const photoScore  = photos.length>=3?92 : photos.length>=1?78 : 45;
  const titleScore  = title.length>=20?95 : title.length>=5?70 : 30;
  const descScore   = description.length>=100?94 : description.length>=20?70 : 30;
  const globalScore = Math.round((photoScore+titleScore+descScore)/3);

  const memberSince = () => {
    const d = new Date(); d.setMonth(d.getMonth()-6);
    return d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  };

  const canPublish = title.trim() && rawPrice && photos.length>0 && description.trim() && termsOk && infoOk;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── Preview card ── */}
      <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", border:"1px solid #F1F5F9" }}>
        {/* Photo */}
        <div style={{ position:"relative", height:200, background:"#F1F5F9" }}>
          {photos.length>0
            ? <img src={photos[0].localUrl} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
                <IcCloud/>
                <span style={{ fontSize:13, color:"#9CA3AF" }}>Aucune photo</span>
              </div>
          }
          {photos.length>1 && (
            <div style={{ position:"absolute", bottom:10, right:10, background:"rgba(0,0,0,0.55)", borderRadius:99, padding:"3px 9px", fontSize:12, fontWeight:700, color:"#fff" }}>
              1/{photos.length}
            </div>
          )}
        </div>
        {/* Info */}
        <div style={{ padding:"14px" }}>
          <div style={{ fontWeight:800, fontSize:17, color:"#111827", marginBottom:4 }}>{title||"Titre de l'annonce"}</div>
          <div style={{ fontWeight:800, fontSize:20, color:G, marginBottom:8 }}>{displayPrice}</div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:10 }}>
            <IcLoc/>
            <span style={{ fontSize:13, color:"#6B7280" }}>{city}, {selectedCo.name}</span>
            <span style={{ marginLeft:8, background:"#F1F5F9", borderRadius:99, padding:"2px 8px", fontSize:11.5, fontWeight:600, color:"#6B7280" }}>{condition}</span>
          </div>
          <div style={{ fontSize:13.5, color:"#374151", lineHeight:1.6, maxHeight:60, overflow:"hidden" }}>
            {description||"Description de votre annonce..."}
          </div>
        </div>
      </div>

      {/* ── Seller card ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"14px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {fbUser.avatarUrl
            ? <img src={fbUser.avatarUrl} alt={sellerName} style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", border:`2px solid ${G}` }} />
            : <div style={{ width:48, height:48, borderRadius:"50%", background:G, display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${GD}` }}>
                <span style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{sellerName.charAt(0).toUpperCase()}</span>
              </div>
          }
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontWeight:700, fontSize:15, color:"#111827" }}>{sellerName}</span>
              <span style={{ fontSize:14 }}>✅</span>
            </div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:1 }}>Membre depuis {memberSince()}</div>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, padding:"10px 0", borderTop:"1px solid #F9FAFB" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"center" }}>
              <IcStar/><span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>4.8</span>
            </div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1 }}>(128 avis)</div>
          </div>
          <div style={{ width:"1px", background:"#F1F5F9" }}/>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#111827" }}>98%</div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1 }}>Taux de réponse</div>
          </div>
          <div style={{ width:"1px", background:"#F1F5F9" }}/>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#111827" }}>Rapide</div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1 }}>Temps réponse</div>
          </div>
        </div>
      </div>

      {/* ── Score card ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"14px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:`1px solid ${G}30` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:`${G}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {IcCheck(G)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13.5, color:GD, marginBottom:3 }}>Annonce optimisée</div>
            <div style={{ fontSize:12.5, color:"#374151", lineHeight:1.5 }}>Votre annonce respecte toutes les bonnes pratiques et a plus de chances d'être vue et vendue rapidement.</div>
          </div>
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:9.5, color:"#9CA3AF", marginBottom:2 }}>Score</div>
            <div style={{ width:44, height:44, borderRadius:"50%", background:G, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{globalScore}</span>
            </div>
            <div style={{ fontSize:9.5, color:"#9CA3AF", marginTop:2 }}>/100</div>
          </div>
        </div>
      </div>

      {/* ── Checkboxes ── */}
      <div style={{ background:"#fff", borderRadius:20, padding:"14px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)", border:"1px solid #F1F5F9", display:"flex", flexDirection:"column", gap:12 }}>
        {[
          { label:"Conditions d'utilisation acceptées", value:termsOk, set:setTermsOk },
          { label:"Je confirme que les informations sont exactes", value:infoOk, set:setInfoOk },
        ].map(cb => (
          <div key={cb.label} onClick={()=>cb.set(!cb.value)} style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
            <div style={{
              width:22, height:22, borderRadius:6, border:`2px solid ${cb.value ? G : "#D1D5DB"}`,
              background: cb.value ? G : "#fff", display:"flex", alignItems:"center", justifyContent:"center",
              flexShrink:0, transition:"all 0.15s",
            }}>
              {cb.value && IcCheck()}
            </div>
            <span style={{ fontSize:13.5, color:"#374151", fontWeight:500 }}>{cb.label}</span>
          </div>
        ))}
      </div>

      {/* ── Publish button ── */}
      {error && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:14, padding:"10px 14px", fontSize:13, color:"#DC2626" }}>{error}</div>
      )}
      <button onClick={onPublish} disabled={!canPublish||publishing} style={{
        width:"100%", background: canPublish ? `linear-gradient(135deg, ${G}, ${GD})` : "#E5E7EB",
        border:"none", borderRadius:20, padding:"17px", display:"flex", alignItems:"center",
        justifyContent:"center", gap:10, cursor: canPublish?"pointer":"default",
        boxShadow: canPublish ? `0 8px 24px ${G}45` : "none", transition:"all 0.2s",
      }}>
        {publishing
          ? <div style={{ width:20, height:20, border:"2.5px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          : <IcRocket/>
        }
        <span style={{ fontWeight:800, fontSize:16, color: canPublish?"#fff":"#9CA3AF" }}>
          {publishing ? "Publication en cours…" : "🚀 Publier maintenant"}
        </span>
      </button>
      {canPublish && <div style={{ textAlign:"center", fontSize:12, color:"#9CA3AF" }}>Votre annonce sera visible immédiatement</div>}
      {!canPublish && <div style={{ textAlign:"center", fontSize:12, color:"#EF4444" }}>Complétez tous les champs requis et acceptez les conditions</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER FEATURES BAR
═══════════════════════════════════════════════════════════════════════════ */
const FEATURES = [
  { icon:"🤖", title:"Assistant IA",         desc:"Titre, description, prix suggérés automatiquement" },
  { icon:"🛡️", title:"Sécurité garantie",     desc:"Détection de fraude et protection des utilisateurs" },
  { icon:"📡", title:"Diffusion maximale",    desc:"Touchez des milliers d'acheteurs potentiels" },
  { icon:"⚡", title:"Vendez plus vite",      desc:"Les annonces optimisées se vendent jusqu'à 3x plus vite" },
  { icon:"⭐", title:"Plus de confiance",     desc:"Badge vendeur, avis et score de fiabilité" },
  { icon:"💳", title:"Paiement sécurisé",    desc:"Transactions sécurisées sur BrutePawa" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function CreateListingPage() {
  const navigate = useNavigate();

  /* ── State ── */
  const [step,        setStep]        = useState(1);
  const [photos,      setPhotos]      = useState<Photo[]>([]);
  const [title,       setTitle]       = useState("");
  const [price,       setPrice]       = useState("");
  const [category,    setCategory]    = useState("Électronique");
  const [condition,   setCondition]   = useState("Neuf");
  const [negotiable,  setNegotiable]  = useState(false);
  const [country,     setCountry]     = useState("ML");
  const [city,        setCity]        = useState("Bamako");
  const [description, setDescription] = useState("");
  const [visibility,  setVisibility]  = useState("standard");
  const [duration,    setDuration]    = useState(7);
  const [termsOk,     setTermsOk]     = useState(false);
  const [infoOk,      setInfoOk]      = useState(false);
  const [publishing,  setPublishing]  = useState(false);
  const [error,       setError]       = useState<string|null>(null);

  const { upload, phase, progress } = useR2Upload();
  const [uploading, setUploading]    = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0,0); }, [step]);

  /* ── Photo upload ── */
  const handleSelectFiles = useCallback(async (files: File[]) => {
    const allowed = files.slice(0, 10 - photos.length);
    if (!allowed.length) return;
    setUploading(true);
    for (const file of allowed) {
      const localUrl = URL.createObjectURL(file);
      const result   = await upload(file);
      if (result) setPhotos(prev=>[...prev,{ localUrl, r2Url:result.url, name:file.name }]);
    }
    setUploading(false);
  }, [photos.length, upload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/")||f.type.startsWith("video/"));
    handleSelectFiles(files);
  }, [handleSelectFiles]);

  /* ── Step validation ── */
  const canContinue = () => {
    if (step===1) return true; // can continue with 0 photos (optional but recommended)
    if (step===2) return title.trim().length>0 && price.replace(/[\s\u202f]/g,"").length>0 && description.trim().length>0;
    if (step===3) return true;
    return false;
  };

  /* ── Publish ── */
  const handlePublish = async () => {
    const rawPrice = price.replace(/[\s\u202f]/g,"");
    if (!title.trim()||!rawPrice||!photos.length||!description.trim()||!termsOk||!infoOk) return;
    setPublishing(true); setError(null);
    try {
      const selectedCo = COUNTRIES.find(c=>c.code===country)??COUNTRIES[0];
      await apiCreateProduct({
        title:       title.trim(),
        description: description.trim(),
        price:       parseInt(rawPrice),
        currency:    selectedCo.currency,
        category,
        imageUrl:    photos[0]?.r2Url,
        location:    `${city}, ${selectedCo.name}`,
      });
      navigate("/marketplace");
    } catch(e:unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la publication");
    } finally {
      setPublishing(false);
    }
  };

  const stepTitle    = ["Médias","Informations","Visibilité","Aperçu & Publication"][step-1];
  const stepSubtitle = [
    "Ajoutez des photos ou vidéos de votre article",
    "Décrivez votre article avec précision",
    "Choisissez la visibilité de votre annonce",
    "Vérifiez et publiez votre annonce",
  ][step-1];

  return (
    <div style={{ background:BG, minHeight:"100dvh", display:"flex", flexDirection:"column", fontFamily:"Inter,sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:0; }
      `}</style>

      {/* ══ HEADER ══ */}
      <div style={{
        background:"#fff", borderBottom:"1px solid #F1F5F9",
        padding:"10px 16px 0", position:"sticky", top:0, zIndex:30,
        boxShadow:"0 2px 10px rgba(0,0,0,0.05)",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <button onClick={()=>step>1?setStep(step-1):navigate("/marketplace")} style={{
            width:36, height:36, borderRadius:"50%", background:"#F1F5F9", border:"none",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#374151",
          }}>
            <IcBack/>
          </button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, color:"#9CA3AF", fontWeight:500 }}>Étape {step} sur 4</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#111827", marginTop:1 }}>{stepTitle}</div>
            <div style={{ fontSize:12, color:"#6B7280", marginTop:1 }}>{stepSubtitle}</div>
          </div>
          <button style={{ background:"none", border:"none", color:G, fontWeight:700, fontSize:12.5, cursor:"pointer" }}>
            Enregistrer en brouillon
          </button>
        </div>
        <StepBar step={step} />
      </div>

      {/* ══ CONTENT ══ */}
      <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"16px 16px 100px" }}>
        <div style={{ maxWidth:480, margin:"0 auto", animation:"fadeUp 0.3s ease" }}>
          {step===1 && (
            <Step1
              photos={photos} uploading={uploading} progress={progress} phase={phase}
              onSelectFiles={handleSelectFiles} onRemove={i=>setPhotos(prev=>prev.filter((_,x)=>x!==i))}
              onSetMain={i=>setPhotos(prev=>{ const a=[...prev]; const [item]=a.splice(i,1); return [item,...a]; })}
              onDragOver={()=>{}} onDrop={handleDrop}
            />
          )}
          {step===2 && (
            <Step2
              title={title} setTitle={setTitle} price={price} setPrice={setPrice}
              category={category} setCategory={setCategory} condition={condition} setCondition={setCondition}
              country={country} setCountry={setCountry} city={city} setCity={setCity}
              description={description} setDescription={setDescription}
              negotiable={negotiable} setNegotiable={setNegotiable}
            />
          )}
          {step===3 && (
            <Step3 visibility={visibility} setVisibility={setVisibility} duration={duration} setDuration={setDuration} />
          )}
          {step===4 && (
            <Step4
              title={title} price={price} category={category} condition={condition}
              country={country} city={city} description={description} photos={photos}
              visibility={visibility} termsOk={termsOk} setTermsOk={setTermsOk}
              infoOk={infoOk} setInfoOk={setInfoOk} onPublish={handlePublish}
              publishing={publishing} error={error}
            />
          )}
        </div>

        {/* ── Footer features (step 1 only) ── */}
        {step===1 && (
          <div style={{ maxWidth:480, margin:"24px auto 0" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
              {FEATURES.map(f=>(
                <div key={f.title} style={{ background:"#fff", borderRadius:16, padding:"12px 10px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", border:"1px solid #F1F5F9", textAlign:"center" }}>
                  <div style={{ fontSize:22, marginBottom:5 }}>{f.icon}</div>
                  <div style={{ fontWeight:700, fontSize:11.5, color:"#111827", marginBottom:3 }}>{f.title}</div>
                  <div style={{ fontSize:10.5, color:"#9CA3AF", lineHeight:1.4 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", background:"#fff", borderRadius:14, border:"1px solid #F1F5F9" }}>
              <IcShield/>
              <span style={{ fontSize:12, color:"#6B7280", fontWeight:500 }}>BrutePawa protège vos données et sécurise vos transactions</span>
            </div>
          </div>
        )}
      </div>

      {/* ══ STICKY BOTTOM BUTTON ══ */}
      {step < 4 && (
        <div style={{
          position:"fixed", bottom:0, left:0, right:0, zIndex:30,
          padding:"12px 16px 20px", background:"#fff",
          borderTop:"1px solid #F1F5F9", boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",
        }}>
          <div style={{ maxWidth:480, margin:"0 auto" }}>
            <button
              onClick={()=>canContinue() && setStep(step+1)}
              style={{
                width:"100%", background: canContinue() ? `linear-gradient(135deg, ${G}, ${GD})` : "#E5E7EB",
                border:"none", borderRadius:18, padding:"16px",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                cursor: canContinue()?"pointer":"default",
                boxShadow: canContinue() ? `0 8px 24px ${G}45` : "none",
                transition:"all 0.2s ease",
              }}
            >
              <span style={{ fontWeight:800, fontSize:16, color: canContinue()?"#fff":"#9CA3AF" }}>
                Continuer
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canContinue()?"#fff":"#9CA3AF"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
            {step===2 && !canContinue() && (
              <div style={{ textAlign:"center", fontSize:12, color:"#EF4444", marginTop:6 }}>
                Remplissez le titre, le prix et la description pour continuer
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
