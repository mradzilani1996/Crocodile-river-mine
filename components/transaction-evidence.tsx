"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type Props = {
  db: SupabaseClient;
  entityType: "stock_transaction" | "purchase_order" | "daily_order" | "stocktake" | "explosive_product" | "incident" | "inspection";
  entityId: string;
  user: User;
  fullName: string;
  stage: "shift_boss" | "mine_manager" | "admin" | "management_review" | "verification";
};
type Attachment = {id:string;file_name:string;storage_path:string;mime_type:string;file_size:number;uploaded_by_name:string;created_at:string};

const box:React.CSSProperties={marginTop:12,padding:12,border:"1px solid #d9e2ea",borderRadius:10,background:"#f8fafc"};
const smallBtn:React.CSSProperties={border:0,borderRadius:7,padding:"8px 11px",background:"#173b57",color:"#fff",fontWeight:700,cursor:"pointer"};

export default function TransactionEvidence({db,entityType,entityId,user,fullName,stage}:Props){
 const [files,setFiles]=useState<Attachment[]>([]);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [comments,setComments]=useState("");
 const [decision,setDecision]=useState("approved");
 const [confirmed,setConfirmed]=useState(false);
 async function load(){
  const {data,error}=await db.from("ems_transaction_attachments").select("id,file_name,storage_path,mime_type,file_size,uploaded_by_name,created_at").eq("entity_type",entityType).eq("entity_id",entityId).order("created_at",{ascending:false});
  if(error){setMessage(error.message);return;} setFiles(data||[]);
 }
 useEffect(()=>{void load();},[entityId]);
 async function upload(file?:File){
  if(!file)return;
  setMessage("");
  const allowed=["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation"];
  if(!allowed.includes(file.type)){setMessage("Unsupported file type. Upload PDF, JPG, PNG or Office documents.");return;}
  if(file.size>25*1024*1024){setMessage("File exceeds the 25 MB limit.");return;}
  setBusy(true);
  const path=`${user.id}/${entityType}/${entityId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const up=await db.storage.from("ems-documents").upload(path,file,{contentType:file.type,upsert:false});
  if(up.error){setMessage(up.error.message);setBusy(false);return;}
  const ins=await db.from("ems_transaction_attachments").insert({entity_type:entityType,entity_id:entityId,file_name:file.name,storage_path:path,mime_type:file.type,file_size:file.size,uploaded_by:user.id,uploaded_by_name:fullName});
  if(ins.error){setMessage("File uploaded but its evidence record could not be saved: "+ins.error.message);setBusy(false);return;}
  setMessage("Supporting document attached.");await load();setBusy(false);
 }
 async function openFile(path:string){
  const {data,error}=await db.storage.from("ems-documents").createSignedUrl(path,600);
  if(error){setMessage(error.message);return;} if(data?.signedUrl)window.open(data.signedUrl,"_blank","noopener,noreferrer");
 }
 async function acknowledge(){
  if(!confirmed){setMessage("Tick the acknowledgement checkbox before recording your approval.");return;}
  setBusy(true);setMessage("");
  const {error}=await db.rpc("ems_record_approval_acknowledgement",{p_entity_type:entityType,p_entity_id:entityId,p_approval_stage:stage,p_decision:decision,p_comments:comments||null});
  setMessage(error?error.message:"Your authenticated approval acknowledgement has been recorded in the immutable audit register.");
  if(!error){setConfirmed(false);setComments("");}
  setBusy(false);
 }
 return <div style={box}>
  <b>Supporting documents & approval acknowledgement</b>
  <p style={{margin:"4px 0 9px",fontSize:13,color:"#536273"}}>Attach delivery notes and other evidence. Files are stored in a private EMS bucket and opened using time-limited links.</p>
  <label style={{display:"inline-flex",gap:8,alignItems:"center",flexWrap:"wrap",fontSize:14}}>
   <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value="";}}/>
  </label>
  {files.length>0&&<ul style={{margin:"8px 0",paddingLeft:20}}>{files.map(f=><li key={f.id} style={{fontSize:13,margin:"4px 0"}}><button type="button" onClick={()=>void openFile(f.storage_path)} style={{border:0,background:"none",color:"#145b87",textDecoration:"underline",cursor:"pointer",padding:0}}>{f.file_name}</button> · {(f.file_size/1024/1024).toFixed(2)} MB · {f.uploaded_by_name}</li>)}</ul>}
  <div style={{borderTop:"1px solid #d9e2ea",marginTop:10,paddingTop:10}}>
   <b style={{fontSize:14}}>Electronic approval acknowledgement</b>
   <p style={{fontSize:12,color:"#536273",margin:"3px 0 8px"}}>This records your authenticated account, role, decision and timestamp. It is an approval acknowledgement, not a certificate-based digital signature.</p>
   <select value={decision} onChange={e=>setDecision(e.target.value)} style={{padding:8,border:"1px solid #cbd5df",borderRadius:7,marginRight:8}}>
    <option value="approved">Approved</option><option value="rejected">Rejected</option><option value="reviewed">Reviewed</option><option value="closed">Closed</option>
   </select>
   <input value={comments} onChange={e=>setComments(e.target.value)} placeholder="Approval comments (optional)" style={{padding:8,border:"1px solid #cbd5df",borderRadius:7,maxWidth:360,width:"100%"}}/>
   <label style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:13,margin:"9px 0"}}>
    <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
    I confirm that I have reviewed this transaction and its supporting evidence, and personally acknowledge the selected decision.
   </label>
   <button type="button" style={smallBtn} disabled={busy||!confirmed} onClick={()=>void acknowledge()}>Record acknowledgement</button>
  </div>
  {message&&<p role="status" style={{fontSize:12,margin:"8px 0 0",color:message.includes("could not")||message.includes("exceeds")||message.includes("Unsupported")?"#a12a2a":"#17633a"}}>{message}</p>}
 </div>;
}
