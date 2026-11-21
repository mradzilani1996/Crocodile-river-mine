"use client";
import EmsPageHeader from "@/components/ems-page-header";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Row = Record<string, any>;
const field: React.CSSProperties = { display:"grid", gap:9, fontSize:16, fontWeight:700, color:"#263746" };
const input: React.CSSProperties = { width:"100%", minHeight:52, padding:"13px 15px", border:"2px solid #cbd5df", borderRadius:10, background:"#fff", color:"#17212b", fontSize:17, lineHeight:1.4 };
const card: React.CSSProperties = { background:"#fff", border:"1px solid #dce3ea", borderRadius:16, padding:24, marginBottom:20, boxShadow:"0 2px 8px rgba(16,24,40,.04)" };
const btn: React.CSSProperties = { border:0, borderRadius:11, padding:"15px 20px", minHeight:54, background:"#173b57", color:"#fff", fontSize:16, fontWeight:750, cursor:"pointer" };
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
  const [corrections,setCorrections]=useState<Record<string,{count_date:string;physical_balance:string;discrepancy_notes:string}>>({});
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
    if(e2)setError(e2.message);else{setMessage("Stock count sent to Management. Stock will only change if Management approves a difference.");setCount({count_date:today,product_id:"",physical_balance:"",discrepancy_notes:""});await load();}setBusy(false);
  }
  async function verify(row:Row,decision:"approve"|"reject"){if(!supabase||!user||!profile||!canVerify)return;setBusy(true);setError("");setMessage("");
    const {error:e2}=await supabase.rpc("ems_review_stocktake",{p_stocktake_id:row.id,p_decision:decision,p_notes:verifyNotes[row.id]||null});
    if(e2)setError(e2.message);else{setMessage(decision==="approve"&&Number(row.variance)!==0?"Approved. The variance adjustment has been posted to the stock ledger.":"Stock count review completed.");await load();}setBusy(false);
  }
  async function resubmitCount(row:Row){if(!supabase||!user||!profile||!canCountStock)return;const v=corrections[row.id]||{count_date:row.count_date,physical_balance:String(row.physical_balance),discrepancy_notes:row.discrepancy_notes||""};if(!v.count_date||v.physical_balance===""||!Number.isFinite(Number(v.physical_balance))||Number(v.physical_balance)<0){setError("Enter a valid count date and physical quantity.");return;}if(Number(v.physical_balance)!==Number(row.system_balance)&&!v.discrepancy_notes.trim()){setError("Explain the shortage or overage before resubmitting.");return;}setBusy(true);setError("");setMessage("");const {error:e2}=await supabase.rpc("ems_resubmit_stocktake",{p_stocktake_id:row.id,p_count_date:v.count_date,p_physical_balance:Number(v.physical_balance),p_discrepancy_notes:v.discrepancy_notes||null});if(e2)setError(e2.message);else{setMessage("Corrected count resubmitted to Management for review.");setCorrections({...corrections,[row.id]:{...v}});await load();}setBusy(false);}

  async function saveAccess(e:FormEvent){e.preventDefault();if(!supabase||!user||!profile)return;setBusy(true);setError("");setMessage("");
    const {error:e2}=await supabase.from("ems_magazine_access_log").insert({...access,logged_by:user.id,logged_by_name:profile.full_name});
    if(e2)setError(e2.message);else{setMessage("Visitor entry or exit recorded.");setAccess({person_name:"",company_number:"",employer:"",access_type:"entry",purpose:"",authorised_by:"",comments:""});await load();}setBusy(false);
  }

  if(!supabase)return <main style={{padding:30}}>EMS database settings are not configured.</main>;
  if(!user||!profile)return <main style={{padding:30,maxWidth:680,margin:"auto"}}><h1>Crocodile River Mine EMS</h1><p>Sign in through the main EMS dashboard to access operational registers.</p><a href="/">Return to EMS login</a></main>;
  return <main className="ems-page" style={{minHeight:"100vh",background:"#f4f6f8",padding:"18px 14px",color:"#17212b",fontSize:16,lineHeight:1.55}}><EmsPageHeader active="operations"/><div style={{maxWidth:1250,margin:"auto"}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:22}}><div><a href="/" style={{color:"#315a75",fontWeight:700,textDecoration:"none"}}>← EMS Dashboard</a><h1 style={{margin:"10px 0 4px",fontSize:30}}>Magazine Operations</h1><p style={{margin:0,color:"#667085"}}>Crocodile River Mine · {profile.full_name} · {role.replaceAll("_"," ")}</p></div><img src="/crm-logo.svg" alt="Crocodile River Mine" style={{width:155,maxHeight:68,objectFit:"contain"}}/></header>
    {error&&<p role="alert" style={{background:"#fff0f0",color:"#9b2424",padding:12,borderRadius:8}}>{error}</p>}{message&&<p style={{background:"#eaf6ef",color:"#17633a",padding:12,borderRadius:8}}>{message}</p>}
    <section style={{...card,padding:18,marginBottom:18}}><h2 style={{fontSize:21,margin:"0 0 6px"}}>What would you like to do?</h2><p style={{margin:"0 0 14px",color:"#596879"}}>Choose one of the three large buttons below. You can return here at any time.</p><nav style={{display:"flex",gap:12,flexWrap:"wrap"}}>{[["handover","1. Shift handover"],["stocktake","2. Count stock"],["access","3. Visitor entry / exit"]].map(([v,l])=><button key={v} onClick={()=>{setTab(v);setMessage("");setError("");}} aria-pressed={tab===v} style={{...btn,flex:"1 1 220px",minHeight:68,textAlign:"left",background:tab===v?"#173b57":"#fff",color:tab===v?"#fff":"#173b57",border:tab===v?"2px solid #173b57":"2px solid #cbd5df",boxShadow:tab===v?"0 2px 7px rgba(23,59,87,.16)":"none"}}>{l}</button>)}</nav></section>
    {tab==="handover"&&<><section style={card}><h2 style={{marginTop:0}}>Record a shift handover</h2>{canLog?<form onSubmit={saveHandover} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
      <label style={field}>Handover date<input type="date" required style={input} value={handover.handover_date} onChange={e=>setHandover({...handover,handover_date:e.target.value})}/></label>
      <label style={field}>Shift<select style={input} value={handover.shift} onChange={e=>setHandover({...handover,shift:e.target.value})}><option value="day">Day shift</option><option value="night">Night shift</option></select></label>
      <label style={field}>Outgoing responsible person<input required style={input} value={handover.outgoing_person} onChange={e=>setHandover({...handover,outgoing_person:e.target.value})}/></label>
      <label style={field}>Incoming responsible person<input required style={input} value={handover.incoming_person} onChange={e=>setHandover({...handover,incoming_person:e.target.value})}/></label>
      <label style={field}>Stock status<select style={input} value={handover.stock_status} onChange={e=>setHandover({...handover,stock_status:e.target.value})}><option value="checked">Checked</option><option value="discrepancy">Discrepancy identified</option><option value="not_checked">Not checked</option></select></label>
      <label style={field}>Security status<select style={input} value={handover.security_status} onChange={e=>setHandover({...handover,security_status:e.target.value})}><option value="satisfactory">Satisfactory</option><option value="issue_reported">Issue reported</option><option value="not_checked">Not checked</option></select></label>
      <label style={field}>Keys / seals status<select style={input} value={handover.seal_key_status} onChange={e=>setHandover({...handover,seal_key_status:e.target.value})}><option value="intact">Intact / accounted for</option><option value="exception_recorded">Exception recorded</option><option value="not_checked">Not checked</option></select></label>
      <label style={{...field,gridColumn:"1/-1"}}>Outstanding matters<textarea rows={3} style={input} value={handover.outstanding_matters} onChange={e=>setHandover({...handover,outstanding_matters:e.target.value})}/></label>
      <label style={{...field,gridColumn:"1/-1"}}>Handover notes<textarea rows={3} style={input} value={handover.handover_notes} onChange={e=>setHandover({...handover,handover_notes:e.target.value})}/></label>
      <div><button style={btn} disabled={busy}>{busy?"Saving…":"Save shift handover"}</button></div></form>:<p>Your access is view-only. You cannot record a handover.</p>}</section>
      <section style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Previous shift handovers</h2><button type="button" style={btn} onClick={()=>window.print()}>Print handovers</button></div>{handovers.length?handovers.map(r=><article key={r.id} style={{borderTop:"1px solid #e6eaf0",padding:"14px 0"}}><b>HANDOVER-{r.handover_number} · {r.handover_date} · {r.shift} shift</b><p style={{margin:"6px 0"}}>{r.outgoing_person} → {r.incoming_person}</p><small>Stock: {r.stock_status.replaceAll("_"," ")} · Security: {r.security_status.replaceAll("_"," ")} · Keys/seals: {r.seal_key_status.replaceAll("_"," ")} · Recorded by {r.handed_over_by_name}</small>{r.outstanding_matters&&<p><b>Outstanding:</b> {r.outstanding_matters}</p>}{r.handover_notes&&<p>{r.handover_notes}</p>}</article>):<p>No shift handovers have been recorded yet.</p>}</section></>}
    {tab==="stocktake"&&<><section style={card}><h2 style={{marginTop:0}}>Count the stock</h2><p>Count what is physically in the magazine and compare it with the system balance. If the numbers differ, Management must check and approve the difference before stock changes.</p>{canCountStock?<form onSubmit={saveCount} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
      <label style={field}>Count date<input type="date" style={input} value={count.count_date} onChange={e=>setCount({...count,count_date:e.target.value})} required/></label>
      <label style={field}>Product<select style={input} value={count.product_id} onChange={e=>setCount({...count,product_id:e.target.value})} required><option value="">Select product</option>{balances.map(x=><option key={x.product.id} value={x.product.id}>{x.product.control_book_section||"Register"} · {x.product.product_code} · {x.product.product_name}</option>)}</select></label>
      <label style={field}>System quantity<input readOnly style={{...input,background:"#f2f4f7"}} value={balances.find(x=>x.product.id===count.product_id)?.balance??""}/></label>
      <label style={field}>Quantity counted in magazine<input type="number" min="0" step="0.001" style={input} value={count.physical_balance} onChange={e=>setCount({...count,physical_balance:e.target.value})} required/></label>
      <label style={field}>Difference<input readOnly style={{...input,background:"#f2f4f7"}} value={count.physical_balance!==""&&count.product_id?(Number(count.physical_balance)-(balances.find(x=>x.product.id===count.product_id)?.balance||0)).toLocaleString("en-ZA"): ""}/></label>
      <label style={{...field,gridColumn:"1/-1"}}>Explain why the quantities are different<textarea rows={2} style={input} value={count.discrepancy_notes} onChange={e=>setCount({...count,discrepancy_notes:e.target.value})} placeholder="Required when the physical count differs from the system balance"/></label>
      <div><button style={btn} disabled={busy||!products.length}>{busy?"Saving…":"Send count to Management"}</button></div></form>:<p>Your access is view-only. You cannot submit stock counts.</p>}</section>
      <section style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Previous stock counts</h2><button type="button" style={btn} onClick={()=>window.print()}>Print stocktakes</button></div>{stocktakes.length?stocktakes.map(r=><article key={r.id} style={{borderTop:"1px solid #e6eaf0",padding:"14px 0"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><b>COUNT-{r.stocktake_number} · {r.control_book_section||"Register"} · {r.ems_explosive_products?.product_name||"Product"} · {r.count_date}</b><b>{r.status.replaceAll("_"," ")}</b></div><p>System: {Number(r.system_balance).toLocaleString("en-ZA")} · Physical: {Number(r.physical_balance).toLocaleString("en-ZA")} · Variance: {Number(r.variance).toLocaleString("en-ZA")}</p><small>Counted by {r.counted_by_name}{r.discrepancy_notes?" · "+r.discrepancy_notes:""}</small>{r.status==="rejected"&&r.counted_by===user.id&&canCountStock&&<div style={{marginTop:14,padding:14,border:"2px solid #d97706",borderRadius:10,background:"#fffaf0"}}><b style={{color:"#8a4b08"}}>Returned to you for correction</b><p style={{margin:"6px 0 10px"}}><b>Management reason:</b> {r.verification_notes||"Please correct the count and resubmit."}</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}><label style={field}>Corrected count date<input type="date" style={input} value={(corrections[r.id]?.count_date)||r.count_date} onChange={e=>setCorrections({...corrections,[r.id]:{count_date:e.target.value,physical_balance:corrections[r.id]?.physical_balance??String(r.physical_balance),discrepancy_notes:corrections[r.id]?.discrepancy_notes??(r.discrepancy_notes||"")}})}/></label><label style={field}>Correct physical quantity<input type="number" min="0" step="0.001" style={input} value={corrections[r.id]?.physical_balance??String(r.physical_balance)} onChange={e=>setCorrections({...corrections,[r.id]:{count_date:corrections[r.id]?.count_date??r.count_date,physical_balance:e.target.value,discrepancy_notes:corrections[r.id]?.discrepancy_notes??(r.discrepancy_notes||"")}})}/></label><label style={{...field,gridColumn:"1/-1"}}>Updated explanation<textarea rows={2} style={input} value={corrections[r.id]?.discrepancy_notes??(r.discrepancy_notes||"")} onChange={e=>setCorrections({...corrections,[r.id]:{count_date:corrections[r.id]?.count_date??r.count_date,physical_balance:corrections[r.id]?.physical_balance??String(r.physical_balance),discrepancy_notes:e.target.value}})}/></label></div><button type="button" style={{...btn,marginTop:10}} disabled={busy} onClick={()=>resubmitCount(r)}>Correct and resubmit to Management</button></div>}{r.status==="pending_verification"&&canVerify&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><input style={{...input,maxWidth:400}} placeholder={Number(r.variance)!==0?"Explain the difference (required)":"Review notes"} value={verifyNotes[r.id]||""} onChange={e=>setVerifyNotes({...verifyNotes,[r.id]:e.target.value})}/><button style={btn} disabled={busy} onClick={()=>verify(r,"approve")}>Approve count{Number(r.variance)!==0?" & post adjustment":""}</button><button style={{...btn,background:"#8a3a28"}} disabled={busy} onClick={()=>verify(r,"reject")}>Reject</button></div>}{r.verification_notes&&<p><b>Management review:</b> {r.verification_notes}</p>}{r.adjustment_transaction_id&&<p><b>Ledger adjustment:</b> {r.adjustment_transaction_id} · posted {r.adjustment_posted_at?new Date(r.adjustment_posted_at).toLocaleString("en-ZA"):""}</p>}{r.verified_by_name&&<small>Reviewed by {r.verified_by_name}{r.verified_at?" · "+new Date(r.verified_at).toLocaleString("en-ZA"):""}</small>}</article>):<p>No stock counts have been recorded yet.</p>}</section></>}
    {tab==="access"&&<><section style={card}><h2 style={{marginTop:0}}>Magazine access event</h2>{canLog?<form onSubmit={saveAccess} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
      <label style={field}>Visitor full name<input required style={input} value={access.person_name} onChange={e=>setAccess({...access,person_name:e.target.value})}/></label>
      <label style={field}>Company or employee number<input style={input} value={access.company_number} onChange={e=>setAccess({...access,company_number:e.target.value})}/></label>
      <label style={field}>Company name<input style={input} value={access.employer} onChange={e=>setAccess({...access,employer:e.target.value})}/></label>
      <label style={field}>Entry or exit<select style={input} value={access.access_type} onChange={e=>setAccess({...access,access_type:e.target.value})}><option value="entry">Entry</option><option value="exit">Exit</option></select></label>
      <label style={field}>Reason for visit<input required style={input} value={access.purpose} onChange={e=>setAccess({...access,purpose:e.target.value})}/></label>
      <label style={field}>Approved by<input style={input} value={access.authorised_by} onChange={e=>setAccess({...access,authorised_by:e.target.value})}/></label>
      <label style={{...field,gridColumn:"1/-1"}}>Comments<textarea rows={2} style={input} value={access.comments} onChange={e=>setAccess({...access,comments:e.target.value})}/></label>
      <div><button style={btn} disabled={busy}>{busy?"Saving…":"Save visitor record"}</button></div></form>:<p>Your access is view-only. You cannot record visitor entries or exits.</p>}</section>
      <section style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Magazine access register</h2><button type="button" style={btn} onClick={()=>window.print()}>Print access register</button></div>{accessRows.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr>{["Date / time","Person","Company no.","Employer","Event","Purpose","Authorised by","Logged by"].map(x=><th key={x} style={{padding:10,borderBottom:"1px solid #dce2e8"}}>{x}</th>)}</tr></thead><tbody>{accessRows.map(r=><tr key={r.id}>{[new Date(r.access_time).toLocaleString("en-ZA"),r.person_name,r.company_number||"—",r.employer||"—",r.access_type,r.purpose,r.authorised_by||"—",r.logged_by_name].map((v,i)=><td key={i} style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{v}</td>)}</tr>)}</tbody></table></div>:<p>No visitor entries or exits have been recorded yet.</p>}</section></>}
    <footer style={{color:"#667085",fontSize:12,padding:12}}>CROCODILE RIVER MINE · EXPLOSIVES MANAGEMENT SYSTEM · AUTHORISED ACCESS ONLY</footer>
  </div></main>;
}
