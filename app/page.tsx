"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Profile = {
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
};

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

  async function loadProfile(currentUser: User) {
    if (!supabase) return;
    const { data, error: profileError } = await supabase
      .from("ems_profiles")
      .select("full_name,email,role,is_active")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (profileError) {
      setError("You are signed in, but your EMS profile could not be loaded. Please contact the system administrator.");
      return;
    }
    if (!data || !data.is_active) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setError("This account does not have an active Crocodile River Mine EMS profile. Contact the system administrator.");
      return;
    }
    setProfile(data as Profile);
  }

  useEffect(() => {
    setResetMode(new URLSearchParams(window.location.search).get("mode") === "reset");
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user);
        await loadProfile(data.session.user);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/?mode=reset",
    });
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
    else { setResetMode(false); window.history.replaceState({}, "", "/"); setNotice("Your password has been updated. You can now continue into the system."); }
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setPassword(""); setNotice("You have been signed out.");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="mark">CRM</div><div><strong>CROCODILE RIVER MINE</strong><span>EXPLOSIVES MANAGEMENT SYSTEM</span></div></div>
        <span className="secure">CONTROLLED ACCESS</span>
      </header>
      <section className="hero">
        <div className="eyebrow">CENTRALISED MAGAZINE CONTROL</div>
        <h1>Explosives Management<br/><em>System</em></h1>
        <p className="intro">One central magazine. Controlled stock movements. Clear accountability and traceable approvals.</p>
        <div className="panel">
          {!user ? (
            <>
              <div className="panel-title">{resetMode ? "SET A NEW PASSWORD" : resetRequested ? "PASSWORD RESET" : "SIGN IN"}</div>
              <p className="muted">{resetMode ? "Choose a new secure password for your EMS account." : resetRequested ? "Follow the secure link sent to your email address." : "Sign in using your authorised Crocodile River Mine EMS account."}</p>
              {resetMode ? (
                <form onSubmit={saveNewPassword}>
                  <label>New password</label><input type="password" autoComplete="new-password" minLength={10} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 10 characters"/>
                  <button disabled={busy}>{busy ? "Updating..." : "Update password"}</button>
                </form>
              ) : resetRequested ? (
                <button type="button" onClick={()=>{setResetRequested(false);setNotice("");}}>Return to sign in</button>
              ) : (
                <>
                  <form onSubmit={signIn}>
                    <label>Email address</label><input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.co.za"/>
                    <label>Password</label><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/>
                    <button disabled={busy}>{busy ? "Signing in..." : "Sign in securely"}</button>
                  </form>
                  <button className="link-button" type="button" onClick={()=>{setResetRequested(false);setNotice("");setError("");const form=document.getElementById("reset-email-form");form?.classList.toggle("show");}}>Forgot your password?</button>
                  <form id="reset-email-form" className="reset-form" onSubmit={requestReset}>
                    <label>Confirm your account email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
                    <button disabled={busy}>{busy ? "Sending..." : "Send password reset link"}</button>
                  </form>
                </>
              )}
              {error && <p className="feedback error">{error}</p>}
              {notice && <p className="feedback success">{notice}</p>}
              <small>Access is restricted to authorised personnel. All access is subject to account permissions.</small>
            </>
          ) : (
            <>
              <div className="panel-title">WELCOME TO THE EMS</div>
              <p className="muted">You are signed in with an active system profile.</p>
              <div className="profile"><span>ACCOUNT HOLDER</span><strong>{profile?.full_name || user.email}</strong><span>EMAIL</span><strong>{profile?.email || user.email}</strong><span>ACCESS ROLE</span><strong className="role">{profile?.role?.replaceAll("_"," ") || "Verifying profile..."}</strong></div>
              <p className="feedback success">Authentication successful. Your account is active.</p>
              <button onClick={signOut}>Sign out</button>
              <small>System modules and actions will be displayed according to your assigned role.</small>
            </>
          )}
        </div>
      </section>
      <section className="features">
        <article><b>01</b><h3>Stock accountability</h3><p>Maintain a traceable record of magazine stock and balances.</p></article>
        <article><b>02</b><h3>Controlled movements</h3><p>Record issues, returns and receipts with responsible-person details.</p></article>
        <article><b>03</b><h3>Approval trail</h3><p>Keep reviewable records of authorisations and transaction history.</p></article>
      </section>
      <footer>CROCODILE RIVER MINE · INTERNAL SYSTEM · AUTHORISED ACCESS ONLY</footer>
    </main>
  );
}
