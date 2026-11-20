"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Profile = { full_name: string; email: string; role: string; is_active: boolean };
type Magazine = { magazine_name: string; responsible_user_id: string | null; is_active: boolean };
type EMSProfile = { user_id: string; full_name: string; email: string; role: string; is_active: boolean };
type Transaction = { id: string; transaction_number: number; transaction_type: string; status: string; quantity: number; transaction_date: string; reference_number: string | null };
type Product = { id: string; product_code: string; product_name: string; unit_of_measure: string; minimum_stock: number; is_active: boolean };

export default function Home() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key) : null;
  }, []);
  const [email, setEmail] = useState("mradzilani@eastplats.co.za");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [section, setSection] = useState("overview");
  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [magazineName, setMagazineName] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [profiles, setProfiles] = useState<EMSProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  async function loadProfile(currentUser: User) {
    if (!supabase) return;
    const { data, error: profileError } = await supabase.from("ems_profiles")
      .select("full_name,email,role,is_active").eq("user_id", currentUser.id).maybeSingle();
    if (profileError) { setError("Your account is signed in, but the EMS profile could not be loaded. Contact the administrator."); return; }
    if (!data || !data.is_active) {
      await supabase.auth.signOut(); setUser(null); setProfile(null);
      setError("This account does not have an active Crocodile River Mine EMS profile."); return;
    }
    setProfile(data as Profile);
  }

  async function loadDashboard() {
    if (!supabase) return;
    setDataLoading(true); setError("");
    const [mag, people, productRows, txRows] = await Promise.all([
      supabase.from("ems_magazine").select("magazine_name,responsible_user_id,is_active").eq("singleton", true).maybeSingle(),
      supabase.from("ems_profiles").select("user_id,full_name,email,role,is_active").order("full_name"),
      supabase.from("ems_explosive_products").select("id,product_code,product_name,unit_of_measure,minimum_stock,is_active").order("product_name"),
      supabase.from("ems_stock_transactions").select("id,transaction_number,transaction_type,status,quantity,transaction_date,reference_number").order("transaction_date", { ascending: false }).limit(8)
    ]);
    if (mag.error) setError("Could not load magazine details. Check the database permissions.");
    else if (mag.data) { setMagazine(mag.data as Magazine); setMagazineName(mag.data.magazine_name); setResponsibleUserId(mag.data.responsible_user_id || ""); }
    if (people.data) setProfiles(people.data as EMSProfile[]);
    if (productRows.data) setProducts(productRows.data as Product[]);
    if (txRows.data) setTransactions(txRows.data as Transaction[]);
    setDataLoading(false);
  }

  useEffect(() => {
    setResetMode(new URLSearchParams(window.location.search).get("mode") === "reset");
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) { setUser(data.session.user); await loadProfile(data.session.user); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => { if (user && profile?.role) loadDashboard(); }, [user, profile?.role]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return setError("The website authentication settings are not configured yet.");
    setBusy(true); setError(""); setNotice("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(authError.message);
    else if (data.user) await loadProfile(data.user);
    setBusy(false);
  }
  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return setError("The website authentication settings are not configured yet.");
    setBusy(true); setError(""); setNotice("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/?mode=reset" });
    if (resetError) setError(resetError.message);
    else { setResetRequested(true); setNotice("If this email belongs to an EMS account, a password reset link will be sent. Check your inbox and spam folder."); }
    setBusy(false);
  }
  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 10) return setError("Use at least 10 characters for your new password.");
    setBusy(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) setError(updateError.message);
    else { setResetMode(false); window.history.replaceState({}, "", "/"); setNotice("Your password has been updated. Please sign in with your new password."); await supabase.auth.signOut(); setUser(null); setProfile(null); }
    setBusy(false);
  }
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut(); setUser(null); setProfile(null); setPassword(""); setNotice("You have been signed out.");
  }
  async function saveMagazine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || profile?.role !== "admin" || !magazine) return;
    setBusy(true); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("ems_magazine").update({
      magazine_name: magazineName.trim(), responsible_user_id: responsibleUserId || null
    }).eq("singleton", true);
    if (saveError) setError("Magazine details could not be saved: " + saveError.message);
    else { setNotice("Magazine configuration saved."); await loadDashboard(); }
    setBusy(false);
  }

  const activePeople = profiles.filter(p => p.is_active);
  const activeProducts = products.filter(p => p.is_active);
  const pending = transactions.filter(t => t.status === "pending_approval").length;
  const canManageMagazine = profile?.role === "admin";
  const roleName = (profile?.role || "").replaceAll("_", " ");

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="side-brand"><div className="mark">CRM</div><div><strong>CROCODILE RIVER MINE</strong><span>EXPLOSIVES MANAGEMENT</span></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <button className={section === "overview" ? "nav-item active" : "nav-item"} onClick={() => setSection("overview")}>▦ <span>Dashboard</span></button>
        <button className={section === "magazine" ? "nav-item active" : "nav-item"} onClick={() => setSection("magazine")}>▣ <span>Magazine management</span></button>
        <button className={section === "people" ? "nav-item active" : "nav-item"} onClick={() => setSection("people")}>♙ <span>User profiles</span></button>
        <button className={section === "products" ? "nav-item active" : "nav-item"} onClick={() => setSection("products")}>▤ <span>Product register</span></button>
        <button className={section === "transactions" ? "nav-item active" : "nav-item"} onClick={() => setSection("transactions")}>⇄ <span>Stock records</span></button>
        <div className="side-bottom"><div className="user-chip"><span className="avatar">{(profile?.full_name || "A").slice(0,1).toUpperCase()}</span><div><strong>{profile?.full_name || user.email}</strong><small>{roleName}</small></div></div><button className="signout" onClick={signOut}>Sign out ↗</button></div>
      </aside>
      <section className="main-area">
        <header className="app-top"><div><span className="crumb">CROCODILE RIVER MINE / EMS</span><h1>{section === "overview" ? "Dashboard" : section === "magazine" ? "Magazine management" : section === "people" ? "User profiles" : section === "products" ? "Product register" : "Stock records"}</h1></div><div className="top-right"><span className="status-dot"></span> System online <button onClick={loadDashboard} className="refresh-btn">↻ Refresh</button></div></header>
        <div className="content">
          {notice && <div className="notice success-notice">{notice}</div>}
          {error && <div className="notice error-notice">{error}</div>}
          {dataLoading && <div className="loading-line">Updating EMS records…</div>}
          {section === "overview" && <>
            <div className="welcome-row"><div><h2>Welcome back, {profile?.full_name?.split(" ")[0] || "Admin"}</h2><p>Here is the current overview of your explosives management records.</p></div><span className="role-pill">{roleName}</span></div>
            <div className="stats-grid">
              <article className="stat-card"><span>ACTIVE MAGAZINE</span><strong className="stat-text">{magazine?.is_active ? "Operational record" : "Inactive"}</strong><small>{magazine?.magazine_name || "Magazine not configured"}</small></article>
              <article className="stat-card"><span>REGISTERED PRODUCTS</span><strong>{activeProducts.length}</strong><small>Active product records</small></article>
              <article className="stat-card"><span>ACTIVE USERS</span><strong>{activePeople.length}</strong><small>Authorised EMS profiles</small></article>
              <article className="stat-card"><span>AWAITING APPROVAL</span><strong>{pending}</strong><small>Transactions pending review</small></article>
            </div>
            <div className="content-grid">
              <section className="data-card"><div className="card-heading"><div><h3>Recent stock records</h3><p>Latest recorded movements and their current status.</p></div><button className="text-action" onClick={() => setSection("transactions")}>View records →</button></div>
                {transactions.length ? <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>TYPE</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>EMS-{t.transaction_number}</td><td className="capitalize">{t.transaction_type}</td><td>{new Date(t.transaction_date).toLocaleDateString("en-ZA")}</td><td><span className={"state "+t.status}>{t.status.replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">No stock transactions have been recorded yet.</div>}
              </section>
              <section className="data-card quick-card"><div className="card-heading"><div><h3>System shortcuts</h3><p>Manage core EMS setup.</p></div></div><button onClick={() => setSection("magazine")} className="shortcut">▣ <span><b>Magazine configuration</b><small>View the main magazine and responsible person</small></span> →</button><button onClick={() => setSection("people")} className="shortcut">♙ <span><b>User profiles</b><small>Review assigned roles and account status</small></span> →</button><button onClick={() => setSection("products")} className="shortcut">▤ <span><b>Product register</b><small>View registered product records</small></span> →</button></section>
            </div>
          </>}
          {section === "magazine" && <section className="data-card wide-card"><div className="card-heading"><div><h3>Main magazine configuration</h3><p>Maintain the system record and assign the responsible Magazine Master.</p></div><span className="state approved"> {magazine?.is_active ? "Active" : "Inactive"} </span></div>
            {magazine ? <form className="config-form" onSubmit={saveMagazine}><label>Magazine name<input value={magazineName} onChange={e=>setMagazineName(e.target.value)} disabled={!canManageMagazine}/></label><label>Responsible person<select value={responsibleUserId} onChange={e=>setResponsibleUserId(e.target.value)} disabled={!canManageMagazine}><option value="">Not assigned</option>{activePeople.filter(p=>p.role === "magazine_master" || p.role === "admin").map(p=><option key={p.user_id} value={p.user_id}>{p.full_name} — {p.role.replaceAll("_"," ")}</option>)}</select></label><div className="info-note">Only an administrator can change the magazine configuration. The assigned person must have an active EMS profile with the appropriate role.</div>{canManageMagazine && <button className="primary-btn" disabled={busy || !magazineName.trim()}>{busy ? "Saving…" : "Save magazine details"}</button>}{!canManageMagazine && <p className="muted">Your role can view this configuration but cannot edit it.</p>}</form> : <div className="empty-state">The main magazine record was not found. Ask the system administrator to verify the database setup.</div>}
          </section>}
          {section === "people" && <section className="data-card wide-card"><div className="card-heading"><div><h3>EMS user profiles</h3><p>Account access and assigned responsibilities.</p></div><span className="role-pill">{activePeople.length} active</span></div><div className="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th></tr></thead><tbody>{profiles.map(p=><tr key={p.user_id}><td><b>{p.full_name}</b></td><td>{p.email}</td><td className="capitalize">{p.role.replaceAll("_"," ")}</td><td><span className={"state "+(p.is_active ? "approved" : "rejected")}>{p.is_active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table></div><p className="table-footnote">User creation and role changes are reserved for the next user-management release.</p></section>}
          {section === "products" && <section className="data-card wide-card"><div className="card-heading"><div><h3>Explosive product register</h3><p>Configured product records and their minimum-stock reference values.</p></div><span className="role-pill">{activeProducts.length} active</span></div>{products.length ? <div className="table-wrap"><table><thead><tr><th>PRODUCT CODE</th><th>PRODUCT NAME</th><th>UNIT</th><th>MINIMUM STOCK</th><th>STATUS</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.product_code}</td><td><b>{p.product_name}</b></td><td>{p.unit_of_measure}</td><td>{p.minimum_stock}</td><td><span className={"state "+(p.is_active ? "approved" : "rejected")}>{p.is_active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">No product records have been added. Product setup can be completed after the mine-approved product register is supplied.</div>}</section>}
          {section === "transactions" && <section className="data-card wide-card"><div className="card-heading"><div><h3>Stock transaction records</h3><p>Recorded receipts, issues, returns and adjustments. This view is read-only.</p></div><span className="role-pill">Latest 8 records</span></div>{transactions.length ? <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>TYPE</th><th>DATE</th><th>QUANTITY</th><th>STATUS</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>EMS-{t.transaction_number}</td><td className="capitalize">{t.transaction_type}</td><td>{new Date(t.transaction_date).toLocaleString("en-ZA")}</td><td>{t.quantity}</td><td><span className={"state "+t.status}>{t.status.replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">No stock transaction records are available yet.</div>}</section>}
          <footer className="app-footer">CROCODILE RIVER MINE · EXPLOSIVES MANAGEMENT SYSTEM · AUTHORISED ACCESS ONLY</footer>
        </div>
      </section>
    </main>
  );
}
