import { useNavigate } from "../router";

const C = { bg:"#F8FAFC",card:"#FFFFFF",primary:"#22C55E",text:"#111827",secondary:"#64748B",muted:"#9CA3AF",border:"#E5E7EB",shadow:"0 2px 16px rgba(0,0,0,0.05)" };

function NavRow({ icon,title,last=false }:{icon:React.ReactNode;title:string;last?:boolean}) {
  return (
    <button style={{ display:"flex",alignItems:"center",gap:14,padding:"15px 18px",background:"none",border:"none",cursor:"pointer",width:"100%",textAlign:"left",borderBottom:last?"none":"1px solid #F8FAFC",transition:"background 150ms" }}
      onPointerDown={e=>(e.currentTarget.style.background="#F8FAFC")} onPointerUp={e=>(e.currentTarget.style.background="none")} onPointerLeave={e=>(e.currentTarget.style.background="none")}>
      <div style={{ width:40,height:40,borderRadius:"50%",background:"#F8FAFC",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{icon}</div>
      <span style={{ flex:1,fontWeight:500,fontSize:14,color:C.text }}>{title}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round"/></svg>
    </button>
  );
}

const sv = { fill:"none",strokeWidth:1.8,strokeLinecap:"round" as const };

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div style={{ background:C.bg,minHeight:"100dvh",fontFamily:"Inter,-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <div style={{ background:"#fff",borderBottom:"1px solid "+C.border,height:56,display:"flex",alignItems:"center",padding:"0 6px",position:"sticky",top:0,zIndex:30 }}>
        <button onClick={()=>navigate("/settings/messaging/advanced")} style={{ width:44,height:44,borderRadius:"50%",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 style={{ flex:1,fontWeight:700,fontSize:17,color:C.text,margin:0,textAlign:"center",letterSpacing:"-0.3px" }}>À propos</h1>
        <div style={{ width:44 }}/>
      </div>

      {/* Hero */}
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"36px 24px 24px",textAlign:"center" }}>
        {/* Logo */}
        <div style={{ width:88,height:88,borderRadius:28,background:"linear-gradient(135deg,#16A34A,#22C55E)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18,boxShadow:"0 12px 36px rgba(34,197,94,0.3)" }}>
          <span style={{ fontSize:42,fontWeight:900,color:"#fff",fontFamily:"Arial,sans-serif",lineHeight:1 }}>b</span>
        </div>
        <div style={{ fontWeight:800,fontSize:24,color:C.text,letterSpacing:"-0.5px",marginBottom:4 }}>BrutePawa</div>
        <div style={{ fontSize:14,color:C.muted,marginBottom:18,fontWeight:500 }}>Version 1.0.0</div>
        <div style={{ background:C.card,borderRadius:20,padding:"14px 20px",boxShadow:C.shadow,maxWidth:320,border:"1px solid "+C.border }}>
          <p style={{ fontSize:14,color:C.secondary,lineHeight:1.7,margin:0 }}>
            BrutePawa est conçu pour vous connecter, partager et créer des relations authentiques.
          </p>
        </div>
      </div>

      {/* Legal links */}
      <div style={{ padding:"0 14px" }}>
        <div style={{ background:C.card,borderRadius:24,boxShadow:C.shadow,overflow:"hidden" }}>
          <NavRow icon={<svg width="18" height="18" viewBox="0 0 24 24" stroke="#64748B" {...sv}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>} title="Conditions d'utilisation"/>
          <NavRow icon={<svg width="18" height="18" viewBox="0 0 24 24" stroke="#64748B" {...sv}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} title="Politique de confidentialité"/>
          <NavRow icon={<svg width="18" height="18" viewBox="0 0 24 24" stroke="#64748B" {...sv}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>} title="Licences"/>
          <NavRow icon={<svg width="18" height="18" viewBox="0 0 24 24" stroke="#64748B" {...sv}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>} title="Nous contacter" last/>
        </div>
      </div>

      {/* Copyright */}
      <div style={{ textAlign:"center",padding:"28px 0 32px" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:6 }}>
          <div style={{ width:22,height:22,borderRadius:6,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ color:"#fff",fontWeight:900,fontSize:13,fontFamily:"Arial,sans-serif" }}>b</span></div>
          <span style={{ fontWeight:700,fontSize:14,color:C.text }}>BrutePawa</span>
        </div>
        <div style={{ fontSize:12,color:C.muted }}>© 2024 BrutePawa. Tous droits réservés.</div>
      </div>
    </div>
  );
}
