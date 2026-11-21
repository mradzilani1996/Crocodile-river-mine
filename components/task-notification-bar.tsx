"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Task = { key:string; label:string; count:number; href:string };
type Profile = { role:string; is_active:boolean };

export default function TaskNotificationBar(){
  const db=useMemo(()=>{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;return url&&key?createClient(url,key):null;},[]);
  const [user,setUser]=useState<User|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [expanded,setExpanded]=useState(false);
  const [lastChecked,setLastChecked]=useState<Date|null>(null);

  const refresh=useCallback(async()=>{
    if(!db||!user)return;
    const {data:profile}=await db.from("ems_profiles").select("role,is_active").eq("user_id",user.id).maybeSingle() as {data:Profile|null};
    if(!profile?.is_active){setTasks([]);return;}
    const role=profile.role||"";
    const admin=role==="admin", shift=role==="authorising_officer", manager=role==="management";
    const jobs:PromiseLike<any>[]=[];
    const add=(key:string,label:string,href:string,p:PromiseLike<any>)=>jobs.push(p.then(r=>({key,label,href,count:r.count??(r.data?.length||0),error:r.error})));
    if(admin||shift)add("stock-shift","Stock movements awaiting Shiftboss approval","/approvals",db.from("ems_stock_transactions").select("id",{count:"exact",head:true}).eq("status","pending_approval"));
    if(admin||manager)add("stock-manager","Stock movements awaiting Management approval","/approvals",db.from("ems_stock_transactions").select("id",{count:"exact",head:true}).eq("status","shiftboss_approved"));
    if(admin||shift)add("daily","Daily explosive requests","/approvals",db.from("ems_daily_orders").select("id",{count:"exact",head:true}).eq("status","submitted"));
    if(admin||shift||manager)add("products","New products awaiting approval","/approvals",db.from("ems_explosive_products").select("id",{count:"exact",head:true}).eq("approval_status","pending_approval"));
    if(admin||shift)add("supplier-shift","Supplier orders awaiting Shiftboss","/approvals",db.from("ems_purchase_orders").select("id",{count:"exact",head:true}).eq("status","pending_shift_boss"));
    if(admin||manager)add("supplier-manager","Supplier orders awaiting Management","/approvals",db.from("ems_purchase_orders").select("id",{count:"exact",head:true}).eq("status","pending_mine_overseer"));
    if(admin||manager)add("stocktakes","Stock counts awaiting verification","/approvals",db.from("ems_stocktakes").select("id",{count:"exact",head:true}).eq("status","pending_verification"));
    if(admin||manager)add("incidents","Incidents requiring review","/approvals",db.from("ems_incidents").select("id",{count:"exact",head:true}).neq("status","closed"));
    if(admin||manager)add("inspections","Inspections requiring verification","/approvals",db.from("ems_inspections").select("id",{count:"exact",head:true}).neq("status","closed"));
    if(["admin","magazine_master"].includes(role))add("corrections","Rejected stock counts returned to you","/operations",db.from("ems_stocktakes").select("id",{count:"exact",head:true}).eq("status","rejected").eq("counted_by",user.id));
    const results=await Promise.all(jobs);
    setTasks(results.filter(r=>!r.error&&r.count>0).map(({key,label,href,count})=>({key,label,href,count})));
    setLastChecked(new Date());
  },[db,user]);

  useEffect(()=>{
    if(!db)return;
    db.auth.getSession().then(({data})=>setUser(data.session?.user||null));
    const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
    return()=>subscription.unsubscribe();
  },[db]);

  useEffect(()=>{
    if(!db||!user)return;
    refresh();
    const timer=window.setInterval(refresh,30000);
    const channel=db.channel("ems-task-notifications")
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_stock_transactions"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_daily_orders"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_explosive_products"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_purchase_orders"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_stocktakes"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_incidents"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_inspections"},refresh)
      .subscribe();
    return()=>{window.clearInterval(timer);db.removeChannel(channel);};
  },[db,user,refresh]);

  const total=tasks.reduce((sum,t)=>sum+t.count,0);
  if(!user||!tasks.length)return null;
  return <aside role="status" aria-live="polite" style={{position:"sticky",top:0,zIndex:40,background:"#fff8e7",borderBottom:"1px solid #f0d48a",color:"#382b12",padding:"10px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
    <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} style={{display:"flex",alignItems:"center",gap:10,border:0,background:"transparent",color:"inherit",fontSize:15,fontWeight:800,cursor:"pointer",padding:4}}>
        <span aria-hidden="true" style={{fontSize:21}}>🔔</span>
        <span>You have {total} task{total===1?"":"s"} to do</span>
        <span style={{background:"#b42318",color:"#fff",borderRadius:20,minWidth:25,textAlign:"center",padding:"2px 8px"}}>{total}</span>
        <span style={{fontSize:12}}>{expanded?"▲":"▼"}</span>
      </button>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <a href="/approvals" style={{color:"#174a70",fontWeight:800,textDecoration:"underline"}}>Open tasks</a>
        <button type="button" onClick={()=>refresh()} style={{border:"1px solid #c9ad70",borderRadius:7,padding:"7px 11px",background:"#fff",fontWeight:700,cursor:"pointer"}}>Refresh</button>
      </div>
    </div>
    {expanded&&<div style={{maxWidth:1400,margin:"9px auto 2px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8}}>
      {tasks.map(t=><a key={t.key} href={t.href} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",background:"#fff",border:"1px solid #ead9b4",borderRadius:8,padding:"10px 12px",color:"#253342",textDecoration:"none"}}>
        <span>{t.label}</span><b style={{color:"#a12a20",fontSize:18}}>{t.count}</b>
      </a>)}
    </div>}
    {lastChecked&&<div style={{maxWidth:1400,margin:"4px auto 0",fontSize:11,color:"#796b4f"}}>Automatically checks for new tasks every 30 seconds · Last checked {lastChecked.toLocaleTimeString("en-ZA")}</div>}
  </aside>;
}
