"use client";
import EmsPageHeader from "@/components/ems-page-header";

import { useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Row = Record<string, any>;
type ReportKey = "balances" | "movements" | "daily" | "deliveries" | "incidents" | "inspections" | "product_register" | "product_movements" | "product_approvals" | "product_balances" | "low_stock" | "product_audit" | "acknowledgements" | "system_audit";

const styles: Record<string, React.CSSProperties> = {
  card: { background: "#fff", border: "1px solid #e4e8ee", borderRadius: 14, padding: 18, marginBottom: 16 },
  label: { display: "grid", gap: 6, fontSize: 13, fontWeight: 650, color: "#344054" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #d7dde5", borderRadius: 8, background: "#fff", color: "#17212b" },
  button: { border: 0, borderRadius: 8, padding: "10px 14px", background: "#173b57", color: "#fff", fontWeight: 700, cursor: "pointer" },
  secondary: { border: "1px solid #cbd5df", borderRadius: 8, padding: "10px 14px", background: "#fff", color: "#173b57", fontWeight: 700, cursor: "pointer" }
};

const today = new Date().toLocaleDateString("en-CA");
const reportLabels: Record<ReportKey, string> = {
  balances: "Current stock balances", movements: "Stock movement register", daily: "Daily explosive requests",
  deliveries: "Supplier deliveries", incidents: "Incident register", inspections: "Inspection register",
  product_register: "Product register", product_movements: "Product movement history",
  product_approvals: "Product approval history", product_balances: "Product stock balances",
  low_stock: "Low-stock products", product_audit: "Product audit trail", acknowledgements: "Approval acknowledgement register", system_audit: "System audit trail"
};

export default function ReportsPage() {
  const db = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key) : null;
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<ReportKey>("balances");
  const [products, setProducts] = useState<Row[]>([]);
  const [movements, setMovements] = useState<Row[]>([]);
  const [daily, setDaily] = useState<Row[]>([]);
  const [deliveries, setDeliveries] = useState<Row[]>([]);
  const [incidents, setIncidents] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [productAudit, setProductAudit] = useState<Row[]>([]);
  const [systemAudit, setSystemAudit] = useState<Row[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<Row[]>([]);
  const [profileDirectory, setProfileDirectory] = useState<Row[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(today);
  const [section, setSection] = useState("All registers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db) { setError("The reporting service is not configured."); setLoading(false); return; }
    let alive = true;
    const loadAll = async () => {
      setLoading(true); setError("");
      const { data: auth } = await db.auth.getUser();
      if (!alive) return;
      setUser(auth.user);
      if (!auth.user) { setError("Please sign in to view EMS reports."); setLoading(false); return; }
      const fetchAll = async (table: string, orderBy: string, ascending = false) => {
        let all: Row[] = [];
        let offset = 0;
        while (true) {
          const page = await (db as any).from(table).select("*").order(orderBy, { ascending }).range(offset, offset + 999);
          if (page.error) throw page.error;
          const batch = (page.data || []) as Row[];
          all = all.concat(batch);
          if (batch.length < 1000) break;
          offset += 1000;
        }
        return all;
      };
      try {
        const [p, d, dl, de, i, ins, audit, ack, directoryResult] = await Promise.all([
          fetchAll("ems_explosive_products", "product_name", true), fetchAll("ems_stock_transactions", "transaction_date", true),
          fetchAll("ems_daily_orders", "order_date"), fetchAll("ems_purchase_deliveries", "received_date"),
          fetchAll("ems_incidents", "incident_date"), fetchAll("ems_inspections", "inspection_date"),
          fetchAll("ems_audit_log", "occurred_at").catch(() => []),
          fetchAll("ems_approval_acknowledgements", "acknowledged_at").catch(() => []),
          db.rpc("ems_get_profile_directory")
        ]);
        if (!alive) return;
        setProducts(p); setMovements(d); setDaily(dl); setDeliveries(de); setIncidents(i); setInspections(ins);
        setProductAudit(audit.filter((a: Row) => a.table_name === "ems_explosive_products"));
        setSystemAudit(audit);
        setAcknowledgements(ack);
        if (directoryResult.error) console.warn("Employee name directory unavailable:", directoryResult.error.message);
        setProfileDirectory(directoryResult.data || []);
      } catch (loadError: any) {
        if (alive) setError("Some reports could not be loaded: " + (loadError?.message || "Unknown error"));
      }
      setLoading(false);
    };
    loadAll();
    return () => { alive = false; };
  }, [db]);

  const employeeName = (id: string | null | undefined) => id ? (profileDirectory.find(p => p.user_id === id)?.full_name || "Name unavailable") : "—";
  const employeeRole = (id: string | null | undefined) => id ? (profileDirectory.find(p => p.user_id === id)?.role || "Role unavailable") : "—";
  const productRegister = useMemo(() => products.map(p => ({ ...p, created_by_name: employeeName(p.created_by), created_date: p.created_at, approval_stage: p.approval_status === "pending_shift_boss" ? "Pending Shiftboss" : p.approval_status === "pending_management" ? "Pending Management" : p.approval_status === "approved" ? "Approved" : p.approval_status === "rejected" ? "Rejected" : (p.approval_status || "Not recorded") })), [products, profileDirectory]);
  const productMovements = useMemo(() => movements.map(tx => { const p = products.find(x => x.id === tx.product_id); return { ...tx, product_code: p?.product_code, product_name: p?.product_name, product_unit: p?.unit_of_measure, created_by_name: employeeName(tx.created_by), shiftboss_approved_name: employeeName(tx.shiftboss_approved_by), management_approved_name: employeeName(tx.approved_by), created_by_role: employeeRole(tx.created_by) }; }), [movements, products, profileDirectory]);
  const movementReport = useMemo(() => movements.map(tx => ({ ...tx, created_by_name: employeeName(tx.created_by), approved_by_name: employeeName(tx.approved_by), posted_by_name: employeeName(tx.posted_by) })), [movements, profileDirectory]);
  const productApprovals = useMemo(() => products.map(p => ({ product_code: p.product_code, product_name: p.product_name, approval_status: p.approval_status, submitted_by: employeeName(p.submitted_by || p.created_by), shiftboss_approved_by: employeeName(p.shiftboss_approved_by), shiftboss_approved_at: p.shiftboss_approved_at, management_approved_by: employeeName(p.management_approved_by), management_approved_at: p.management_approved_at, approved_by: employeeName(p.approved_by), approved_at: p.approved_at, approval_notes: p.approval_notes, created_at: p.created_at })), [products, profileDirectory]);

  const balances = useMemo(() => {
    const grouped = new Map<string, Row>();
    for (const tx of movements) {
      if (tx.status !== "posted") continue;
      const product = products.find(p => p.id === tx.product_id);
      if (!product) continue;
      const register = tx.control_book_section || product.control_book_section || "Unassigned";
      const key = product.id + "|" + register;
      const current = grouped.get(key) || { product_id: product.id, product_code: product.product_code, product_name: product.product_name, unit: product.unit_of_measure, register, units: 0, packages: 0, minimum: Number(product.minimum_stock || 0) };
      const sign = tx.transaction_type === "receipt" || tx.transaction_type === "return" || (tx.transaction_type === "adjustment" && tx.adjustment_direction === "increase") ? 1 : -1;
      current.units += sign * Number(tx.unit_quantity ?? tx.quantity ?? 0);
      current.packages += sign * Number(tx.package_quantity ?? 0);
      grouped.set(key, current);
    }
    for (const p of products) {
      const register = p.control_book_section || "Unassigned";
      const key = p.id + "|" + register;
      if (!grouped.has(key)) grouped.set(key, { product_id: p.id, product_code: p.product_code, product_name: p.product_name, unit: p.unit_of_measure, register, units: 0, packages: 0, minimum: Number(p.minimum_stock || 0) });
    }
    return Array.from(grouped.values()).sort((a,b) => String(a.product_name).localeCompare(String(b.product_name)) || String(a.register).localeCompare(String(b.register)));
  }, [movements, products]);
  const lowStock = useMemo(() => balances.filter(r => Number(r.minimum || 0) > 0 && Number(r.units || 0) <= Number(r.minimum || 0)), [balances]);
  const source: Row[] = report === "balances" || report === "product_balances" ? balances : report === "low_stock" ? lowStock : report === "product_register" ? productRegister : report === "product_movements" ? productMovements : report === "product_approvals" ? productApprovals : report === "product_audit" ? productAudit : report === "acknowledgements" ? acknowledgements : report === "system_audit" ? systemAudit : report === "movements" ? movementReport : report === "daily" ? daily : report === "deliveries" ? deliveries : report === "incidents" ? incidents : inspections;
  const dateField: Record<ReportKey, string> = { balances: "", movements: "transaction_date", daily: "order_date", deliveries: "received_date", incidents: "incident_date", inspections: "inspection_date", product_register: "created_at", product_movements: "transaction_date", product_approvals: "created_at", product_balances: "", low_stock: "", product_audit: "occurred_at", acknowledgements: "acknowledged_at", system_audit: "occurred_at" };
  const rows: Row[] = useMemo(() => (source as Row[]).filter((row: Row) => {
    if (report === "balances" || report === "product_balances" || report === "low_stock") return section === "All registers" || row.register === section;
    const raw = row[dateField[report]];
    if (!raw) return true;
    const date = String(raw).slice(0,10);
    return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  }), [source, report, section, fromDate, toDate]);

  const columns: Record<ReportKey, { key: string; label: string }[]> = {
    balances: [{key:"product_code",label:"Product code"},{key:"product_name",label:"Product"},{key:"register",label:"Register"},{key:"units",label:"Balance"},{key:"unit",label:"Unit"},{key:"packages",label:"Packages"},{key:"minimum",label:"Minimum stock"}],
    movements: [{key:"transaction_number",label:"Reference"},{key:"transaction_date",label:"Date"},{key:"transaction_type",label:"Movement"},{key:"product_id",label:"Product ID"},{key:"control_book_section",label:"Register"},{key:"unit_quantity",label:"Units"},{key:"package_quantity",label:"Packages"},{key:"created_by_name",label:"Recorded by"},{key:"approved_by_name",label:"Approved by"},{key:"posted_by_name",label:"Posted by"},{key:"status",label:"Status"},{key:"reference_number",label:"Document reference"}],
    daily: [{key:"order_date",label:"Date"},{key:"shift",label:"Shift"},{key:"work_section",label:"Work area"},{key:"miner_name",label:"Miner"},{key:"miner_company_number",label:"Company number"},{key:"status",label:"Status"}],
    deliveries: [{key:"received_date",label:"Received date"},{key:"supplier_delivery_note",label:"Delivery note"},{key:"order_id",label:"Purchase order"},{key:"received_by_name",label:"Received by"},{key:"notes",label:"Notes"}],
    incidents: [{key:"incident_date",label:"Incident date"},{key:"incident_type",label:"Type"},{key:"severity",label:"Severity"},{key:"location",label:"Location"},{key:"description",label:"Description"},{key:"reporter_name",label:"Reported by"},{key:"status",label:"Status"}],
    inspections: [{key:"inspection_date",label:"Date"},{key:"inspection_type",label:"Inspection"},{key:"location",label:"Location"},{key:"findings",label:"Findings"},{key:"non_conformances",label:"Non-conformances"},{key:"status",label:"Status"}],
    product_register: [{key:"product_code",label:"Product code"},{key:"product_name",label:"Product name"},{key:"unit_of_measure",label:"Unit"},{key:"control_book_section",label:"Register"},{key:"opening_quantity",label:"Opening quantity"},{key:"minimum_stock",label:"Minimum stock"},{key:"is_active",label:"Active"},{key:"approval_stage",label:"Approval status"},{key:"created_by_name",label:"Created by"},{key:"created_at",label:"Created date"}],
    product_movements: [{key:"transaction_number",label:"Reference"},{key:"transaction_date",label:"Date"},{key:"product_code",label:"Product code"},{key:"product_name",label:"Product"},{key:"transaction_type",label:"Movement"},{key:"unit_quantity",label:"Units"},{key:"package_quantity",label:"Packages"},{key:"container_number",label:"Container number"},{key:"work_section",label:"Work area"},{key:"miner_name",label:"Issued to"},{key:"miner_company_number",label:"Company number"},{key:"issuer_name",label:"Issuer"},{key:"created_by_name",label:"Recorded by"},{key:"created_by_role",label:"Recorder role"},{key:"shiftboss_approved_name",label:"Shiftboss approver"},{key:"shiftboss_approved_at",label:"Shiftboss approval date"},{key:"management_approved_name",label:"Management approver"},{key:"approved_at",label:"Management approval date"},{key:"posted_at",label:"Posted date"},{key:"status",label:"Status"},{key:"reference_number",label:"Document reference"}],
    product_approvals: [{key:"product_code",label:"Product code"},{key:"product_name",label:"Product"},{key:"approval_status",label:"Approval status"},{key:"submitted_by",label:"Submitted by"},{key:"shiftboss_approved_by",label:"Shiftboss"},{key:"shiftboss_approved_at",label:"Shiftboss approval date"},{key:"management_approved_by",label:"Management"},{key:"management_approved_at",label:"Management approval date"},{key:"approved_by",label:"Final approver"},{key:"approved_at",label:"Final approval date"},{key:"approval_notes",label:"Approval notes"},{key:"created_at",label:"Product created date"}],
    product_balances: [{key:"product_code",label:"Product code"},{key:"product_name",label:"Product"},{key:"register",label:"Register"},{key:"units",label:"Current balance"},{key:"unit",label:"Unit"},{key:"packages",label:"Packages"},{key:"minimum",label:"Minimum stock"}],
    low_stock: [{key:"product_code",label:"Product code"},{key:"product_name",label:"Product"},{key:"register",label:"Register"},{key:"units",label:"Current balance"},{key:"unit",label:"Unit"},{key:"minimum",label:"Minimum stock"}],
    product_audit: [{key:"occurred_at",label:"Date and time"},{key:"actor_name",label:"User"},{key:"action",label:"Action"},{key:"record_id",label:"Product record ID"},{key:"old_data",label:"Previous product data"},{key:"new_data",label:"Updated product data"}],
    acknowledgements: [{key:"acknowledged_at",label:"Acknowledged at"},{key:"entity_type",label:"Record type"},{key:"entity_id",label:"Record ID"},{key:"approval_stage",label:"Approval stage"},{key:"decision",label:"Decision"},{key:"actor_name",label:"Employee"},{key:"actor_role",label:"Role"},{key:"acknowledgement_text",label:"Acknowledgement"},{key:"signature_method",label:"Signature method"},{key:"comments",label:"Comments"}],\n    system_audit: [{key:"occurred_at",label:"Date and time"},{key:"actor_name",label:"Employee"},{key:"actor_user_id",label:"Actor ID"},{key:"action",label:"Action"},{key:"table_name",label:"Affected register"},{key:"record_id",label:"Record ID"},{key:"old_data",label:"Previous data"},{key:"new_data",label:"New data"}]
  };

  const cell = (value: any) => value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const exportCsv = () => {
    const cols = columns[report];
    const quote = (v: any) => '"' + cell(v).replaceAll('"','""') + '"';
    const csv = [cols.map(c => quote(c.label)).join(","), ...rows.map(r => cols.map(c => quote(r[c.key])).join(","))].join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "crm-ems-" + report + "-" + today + ".csv"; a.click(); URL.revokeObjectURL(url);
  };

  if (!user && !loading && !error) return <main style={{padding:32}}>Please sign in to view reports.</main>;
  return <main className="ems-page" style={{ maxWidth: 1500, margin: "0 auto", padding: "28px 24px", color: "#17212b" }}><EmsPageHeader active="reports"/>
    <style>{`@media print { .report-controls,.no-print { display:none !important; } body { background:#fff !important; } main { max-width:none !important; padding:0 !important; } table { font-size:10px !important; } th,td { padding:6px !important; } }`}</style>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:20}}>
      <div><div style={{fontSize:12,fontWeight:800,letterSpacing:1.5,color:"#64748b"}}>CROCODILE RIVER MINE / EMS</div><h1 style={{fontSize:28,margin:"7px 0"}}>Reports</h1><p style={{margin:0,color:"#64748b"}}>View, filter, print and export official system records.</p></div>
      <div className="no-print" style={{display:"flex",gap:8}}><button style={styles.secondary} onClick={()=>window.print()}>Print report</button><button style={styles.button} onClick={exportCsv}>Export CSV</button></div>
    </div>
    <section className="report-controls" style={styles.card}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {(Object.keys(reportLabels) as ReportKey[]).map(k=><button key={k} onClick={()=>setReport(k)} style={{...styles.secondary,background:report===k?"#173b57":"#fff",color:report===k?"#fff":"#173b57"}}>{reportLabels[k]}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <label style={styles.label}>From date<input type="date" style={styles.input} value={fromDate} onChange={e=>setFromDate(e.target.value)} disabled={report==="balances" || report==="product_balances" || report==="low_stock"}/></label>
        <label style={styles.label}>To date<input type="date" style={styles.input} value={toDate} onChange={e=>setToDate(e.target.value)} disabled={report==="balances" || report==="product_balances" || report==="low_stock"}/></label>
        <label style={styles.label}>Register<select style={styles.input} value={section} onChange={e=>setSection(e.target.value)} disabled={report!=="balances" && report!=="product_balances" && report!=="low_stock"}><option>All registers</option><option>Boxes</option><option>Bags</option><option>Tamping</option><option>Unassigned</option></select></label>
      </div>
    </section>
    <section style={styles.card}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:14}}><div><h2 style={{fontSize:19,margin:"0 0 5px"}}>{reportLabels[report]}</h2><p style={{margin:0,color:"#64748b",fontSize:13}}>{rows.length} records · {report==="balances"?"Balances are calculated from posted movements only.":"Date filters apply to the selected report."}</p></div><span style={{fontSize:12,color:"#64748b"}}>Generated {new Date().toLocaleString("en-ZA")}</span></div>
      {loading ? <p>Loading report records…</p> : error ? <p style={{color:"#b42318"}}>{error}</p> : rows.length===0 ? <p style={{padding:24,textAlign:"center",color:"#64748b"}}>No records found for this report and date range.</p> :
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{columns[report].map(c=><th key={c.key} style={{textAlign:"left",padding:10,background:"#f3f6f9",borderBottom:"1px solid #dbe2e9",whiteSpace:"nowrap"}}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||r.product_id||i}>{columns[report].map(c=><td key={c.key} style={{padding:10,borderBottom:"1px solid #edf0f3",verticalAlign:"top"}}>{cell(r[c.key])}</td>)}</tr>)}</tbody></table></div>}
    </section>
    <p style={{fontSize:12,color:"#64748b"}}>Reports reflect records available to your signed-in EMS account. Stock balances exclude pending and rejected movements.</p>
  </main>;
}
