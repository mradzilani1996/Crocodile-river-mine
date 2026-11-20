"use client";
import EmsPageHeader from "@/components/ems-page-header";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Row = Record<string, any>;
const field: React.CSSProperties = { display:"grid", gap:6, fontSize:13, fontWeight:650, color:"#344054" };
const input: React.CSSProperties = { width:"100%", padding:"10px 12px", border:"1px solid #d7dde5", borderRadius:8, background:"#fff", color:"#17212b" };
const card: React.CSSProperties = { background:"#fff", border:"1px solid #e4e8ee", borderRadius:14, padding:20, marginBottom:18 };
const btn: React.CSSProperties = { border:0, borderRadius:8, padding:"10px 15px", background:"#173b57", color:"#fff", fontWeight:700, cursor:"pointer" };
const today = new Date().toLocaleDateString("en-CA");

export default function OperationsPage() {
  const supabase = useMemo(() => {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url,key) : null;
  },[]);
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<Row|null>(null);
  const [tab,setTab]=useState("handover");
  const [handovers,setHandovers]=useState<Row[]>([]);
  const [stocktakes,setStocktakes]=useState<Row[]>([]);
  const [accessRows,setAccessRows]=useState<Row[]>([]);
  const [products,setProducts]=useState<Row[]>([]);
  const [ledger,setLedger]=useState<Row[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [handover,setHandover]=useState({handover_date:today,shift:"day",outgoing_person:"",incoming_person:"",stock_status:"checked",security_status:"satisfactory",seal_key_status:"intact",outstanding_matters:"",handover_notes:""});
  const [count,setCount]=useState({count_date:today,product_id:"",physical_balance:"",discrepancy_notes:""});
  const [verifyNotes,setVerifyNotes]=useState<Record<string,string>>({});
  const [access,setAccess]=useState({person_name:"",company_number:"",employer:"",access_type:"entry",purpose:"",authorised_by:"",comments:""});

  async function fetchAllTransactions() {
    if (!supabase) return { data: [] as Row[], error: null as any };
    const all: Row[] = []; const size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await supabase.from("ems_stock_transactions")
        .select("product_id,transaction_type,status,quantity,unit_quantity,adjustment_direction,control_book_section")
        .eq("status","posted").order("created_at",{ascending:true}).range(from,from+size-1);
      if (error) return { data: all, error };
      all.push(...(data||[])); if (!data || data.length < size) break;
    }
    return { data: all, error: null as any };
  }

  async function load() {
    if(!supabase)return;
    const [h,s,a,p,t]=await Promise.all([
      supabase.from("ems_shift_handovers").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("ems_stocktakes").select("*,ems_explosive_products(product_code,product_name,unit_of_measure)").order("count_date",{ascending:false}).limit(200),
      supabase.from("ems_magazine_access_log").select("*").order("access_time",{ascending:false}).limit(300),
      supabase.from("ems_explosive_products").select("id,product_code,product_name,control_book_section,unit_of_measure,is_active,approval_status").eq("is_active",true).eq("approval_status","approved").order("product_name"),
      fetchAllTransactions()
    ]);
    const failure=h.error||s.error||a.error||p.error||t.error;
    if(failure)setError(failure.message);
    setHandovers(h.data||[]);setStocktakes(s.data||[]);setAccessRows(a.data||[]);setProducts(p.data||[]);setLedger(t.data||[]);
  }
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(async({data})=>{
    const current=data.session?.user||null;setUser(current);
    if(current){const {data:p,error:e}=await supabase.from("ems_profiles").select("full_name,role,is_active").eq("user_id",current.id).maybeSingle();if(e)setError(e.message);else if(p?.is_active){setProfile(p);await load();}}
  });},[supabase]);
  const role=profile?.role||"";
  const canLog= ["admin","magazine_master","issuer"].includes(role);
  const canCountStock= ["admin","magazine_master"].includes(role);
  const canVerify=["admin","management"].includes(role);
  const balances=products.map(p=>({product:p,balance:ledger.filter(t=>t.product_id===p.id&&(!t.control_book_section||t.control_book_section===(p.control_book_section||""))).reduce((sum,t)=>{const q=Number(t.unit_quantity||t.quantity||0);if(["receipt","return"].includes(t.transaction_type))return sum+q;if(t.transaction_type==="issue")return sum-q;return sum+(t.adjustment_direction==="increase"?q:-q);},0)}));

  async function saveHandover(e:FormEvent){e.preventDefault();if(!supabase||!user||!profile)return;setBusy(true);setError("");setMessage("");
    const {error:e2}=await supabase.from("ems_shift_handovers").insert({...handover,handed_over_by:user.id,handed_over_by_name:profile.full_name});
    if(e2)setError(e2.message);else{setMessage("Shift handover recorded.");setHandover({handover_date:today,shift:"day",outgoing_person:"",incoming_person:"",stock_status:"checked",security_status:"satisfactory",seal_key_status:"intact",outstanding_matters:"",handover_notes:""});await load();}setBusy(false);
  }
  async function saveCount(e:FormEvent){e.preventDefault();if(!supabase||!user||!profile||!canCountStock)return;const bal=balances.find(x=>x.product.id===count.product_id);if(!bal){setError("Select an approved product.");return;}setBusy(true);setError("");setMessage("");
    const {error:e2}=await supabase.rpc("ems_submit_stocktake",{p_count_date:count.count_date,p_product_id:count.product_id,p_physical_balance:Number(count.physical_balance),p_discrepancy_notes:count.discrepancy_notes||null});
    if(e2)setError(e2.message);else{setMessage("Stocktake submitted. The system balance is saved and stock will not change until Management approves any variance.");setCount({count_date:today,product_id:"",physical_balance:"",discrepancy_notes:""});await load();}setBusy(false);
  }
  async function verify(row:Row,decision:"approve"|"reject"){if(!supabase||!user||!profile||!canVerify)return;setBusy(true);setError("");setMessage("");
    const {error:e2}=await supabase.rpc("ems_review_stocktake",{p_stocktake_id:row.id,p_decision:decision,p_notes:verifyNotes[row.id]||null});
    if(e2)setError(e2.message);else{setMessage(decision==="approve"&&Number(row.variance)!==0?"Approved. The variance adjustment has been posted to the stock ledger.":"Stocktake review completed.");await load();}setBusy(false);
  }
  async function saveAccess(e:FormEvent){e.preventDefault();if(!supabase||!user||!profile)return;setBusy(true);setError("");setMessage("");
    const {error:e2}=await supabase.from("ems_magazine_access_log").insert({...access,logged_by:user.id,logged_by_name:profile.full_name});
    if(e2)setError(e2.message);else{setMessage("Magazine access event recorded.");setAccess({person_name:"",company_number:"",employer:"",access_type:"entry",purpose:"",authorised_by:"",comments:""});await load();}setBusy(false);
  }

  if(!supabase)return <main style={{padding:30}}>EMS database settings are not configured.</main>;
  if(!user||!profile)return <main style={{padding:30,maxWidth:680,margin:"auto"}}><h1>Crocodile River Mine EMS</h1><p>Sign in through the main EMS dashboard to access operational registers.</p><a href="/">Return to EMS login</a></main>;
  return <main className="ems-page" style={{minHeight:"100vh",background:"#f4f6f8",padding:24,color:"#17212b"}}><EmsPageHeader active="operations"/><div style={{maxWidth:1250,margin:"auto"}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:22}}><div><a href="/" style={{color:"#315a75",fontWeight:700,textDecoration:"none"}}>← EMS Dashboard</a><h1 style={{margin:"10px 0 4px",fontSize:30}}>Magazine Operations</h1><p style={{margin:0,color:"#667085"}}>Crocodile River Mine · {profile.full_name} · {role.replaceAll("_"," ")}</p></div><img src="/crm-logo.svg" alt="Crocodile River Mine" style={{width:155,maxHeight:68,objectFit:"contain"}}/></header>
    {error&&<p role="alert" style={{background:"#fff0f0",color:"#9b2424",padding:12,borderRadius:8}}>{error}</p>}{message&&<p style={{background:"#eaf6ef",color:"#17633a",padding:12,borderRadius:8}}>{message}</p>}
    <nav style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{[["handover","Shift handover"],["stocktake","Stock reconciliation"],["access","Magazine access log"]].map(([v,l])=><button key={v} onClick={()=>setTab(v)} style={{...btn,background:tab===v?"#173b57":"#e6ebf0",color:tab===v?"#fff":"#243746"}}>{l}</button>)}</nav>
    {tab==="handover"&&<><section style={card}><h2 style={{marginTop:0}}>Record shift handover</h2>{canLog?<form onSubmit={saveHandover} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
      <label style={field}>Handover date<input type="date" required style={input} value={handover.handover_date} onChange={e=>setHandover({...handover,handover_date:e.target.value})}/></label>
      <label style={field}>Shift<select style={input} value={handover.shift} onChange={e=>setHandover({...handover,shift:e.target.value})}><option value="day">Day shift</option><option value="night">Night shift</option></select></label>
      <label style={field}>Outgoing responsible person<input required style={input} value={handover.outgoing_person} onChange={e=>setHandover({...handover,outgoing_person:e.target.value})}/></label>
      <label style={field}>Incoming responsible person<input required style={input} value={handover.incoming_person} onChange={e=>setHandover({...handover,incoming_person:e.target.value})}/></label>
      <label style={field}>Stock status<select style={input} value={handover.stock_status} onChange={e=>setHandover({...handover,stock_status:e.target.value})}><option value="checked">Checked</option><option value="discrepancy">Discrepancy identified</option><option value="not_checked">Not checked</option></select></label>
      <label style={field}>Security status<select style={input} value={handover.security_status} onChange={e=>setHandover({...handover,security_status:e.target.value})}><option value="satisfactory">Satisfactory</option><option value="issue_reported">Issue reported</option><option value="not_checked">Not checked</option></select></label>
      <label style={field}>Keys / seals status<select style={input} value={handover.seal_key_status} onChange={e=>setHandover({...handover,seal_key_status:e.target.value})}><option value="intact">Intact / accounted for</option><option value="exception_recorded">Exception recorded</option><option value="not_checked">Not checked</option></select></label>
      <label style={{...field,gridColumn:"1/-1"}}>Outstanding matters<textarea rows={3} style={input} value={handover.outstanding_matters} onChange={e=>setHandover({...handover,outstanding_matters:e.target.value})}/></label>
      <label style={{...field,gridColumn:"1/-1"}}>Handover notes<textarea rows={3} style={input} value={handover.handover_notes} onChange={e=>setHandover({...handover,handover_notes:e.target.value})}/></label>
      <div><button style={btn} disabled={busy}>{busy?"Saving…":"Save shift handover"}</button></div></form>:<p>Your role can view handovers but cannot create them.</p>}</section>
      <section style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Shift handover register</h2><button type="button" style={btn} onClick={()=>window.print()}>Print handovers</button></div>{handovers.length?handovers.map(r=><article key={r.id} style={{borderTop:"1px solid #e6eaf0",padding:"14px 0"}}><b>HANDOVER-{r.handover_number} · {r.handover_date} · {r.shift} shift</b><p style={{margin:"6px 0"}}>{r.outgoing_person} → {r.incoming_person}</p><small>Stock: {r.stock_status.replaceAll("_"," ")} · Security: {r.security_status.replaceAll("_"," ")} · Keys/seals: {r.seal_key_status.replaceAll("_"," ")} · Recorded by {r.handed_over_by_name}</small>{r.outstanding_matters&&<p><b>Outstanding:</b> {r.outstanding_matters}</p>}{r.handover_notes&&<p>{r.handover_notes}</p>}</article>):<p>No shift handovers recorded.</p>}</section></>}
    {tab==="stocktake"&&<><section style={card}><h2 style={{marginTop:0}}>Physical stock reconciliation</h2><p>Record the physical count against the posted system balance. A variance is sent for management verification; this form does not change inventory.</p>{canCountStock?<form onSubmit={saveCount} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
      <label style={field}>Count date<input type="date" style={input} value={count.count_date} onChange={e=>setCount({...count,count_date:e.target.value})} required/></label>
      <label style={field}>Product<select style={input} value={count.product_id} onChange={e=>setCount({...count,product_id:e.target.value})} required><option value="">Select product</option>{balances.map(x=><option key={x.product.id} value={x.product.id}>{x.product.control_book_section||"Register"} · {x.product.product_code} · {x.product.product_name}</option>)}</select></label>
      <label style={field}>System balance<input readOnly style={{...input,background:"#f2f4f7"}} value={balances.find(x=>x.product.id===count.product_id)?.balance??""}/></label>
      <label style={field}>Physical balance (units)<input type="number" min="0" step="0.001" style={input} value={count.physical_balance} onChange={e=>setCount({...count,physical_balance:e.target.value})} required/></label>
      <label style={field}>Variance<input readOnly style={{...input,background:"#f2f4f7"}} value={count.physical_balance!==""&&count.product_id?(Number(count.physical_balance)-(balances.find(x=>x.product.id===count.product_id)?.balance||0)).toLocaleString("en-ZA"): ""}/></label>
      <label style={{...field,gridColumn:"1/-1"}}>Explain any shortage or overage<textarea rows={2} style={input} value={count.discrepancy_notes} onChange={e=>setCount({...count,discrepancy_notes:e.target.value})} placeholder="Required when the physical count differs from the system balance"/></label>
      <div><button style={btn} disabled={busy||!products.length}>{busy?"Saving…":"Submit count for verification"}</button></div></form>:<p>Your role can view reconciliations but cannot submit counts.</p>}</section>
      <section style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Stocktake register</h2><button type="button" style={btn} onClick={()=>window.print()}>Print stocktakes</button></div>{stocktakes.length?stocktakes.map(r=><article key={r.id} style={{borderTop:"1px solid #e6eaf0",padding:"14px 0"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><b>COUNT-{r.stocktake_number} · {r.control_book_section||"Register"} · {r.ems_explosive_products?.product_name||"Product"} · {r.count_date}</b><b>{r.status.replaceAll("_"," ")}</b></div><p>System: {Number(r.system_balance).toLocaleString("en-ZA")} · Physical: {Number(r.physical_balance).toLocaleString("en-ZA")} · Variance: {Number(r.variance).toLocaleString("en-ZA")}</p><small>Counted by {r.counted_by_name}{r.discrepancy_notes?" · "+r.discrepancy_notes:""}</small>{r.status==="pending_verification"&&canVerify&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><input style={{...input,maxWidth:400}} placeholder={Number(r.variance)!==0?"Management explanation (required)":"Review notes"} value={verifyNotes[r.id]||""} onChange={e=>setVerifyNotes({...verifyNotes,[r.id]:e.target.value})}/><button style={btn} disabled={busy} onClick={()=>verify(r,"approve")}>Approve count{Number(r.variance)!==0?" & post adjustment":""}</button><button style={{...btn,background:"#8a3a28"}} disabled={busy} onClick={()=>verify(r,"reject")}>Reject</button></div>}{r.verification_notes&&<p><b>Management review:</b> {r.verification_notes}</p>}{r.adjustment_transaction_id&&<p><b>Ledger adjustment:</b> {r.adjustment_transaction_id} · posted {r.adjustment_posted_at?new Date(r.adjustment_posted_at).toLocaleString("en-ZA"):""}</p>}{r.verified_by_name&&<small>Reviewed by {r.verified_by_name}{r.verified_at?" · "+new Date(r.verified_at).toLocaleString("en-ZA"):""}</small>}</article>):<p>No stocktake records.</p>}</section></>}
    {tab==="access"&&<><section style={card}><h2 style={{marginTop:0}}>Magazine access event</h2>{canLog?<form onSubmit={saveAccess} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
      <label style={field}>Person's full name<input required style={input} value={access.person_name} onChange={e=>setAccess({...access,person_name:e.target.value})}/></label>
      <label style={field}>Company / employee number<input style={input} value={access.company_number} onChange={e=>setAccess({...access,company_number:e.target.value})}/></label>
      <label style={field}>Employer / contractor<input style={input} value={access.employer} onChange={e=>setAccess({...access,employer:e.target.value})}/></label>
      <label style={field}>Entry or exit<select style={input} value={access.access_type} onChange={e=>setAccess({...access,access_type:e.target.value})}><option value="entry">Entry</option><option value="exit">Exit</option></select></label>
      <label style={field}>Purpose of visit<input required style={input} value={access.purpose} onChange={e=>setAccess({...access,purpose:e.target.value})}/></label>
      <label style={field}>Authorised by<input style={input} value={access.authorised_by} onChange={e=>setAccess({...access,authorised_by:e.target.value})}/></label>
      <label style={{...field,gridColumn:"1/-1"}}>Comments<textarea rows={2} style={input} value={access.comments} onChange={e=>setAccess({...access,comments:e.target.value})}/></label>
      <div><button style={btn} disabled={busy}>{busy?"Saving…":"Record access event"}</button></div></form>:<p>Your role can view the access register but cannot record events.</p>}</section>
      <section style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Magazine access register</h2><button type="button" style={btn} onClick={()=>window.print()}>Print access register</button></div>{accessRows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr>{["Date / time","Person","Company no.","Employer","Event","Purpose","Authorised by","Logged by"].map(x=><th key={x} style={{padding:10,borderBottom:"1px solid #dce2e8"}}>{x}</th>)}</tr></thead><tbody>{accessRows.map(r=><tr key={r.id}>{[new Date(r.access_time).toLocaleString("en-ZA"),r.person_name,r.company_number||"—",r.employer||"—",r.access_type,r.purpose,r.authorised_by||"—",r.logged_by_name].map((v,i)=><td key={i} style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{v}</td>)}</tr>)}</tbody></table></div>:<p>No access events recorded.</p>}</section></>}
    <footer style={{color:"#667085",fontSize:12,padding:12}}>CROCODILE RIVER MINE · EXPLOSIVES MANAGEMENT SYSTEM · AUTHORISED ACCESS ONLY</footer>
  </div></main>;
}
