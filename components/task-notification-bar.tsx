"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Task = { key:string; label:string; count:number; href:string };
type Profile = { role:string; is_active:boolean };
type UserNotification = { id:string; title:string; message:string; href:string; created_at:string };

export default function TaskNotificationBar(){
  const db=useMemo(()=>{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;return url&&key?createClient(url,key):null;},[]);
  const [user,setUser]=useState<User|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [notifications,setNotifications]=useState<UserNotification[]>([]);
  const [expanded,setExpanded]=useState(false);
  const [lastChecked,setLastChecked]=useState<Date|null>(null);
  const [toastNotification,setToastNotification]=useState<UserNotification|null>(null);
  const [notificationError,setNotificationError]=useState("");
  const lastToastId=useRef<string|null>(null);

  const refresh=useCallback(async()=>{
    if(!db||!user)return;
    const {data:profile}=await db.from("ems_profiles").select("role,is_active").eq("user_id",user.id).maybeSingle() as {data:Profile|null};
    if(!profile?.is_active){setTasks([]);setNotifications([]);return;}
    const {data:noticeRows,error:noticeError}=await db.from("ems_user_notifications").select("id,title,message,href,created_at").eq("recipient_user_id",user.id).is("read_at",null).order("created_at",{ascending:false}).limit(10);
    if(noticeError){setNotificationError("Notifications could not be loaded: "+noticeError.message);}else{setNotificationError("");}
    const incoming=(noticeRows||[]) as UserNotification[];
    setNotifications(incoming);
    // A toast is only valid while its notification is still unread.
    // Clear it as soon as it is read/resolved or no longer returned by Supabase.
    setToastNotification(current =>
      current && !incoming.some(n=>n.id===current.id) ? null : current
    );
    if(incoming.length>0){
      setExpanded(true);
      if(lastToastId.current!==incoming[0].id){lastToastId.current=incoming[0].id;setToastNotification(incoming[0]);}
    }else{
      lastToastId.current=null;
      setToastNotification(null);
    }
    const role=profile.role||"";
    const admin=role==="admin", shift=role==="authorising_officer", manager=role==="management";
    const jobs:PromiseLike<any>[]=[];
    const add=(key:string,label:string,href:string,p:PromiseLike<any>)=>jobs.push(p.then(r=>({key,label,href,count:r.count??(r.data?.length||0),error:r.error})));
    if(admin||shift)add("stock-shift","Stock movements awaiting Shiftboss approval","/approvals",db.from("ems_stock_transactions").select("id",{count:"exact",head:true}).eq("status","pending_approval"));
    if(admin||manager)add("stock-manager","Stock movements awaiting Management approval","/approvals",db.from("ems_stock_transactions").select("id",{count:"exact",head:true}).eq("status","shiftboss_approved"));
    if(admin||shift)add("daily","Daily explosive requests","/approvals",db.from("ems_daily_orders").select("id",{count:"exact",head:true}).eq("status","submitted"));
    if(admin||shift)add("products-shift","New products awaiting Shiftboss approval","/approvals",db.from("ems_explosive_products").select("id",{count:"exact",head:true}).eq("approval_status","pending_shift_boss"));
    if(admin||manager)add("products-management","Products awaiting Management approval","/approvals",db.from("ems_explosive_products").select("id",{count:"exact",head:true}).eq("approval_status","pending_management"));
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
    const timer=window.setInterval(refresh,15000);
    const channel=db.channel("ems-task-notifications")
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_stock_transactions"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_daily_orders"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_explosive_products"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_purchase_orders"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_user_notifications",filter:`recipient_user_id=eq.${user.id}`},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_stocktakes"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_incidents"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"ems_inspections"},refresh)
      .subscribe();
    return()=>{window.clearInterval(timer);db.removeChannel(channel);};
  },[db,user,refresh]);

  const total=tasks.reduce((sum,t)=>sum+t.count,0)+notifications.length;
  if(!user)return null;
  return <aside role="status" aria-live="polite" style={{position:"sticky",top:0,zIndex:40,background:"#fff8e7",borderBottom:"1px solid #f0d48a",color:"#382b12",padding:"10px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
    <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} style={{display:"flex",alignItems:"center",gap:10,border:0,background:"transparent",color:"inherit",fontSize:15,fontWeight:800,cursor:"pointer",padding:4}}>
        <span aria-hidden="true" style={{fontSize:21}}>🔔</span>
        <span>{total>0?`You have ${total} notification${total===1?"":"s"} / task${total===1?"":"s"}`:"No pending notifications or tasks"}</span>
        <span style={{background:"#b42318",color:"#fff",borderRadius:20,minWidth:25,textAlign:"center",padding:"2px 8px"}}>{total}</span>
        <span style={{fontSize:12}}>{expanded?"▲":"▼"}</span>
      </button>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <a href="/approvals" style={{color:"#174a70",fontWeight:800,textDecoration:"underline"}}>Open Approval Centre</a>
        <button type="button" onClick={()=>refresh()} style={{border:"1px solid #c9ad70",borderRadius:7,padding:"7px 11px",background:"#fff",fontWeight:700,cursor:"pointer"}}>Refresh</button>
      </div>
    </div>
    {notificationError&&<div role="alert" style={{maxWidth:1400,margin:"8px auto",padding:9,background:"#fff0f0",color:"#9b2424",borderRadius:7,fontSize:13}}>{notificationError}</div>}
    {expanded&&<div style={{maxWidth:1400,margin:"9px auto 2px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8}}>
      {notifications.map(n=><a key={n.id} href={n.href} onClick={()=>{void db?.from("ems_user_notifications").update({read_at:new Date().toISOString()}).eq("id",n.id).eq("recipient_user_id",user.id);}} style={{display:"block",background:"#fff",border:"1px solid #d7b56b",borderRadius:8,padding:"10px 12px",color:"#253342",textDecoration:"none",gridColumn:"1 / -1"}}><strong>{n.title}</strong><div style={{marginTop:4}}>{n.message}</div><small style={{color:"#796b4f"}}>Open Approval Centre · {new Date(n.created_at).toLocaleString("en-ZA")}</small></a>)}
      {tasks.map(t=><a key={t.key} href={t.href} style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",background:"#fff",border:"1px solid #ead9b4",borderRadius:8,padding:"10px 12px",color:"#253342",textDecoration:"none"}}>
        <span>{t.label}</span><b style={{color:"#a12a20",fontSize:18}}>{t.count}</b>
      </a>)}
    </div>}
    {toastNotification&&<div role="alert" aria-live="assertive" style={{position:"fixed",right:20,bottom:20,zIndex:1000,width:"min(420px,calc(100vw - 32px))",background:"#fff",border:"2px solid #d59b25",borderLeft:"7px solid #b42318",borderRadius:12,padding:16,boxShadow:"0 12px 36px rgba(0,0,0,.24)",color:"#253342"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><strong style={{fontSize:16}}>🔔 {toastNotification.title}</strong><button type="button" onClick={()=>setToastNotification(null)} aria-label="Close notification" style={{border:0,background:"transparent",fontSize:22,cursor:"pointer"}}>×</button></div>
      <p style={{margin:"8px 0 12px"}}>{toastNotification.message}</p><a href={toastNotification.href} style={{display:"inline-block",background:"#173b57",color:"#fff",padding:"9px 13px",borderRadius:7,textDecoration:"none",fontWeight:800}}>Review now</a>
    </div>}
    {lastChecked&&<div style={{maxWidth:1400,margin:"4px auto 0",fontSize:11,color:"#796b4f"}}>Automatically checks for new tasks every 15 seconds · Last checked {lastChecked.toLocaleTimeString("en-ZA")}</div>}
  </aside>;
}
