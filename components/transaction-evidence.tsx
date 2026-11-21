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
 return <div style={box}>
  <b>Supporting documents</b>
  <p style={{margin:"4px 0 9px",fontSize:13,color:"#536273"}}>Attach delivery notes and other evidence. Files are stored in a private EMS bucket and opened using time-limited links.</p>
  <label style={{display:"inline-flex",gap:8,alignItems:"center",flexWrap:"wrap",fontSize:14}}>
   <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value="";}}/>
  </label>
  {files.length>0&&<ul style={{margin:"8px 0",paddingLeft:20}}>{files.map(f=><li key={f.id} style={{fontSize:13,margin:"4px 0"}}><button type="button" onClick={()=>void openFile(f.storage_path)} style={{border:0,background:"none",color:"#145b87",textDecoration:"underline",cursor:"pointer",padding:0}}>{f.file_name}</button> · {(f.file_size/1024/1024).toFixed(2)} MB · {f.uploaded_by_name}</li>)}</ul>}
  {message&&<p role="status" style={{fontSize:12,margin:"8px 0 0",color:"#a12a2a"}}>{message}</p>}
 </div>;
}
