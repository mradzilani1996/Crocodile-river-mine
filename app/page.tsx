export default function Home() {
  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><div className="mark">CRM</div><div><strong>CROCODILE RIVER MINE</strong><span>EXPLOSIVES MANAGEMENT SYSTEM</span></div></div><span className="secure">CONTROLLED ACCESS</span></header>
      <section className="hero">
        <div className="eyebrow">CENTRALISED MAGAZINE CONTROL</div>
        <h1>Explosives Management<br/><em>System</em></h1>
        <p className="intro">One central magazine. Controlled stock movements. Clear accountability and traceable approvals.</p>
        <div className="panel"><div className="panel-title">SIGN IN</div><p className="muted">Authentication will be enabled when the Supabase connection is configured.</p><label>Email address</label><input type="email" placeholder="name@company.co.za" disabled/><label>Password</label><input type="password" placeholder="Enter your password" disabled/><button disabled>Sign in — setup pending</button><small>Access is restricted to authorised personnel.</small></div>
      </section>
      <section className="features"><article><b>01</b><h3>Stock accountability</h3><p>Maintain a traceable record of magazine stock and balances.</p></article><article><b>02</b><h3>Controlled movements</h3><p>Record issues, returns and receipts with responsible-person details.</p></article><article><b>03</b><h3>Approval trail</h3><p>Keep reviewable records of authorisations and transaction history.</p></article></section>
      <footer> CROCRODILE RIVER MINE · INTERNAL SYSTEM · AUTHORISED ACCESS ONLY</footer>
    </main>
  );
}