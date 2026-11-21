"use client";
import EmsPageHeader from "@/components/ems-page-header";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Row = Record<string, any>;
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #d7dde5", borderRadius: 8, background: "#fff", color: "#17212b" };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#344054" };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e4e8ee", borderRadius: 14, padding: 20, marginBottom: 18 };
const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 15px", background: "#173b57", color: "#fff", fontWeight: 700, cursor: "pointer" };

export default function CompliancePage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key) : null;
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Row | null>(null);
  const [tab, setTab] = useState("incidents");
  const [incidents, setIncidents] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [incident, setIncident] = useState({ incident_type: "other", severity: "low", location: "", description: "", immediate_action: "" });
  const [inspection, setInspection] = useState({ inspection_type: "Magazine inspection", location: "", findings: "", non_conformances: "", corrective_actions: "", responsible_person: "", due_date: "" });
  const [document, setDocument] = useState({ document_number: "", title: "", document_type: "Controlled document", effective_date: "", review_date: "" });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string,string>>({});
  const role = profile?.role || "";
  const canManage = ["admin","management","magazine_master"].includes(role);
  const canInspect = ["admin","management","magazine_master","authorising_officer"].includes(role);

  async function load() {
    if (!supabase) return;
    const [i, s, d] = await Promise.all([
      supabase.from("ems_incidents").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("ems_inspections").select("*").order("inspection_date",{ascending:false}).limit(200),
      supabase.from("ems_document_register").select("*").order("document_number")
    ]);
    if (i.error || s.error || d.error) setError(i.error?.message || s.error?.message || d.error?.message || "Unable to load records.");
    setIncidents(i.data || []); setInspections(s.data || []); setDocuments(d.data || []);
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({data}) => {
      const current = data.session?.user || null;
      setUser(current);
      if (current) {
        const {data: p, error: pe} = await supabase.from("ems_profiles").select("full_name,email,role,is_active").eq("user_id",current.id).maybeSingle();
        if (pe) setError(pe.message);
        else if (!p?.is_active) setError("Your EMS account is not active.");
        else { setProfile(p); await load(); }
      }
    });
  }, [supabase]);

  async function submitIncident(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !profile) return;
    setBusy(true); setError(""); setMessage("");
    const {error: err} = await supabase.from("ems_incidents").insert({...incident,reported_by:user.id,reporter_name:profile.full_name});
    if (err) setError(err.message); else { setIncident({incident_type:"other",severity:"low",location:"",description:"",immediate_action:""}); setMessage("Incident report submitted."); await load(); }
    setBusy(false);
  }
  async function submitInspection(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !profile) return;
    setBusy(true); setError(""); setMessage("");
    const {error: err} = await supabase.from("ems_inspections").insert({...inspection,inspector_id:user.id,inspector_name:profile.full_name,due_date:inspection.due_date || null});
    if (err) setError(err.message); else { setInspection({inspection_type:"Magazine inspection",location:"",findings:"",non_conformances:"",corrective_actions:"",responsible_person:"",due_date:""}); setMessage("Inspection recorded."); await load(); }
    setBusy(false);
  }
  async function submitDocument(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !profile || !canManage) return;
    if (!documentFile) { setError("Choose the actual document file to upload."); return; }
    if (documentFile.size > 25 * 1024 * 1024) { setError("The document must be 25 MB or smaller."); return; }
    setBusy(true); setError(""); setMessage("");
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = user.id + "/" + Date.now() + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from("ems-documents").upload(storagePath, documentFile, { upsert: false, contentType: documentFile.type || "application/octet-stream" });
    if (uploadError) { setError("Document upload failed: " + uploadError.message); setBusy(false); return; }
    const {error: err} = await supabase.from("ems_document_register").upsert({...document, revision:"Not specified", external_url:null, storage_path:storagePath, uploaded_by:user.id, uploaded_by_name:profile.full_name},{onConflict:"document_number"});
    if (err) {
      await supabase.storage.from("ems-documents").remove([storagePath]);
      setError("The file uploaded, but its register entry could not be saved: " + err.message);
    } else {
      setMessage("Document and register entry saved successfully.");
      setDocument({ document_number:"", title:"", document_type:"Controlled document", effective_date:"", review_date:"" });
      setDocumentFile(null);
      const picker = window.document.getElementById("controlled-document-file") as HTMLInputElement | null;
      if (picker) picker.value = "";
      await load();
    }
    setBusy(false);
  }

  async function openDocument(row: Row) {
    if (!supabase) return;
    if (row.storage_path) {
      const { data, error: signedError } = await supabase.storage.from("ems-documents").createSignedUrl(row.storage_path, 300);
      if (signedError || !data?.signedUrl) { setError("The stored document could not be opened: " + (signedError?.message || "No download link returned.")); return; }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } else if (row.external_url) window.open(row.external_url, "_blank", "noopener,noreferrer");
    else setError("No uploaded file is attached to this register entry.");
  }
  async function reviewIncident(row: Row, status: string) {
    if (!supabase || !user || !canManage) return;
    setBusy(true); setError(""); setMessage("");
    const {error: err} = await supabase.from("ems_incidents").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString(),review_notes:reviewNotes[row.id] || null,closed_at:status==="closed"?new Date().toISOString():null}).eq("id",row.id);
    if (err) setError(err.message); else { setMessage("Incident review updated."); await load(); }
    setBusy(false);
  }
  async function updateInspection(row: Row, status: string) {
    if (!supabase || !user || !canManage) return;
    setBusy(true); setError(""); setMessage("");
    const {error: err} = await supabase.from("ems_inspections").update({status,verified_by:user.id,verified_at:new Date().toISOString()}).eq("id",row.id);
    if (err) setError(err.message); else { setMessage("Inspection status updated."); await load(); }
    setBusy(false);
  }

  if (!supabase) return <main style={{padding:32}}>EMS database settings are not configured.</main>;
  if (!user || !profile) return <main style={{padding:32,maxWidth:650,margin:"auto"}}><h1>Crocodile River Mine EMS</h1><p>Sign in through the main EMS dashboard first, then open the Compliance & Incident Register.</p><a href="/">Return to EMS login</a></main>;

  return <main className="ems-page" style={{minHeight:"100vh",background:"#f4f6f8",padding:24,color:"#17212b"}}>
    <EmsPageHeader active="safety"/><div style={{maxWidth:1240,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:22}}>
        <div><a href="/" style={{color:"#315a75",textDecoration:"none",fontWeight:700}}>← EMS Dashboard</a><h1 style={{margin:"10px 0 4px",fontSize:30}}>Compliance & Incident Register</h1><p style={{margin:0,color:"#667085"}}>Crocodile River Mine · Signed in as {profile.full_name} · {role.replaceAll("_"," ")}</p></div>
        <img src="/images/eastplats-reference-logo.svg" alt="Eastplats Barplats Mines logo" style={{width:160,maxHeight:70,objectFit:"contain"}} />
      </header>
      {error && <p role="alert" style={{background:"#fff0f0",color:"#9b2424",padding:12,borderRadius:8}}>{error}</p>}
      {message && <p style={{background:"#eaf6ef",color:"#17633a",padding:12,borderRadius:8}}>{message}</p>}
      <nav style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
        {["incidents","inspections","documents"].map(x=><button key={x} onClick={()=>setTab(x)} style={{...buttonStyle,background:tab===x?"#173b57":"#e6ebf0",color:tab===x?"#fff":"#243746",textTransform:"capitalize"}}>{x==="incidents"?"Incidents & discrepancies":x==="inspections"?"Inspections & compliance":"Document register"}</button>)}
      </nav>
      {tab==="incidents" && <>
        <section style={cardStyle}><h2 style={{marginTop:0}}>Report an incident or discrepancy</h2><form onSubmit={submitIncident} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
          <label style={labelStyle}>Incident category<select style={inputStyle} value={incident.incident_type} onChange={e=>setIncident({...incident,incident_type:e.target.value})}>{["shortage","over-issue","unreturned-stock","damaged-packaging","documentation-error","security-concern","other"].map(x=><option key={x} value={x}>{x.replaceAll("-"," ")}</option>)}</select></label>
          <label style={labelStyle}>Severity<select style={inputStyle} value={incident.severity} onChange={e=>setIncident({...incident,severity:e.target.value})}>{["low","medium","high","critical"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label style={labelStyle}>Location / section<input required style={inputStyle} value={incident.location} onChange={e=>setIncident({...incident,location:e.target.value})}/></label>
          <label style={{...labelStyle,gridColumn:"1/-1"}}>Description<textarea required rows={3} style={inputStyle} value={incident.description} onChange={e=>setIncident({...incident,description:e.target.value})}/></label>
          <label style={{...labelStyle,gridColumn:"1/-1"}}>Immediate action taken<textarea rows={2} style={inputStyle} value={incident.immediate_action} onChange={e=>setIncident({...incident,immediate_action:e.target.value})}/></label>
          <div><button disabled={busy} style={buttonStyle}>{busy?"Submitting…":"Submit incident report"}</button></div>
        </form></section>
        <section style={cardStyle}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Incident & discrepancy history</h2><button type="button" style={buttonStyle} onClick={()=>window.print()}>Print incident register</button></div>{incidents.length===0?<p>No incidents have been recorded.</p>:incidents.map(r=><article key={r.id} style={{borderTop:"1px solid #e6eaf0",padding:"14px 0"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><b>INC-{r.incident_number} · {r.incident_type.replaceAll("-"," ")}</b><span>{r.status.replaceAll("_"," ")} · {r.severity}</span></div><p>{r.description}</p><small>{new Date(r.incident_date).toLocaleString("en-ZA")} · {r.location} · Reported by {r.reporter_name}</small>{r.immediate_action&&<p><b>Immediate action:</b> {r.immediate_action}</p>}{canManage&&r.status!=="closed"&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><input placeholder="Review / corrective action notes" style={{...inputStyle,maxWidth:420}} value={reviewNotes[r.id]||""} onChange={e=>setReviewNotes({...reviewNotes,[r.id]:e.target.value})}/><button style={buttonStyle} disabled={busy} onClick={()=>reviewIncident(r,"under_review")}>Under review</button><button style={buttonStyle} disabled={busy} onClick={()=>reviewIncident(r,"action_required")}>Action required</button><button style={buttonStyle} disabled={busy} onClick={()=>reviewIncident(r,"closed")}>Close incident</button></div>}{r.review_notes&&<p><b>Review notes:</b> {r.review_notes}</p>}</article>)}</section>
      </>}
      {tab==="inspections" && <>
        <section style={cardStyle}><h2 style={{marginTop:0}}>Record inspection / compliance finding</h2>{canInspect?<form onSubmit={submitInspection} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
          <label style={labelStyle}>Inspection type<input required style={inputStyle} value={inspection.inspection_type} onChange={e=>setInspection({...inspection,inspection_type:e.target.value})}/></label>
          <label style={labelStyle}>Location<input required style={inputStyle} value={inspection.location} onChange={e=>setInspection({...inspection,location:e.target.value})}/></label>
          <label style={{...labelStyle,gridColumn:"1/-1"}}>Findings<textarea required rows={3} style={inputStyle} value={inspection.findings} onChange={e=>setInspection({...inspection,findings:e.target.value})}/></label>
          <label style={{...labelStyle,gridColumn:"1/-1"}}>Non-conformances<textarea rows={2} style={inputStyle} value={inspection.non_conformances} onChange={e=>setInspection({...inspection,non_conformances:e.target.value})}/></label>
          <label style={{...labelStyle,gridColumn:"1/-1"}}>Corrective actions<textarea rows={2} style={inputStyle} value={inspection.corrective_actions} onChange={e=>setInspection({...inspection,corrective_actions:e.target.value})}/></label>
          <label style={labelStyle}>Responsible person<input style={inputStyle} value={inspection.responsible_person} onChange={e=>setInspection({...inspection,responsible_person:e.target.value})}/></label>
          <label style={labelStyle}>Action due date<input type="date" style={inputStyle} value={inspection.due_date} onChange={e=>setInspection({...inspection,due_date:e.target.value})}/></label>
          <div><button disabled={busy} style={buttonStyle}>Save inspection</button></div>
        </form>:<p>Your role can view inspection records but cannot create inspections.</p>}</section>
        <section style={cardStyle}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Inspection register</h2><button type="button" style={buttonStyle} onClick={()=>window.print()}>Print inspections</button></div>{inspections.length===0?<p>No inspections recorded.</p>:inspections.map(r=><article key={r.id} style={{borderTop:"1px solid #e6eaf0",padding:"14px 0"}}><b>INSP-{r.inspection_number} · {r.inspection_type}</b><p>{r.findings}</p><small>{r.inspection_date} · {r.location} · Inspector: {r.inspector_name} · Status: {r.status}</small>{r.non_conformances&&<p><b>Non-conformances:</b> {r.non_conformances}</p>}{r.corrective_actions&&<p><b>Corrective actions:</b> {r.corrective_actions}</p>}{r.responsible_person&&<p><b>Responsible:</b> {r.responsible_person} · Due: {r.due_date||"Not set"}</p>}{canManage&&r.status!=="closed"&&<button style={buttonStyle} disabled={busy} onClick={()=>updateInspection(r,"closed")}>Verify and close</button>}</article>)}</section>
      </>}
      {tab==="documents" && <>
        <section style={cardStyle}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Controlled document register</h2><button type="button" style={buttonStyle} onClick={()=>window.print()}>Print document register</button></div><p>Upload the actual controlled document (PDF or Office file). Files are stored privately and can only be opened by signed-in EMS users.</p>{canManage?<form onSubmit={submitDocument} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
          <label style={labelStyle}>Document number<input required style={inputStyle} value={document.document_number} onChange={e=>setDocument({...document,document_number:e.target.value})}/></label>
          <label style={labelStyle}>Title<input required style={inputStyle} value={document.title} onChange={e=>setDocument({...document,title:e.target.value})}/></label>
          <label style={labelStyle}>Document type<input required style={inputStyle} value={document.document_type} onChange={e=>setDocument({...document,document_type:e.target.value})}/></label>
          <label style={labelStyle}>Effective date<input type="date" style={inputStyle} value={document.effective_date} onChange={e=>setDocument({...document,effective_date:e.target.value})}/></label>
          <label style={labelStyle}>Review date<input type="date" style={inputStyle} value={document.review_date} onChange={e=>setDocument({...document,review_date:e.target.value})}/></label>
          <label style={{...labelStyle,gridColumn:"1/-1"}}>Upload actual document<input id="controlled-document-file" required type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" style={{...inputStyle,padding:8}} onChange={e=>setDocumentFile(e.target.files?.[0] || null)}/><small style={{fontWeight:400,color:"#667085"}}>PDF, Word, Excel, PowerPoint or image · Maximum 25 MB</small></label>
          {documentFile && <p style={{gridColumn:"1/-1",margin:0,fontSize:13,color:"#344054"}}>Selected: {documentFile.name} ({(documentFile.size/1024/1024).toFixed(2)} MB)</p>}
          <div><button disabled={busy} style={buttonStyle}>{busy?"Uploading…":"Upload and save document"}</button></div>
        </form>:<p>Only administrators and management can maintain controlled documents.</p>}</section>
        <section style={cardStyle}><h2 style={{marginTop:0}}>Document register</h2>{documents.length===0?<p>No controlled documents have been registered.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr>{["Document no.","Title","Type","Effective","Review","Status","File"].map(x=><th key={x} style={{padding:10,borderBottom:"1px solid #dce2e8"}}>{x}</th>)}</tr></thead><tbody>{documents.map(d=><tr key={d.id}><td style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{d.document_number}</td><td style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{d.title}</td><td style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{d.document_type}</td><td style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{d.effective_date||"—"}</td><td style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{d.review_date||"—"}</td><td style={{padding:10,borderBottom:"1px solid #edf0f3"}}>{d.status}</td><td style={{padding:10,borderBottom:"1px solid #edf0f3"}}><button type="button" style={{...buttonStyle,padding:"7px 11px"}} onClick={()=>openDocument(d)}>{d.storage_path?"Open uploaded file":"Open source link"}</button></td></tr>)}</tbody></table></div>}</section>
      </>}
      <footer style={{color:"#667085",fontSize:12,padding:"12px 2px"}}>CROCODILE RIVER MINE · EMS · AUTHORISED ACCESS ONLY · All changes are subject to database role permissions.</footer>
    </div>
  </main>;
}
