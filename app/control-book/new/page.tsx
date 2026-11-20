"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
import { createClient,User } from "@supabase/supabase-js";

type Profile={full_name:string;role:string;is_active:boolean};
type Product={id:string;product_code:string;product_name:string;unit_of_measure:string;is_active:boolean};
const field:React.CSSProperties={display:"grid",gap:6,fontSize:13,fontWeight:650,color:"#344054"};
const control:React.CSSProperties={width:"100%",padding:"11px 12px",border:"1px solid #d5dce5",borderRadius:8,color:"#17212b",background:"white"};
const panel:React.CSSProperties={background:"white",border:"1px solid #e3e8ef",borderRadius:14,padding:22,marginBottom:18};
export default function NewControlBookEntry(){
 const db=useMemo(()=>process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY):null,[]);
 const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile|null>(null),[products,setProducts]=useState<Product[]>([]);
 const [type,setType]=useState("receipt"),[section,setSection]=useState("Boxes"),[product,setProduct]=useState("");
 const [openingUnits,setOpeningUnits]=useState(0),[openingPackages,setOpeningPackages]=useState(0),[balanceLoading,setBalanceLoading]=useState(false);
 const [date,setDate]=useState(new Date().toISOString().slice(0,16)),[reference,setReference]=useState(""),[container,setContainer]=useState(""),[itemType,setItemType]=useState(""),[description,setDescription]=useState("");
 const [packages,setPackages]=useState(""),[units,setUnits]=useState(""),[work,setWork]=useState(""),[companyNo,setCompanyNo]=useState(""),[miner,setMiner]=useState(""),[ack,setAck]=useState(false),[purpose,setPurpose]=useState(""),[notes,setNotes]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 useEffect(()=>{if(!db)return;db.auth.getSession().then(async({data})=>{const u=data.session?.user;if(!u)return;setUser(u);const [p,pr]=await Promise.all([db.from("ems_profiles").select("full_name,role,is_active").eq("user_id",u.id).maybeSingle(),db.from("ems_explosive_products").select("id,product_code,product_name,unit_of_measure,is_active").eq("is_active",true).order("product_name")]);if(p.data?.is_active)setProfile(p.data);else setError("Your EMS profile is inactive or unavailable.");if(pr.error)setError(pr.error.message);else{setProducts(pr.data||[]);if(pr.data?.length)setProduct(pr.data[0].id);}});},[db]);
 useEffect(()=>{let cancelled=false;async function loadOpening(){if(!db||!product){setOpeningUnits(0);setOpeningPackages(0);return;}setBalanceLoading(true);const {data,error}=await db.from("ems_stock_transactions").select("quantity,transaction_type,adjustment_direction,package_quantity").eq("product_id",product).eq("status","posted");if(!cancelled){if(!error){let units=0,packages=0;for(const row of data||[]){const sign=row.transaction_type==="receipt"||row.transaction_type==="return"?1:row.transaction_type==="issue"?-1:row.adjustment_direction==="increase"?1:-1;units+=sign*Number(row.quantity||0);packages+=sign*Number(row.package_quantity||0);}setOpeningUnits(units);setOpeningPackages(packages);}setBalanceLoading(false);}}loadOpening();return()=>{cancelled=true;};},[db,product]);
 const role=profile?.role||"";
 const permitted=type==="issue"?["admin","issuer"].includes(role):["admin","magazine_master"].includes(role);
 async function submit(e:FormEvent){e.preventDefault();if(!db||!user||!profile)return;setBusy(true);setError("");setMessage("");
 const qty=Number(units);const pack=Number(packages||0);
 if(!product||!Number.isFinite(qty)||qty<=0||!Number.isFinite(pack)||pack<0){setError("Select a product and enter a valid positive unit quantity.");setBusy(false);return;}
 if(type==="issue"&&(!work.trim()||!companyNo.trim()||!miner.trim()||!ack)){setError("Issues require work section, miner company number, miner name and digital acknowledgement.");setBusy(false);return;}
 const payload={transaction_type:type,product_id:product,quantity:qty,transaction_date:new Date(date).toISOString(),reference_number:reference||null,source_or_destination:work||null,issued_to:miner||null,purpose:purpose||null,notes:notes||null,created_by:user.id,control_book_section:section,container_number:container||null,item_type:itemType||null,item_description:description||null,package_quantity:pack,unit_quantity:qty,work_section:work||null,miner_company_number:companyNo||null,miner_name:miner||null,miner_acknowledged:ack,status:"pending_approval"};
 const {error:err}=await db.from("ems_stock_transactions").insert(payload);
 if(err)setError(err.message);else{setMessage(type==="issue"?"Issue request submitted for authorisation. It will not change stock until approved and posted.":"Movement submitted for independent approval. It will not change stock until approved and posted.");setReference("");setContainer("");setItemType("");setDescription("");setPackages("");setUnits("");setWork("");setCompanyNo("");setMiner("");setAck(false);setPurpose("");setNotes("");}
 setBusy(false);
 }
 if(!db)return <main style={{padding:30}}>EMS database configuration is missing.</main>;
 if(!user||!profile)return <main style={{padding:30,maxWidth:680,margin:"auto"}}><h1>Explosives Control Book entry</h1><p>Sign in through the EMS dashboard first.</p><a href="/">Return to EMS login</a>{error&&<p>{error}</p>}</main>;
 return <main style={{minHeight:"100vh",background:"#f4f6f8",padding:24,color:"#17212b"}}><div style={{maxWidth:1050,margin:"auto"}}>
 <a href="/" style={{color:"#315a75",fontWeight:700,textDecoration:"none"}}>← EMS Dashboard</a><h1 style={{fontSize:30,marginBottom:5}}>Explosives Control Book</h1><p style={{color:"#667085",marginTop:0}}>Crocodile River Mine · Boxes, Bags and Tamping · Signed in as {profile.full_name}</p>
 {error&&<p role="alert" style={{background:"#fff0f0",color:"#9b2424",padding:12,borderRadius:8}}>{error}</p>}{message&&<p style={{background:"#eaf6ef",color:"#17633a",padding:12,borderRadius:8}}>{message}</p>}
 <form onSubmit={submit}>
 <section style={panel}><h2>Register details</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14}}>
 <label style={field}>Movement type<select style={control} value={type} onChange={e=>setType(e.target.value)}><option value="receipt">Receipt</option><option value="issue">Issue request</option><option value="return">Return</option></select></label>
 <label style={field}>Control-book section<select style={control} value={section} onChange={e=>setSection(e.target.value)}>{["Boxes","Bags","Tamping"].map(x=><option key={x}>{x}</option>)}</select></label>
 <label style={field}>Product<select required style={control} value={product} onChange={e=>setProduct(e.target.value)}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.product_name} ({p.product_code})</option>)}</select></label>
 <label style={field}>Date and time<input required type="datetime-local" style={control} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label style={field}>Box / bag / container number<input style={control} value={container} onChange={e=>setContainer(e.target.value)}/></label>
 <label style={field}>Item type<input style={control} value={itemType} onChange={e=>setItemType(e.target.value)} placeholder="As specified in controlled document"/></label>
 <label style={field}>Package quantity<input type="number" min="0" step="0.001" style={control} value={packages} onChange={e=>setPackages(e.target.value)}/></label>
 <label style={field}>Unit quantity<input required type="number" min="0.001" step="0.001" style={control} value={units} onChange={e=>setUnits(e.target.value)}/></label>
 <label style={field}>Reference number<input style={control} value={reference} onChange={e=>setReference(e.target.value)}/></label>
 <div style={{gridColumn:"1 / -1",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,background:"#f4f7fa",padding:14,borderRadius:10}}>
 <div><small style={{color:"#667085",fontWeight:700}}>OPENING BALANCE · {balanceLoading?"Loading…":"POSTED STOCK"}</small><div style={{fontSize:18,fontWeight:800,marginTop:5}}>{openingPackages.toLocaleString("en-ZA")} boxes/bags · {openingUnits.toLocaleString("en-ZA")} units</div></div>
 <div><small style={{color:"#667085",fontWeight:700}}>PROJECTED CLOSING BALANCE</small><div style={{fontSize:18,fontWeight:800,marginTop:5}}>{(openingPackages+(type==="issue"?-1:1)*Number(packages||0)).toLocaleString("en-ZA")} boxes/bags · {(openingUnits+(type==="issue"?-1:1)*Number(units||0)).toLocaleString("en-ZA")} units</div><small style={{color:"#667085"}}>Final balance updates only after authorised posting.</small></div>
 </div>
 </div><label style={{...field,marginTop:14}}>Item description<textarea rows={2} style={control} value={description} onChange={e=>setDescription(e.target.value)}/></label></section>
 <section style={panel}><h2>Section, miner details and acknowledgement</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14}}>
 <label style={field}>Work section / destination<input style={control} value={work} onChange={e=>setWork(e.target.value)}/></label>
 <label style={field}>Miner company number<input style={control} value={companyNo} onChange={e=>setCompanyNo(e.target.value)}/></label>
 <label style={field}>Miner name<input style={control} value={miner} onChange={e=>setMiner(e.target.value)}/></label>
 </div><label style={{display:"flex",gap:10,alignItems:"center",marginTop:16,fontSize:14}}><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> Miner’s name and signature / digital acknowledgement captured</label>
 <label style={{...field,marginTop:14}}>Purpose<textarea rows={2} style={control} value={purpose} onChange={e=>setPurpose(e.target.value)}/></label><label style={{...field,marginTop:14}}>Notes<textarea rows={2} style={control} value={notes} onChange={e=>setNotes(e.target.value)}/></label></section>
 {!permitted&&<p style={{color:"#9b2424"}}>Your role ({role.replaceAll("_"," ")}) cannot create this movement type. Receipts require Magazine Master or Admin; issue requests require Issuer or Admin.</p>}
 <button disabled={busy||!permitted||!products.length} style={{background:"#173b57",color:"white",border:0,borderRadius:8,padding:"12px 18px",fontWeight:750,cursor:"pointer"}}>{busy?"Saving…":type==="issue"?"Submit issue for authorisation":"Submit movement for approval"}</button> <a href="/" style={{marginLeft:14,color:"#315a75"}}>Cancel</a>
 <p style={{fontSize:12,color:"#667085",marginTop:14}}>Entries are not posted automatically. Existing EMS approval and posting controls remain mandatory before a movement changes the stock balance. Follow the mine's approved procedures and authorised sign-off requirements.</p>
 </form></div></main>;
}
