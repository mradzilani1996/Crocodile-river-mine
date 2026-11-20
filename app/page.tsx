"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

type Profile = { full_name: string; email: string; role: string; is_active: boolean };
type Magazine = { magazine_name: string; responsible_user_id: string | null; is_active: boolean };
type EMSProfile = { user_id: string; full_name: string; email: string; role: string; is_active: boolean };
type Transaction = { id: string; transaction_number: number; transaction_type: string; status: string; quantity: number; transaction_date: string; reference_number: string | null };
type Product = { id: string; product_code: string; product_name: string; control_book_section: string | null; unit_of_measure: string; minimum_stock: number; is_active: boolean; approval_status: string; submitted_by: string | null; approved_by: string | null; approved_at: string | null; approval_notes: string | null };
type DailyOrder = { id: string; order_number: number; order_date: string; shift: string; work_area: string; blast_site: string | null; miner_name: string; miner_company_number: string; requester_name: string; purpose: string; status: string; requested_by: string; approval_notes: string | null };
type DailyOrderItem = { id: string; order_id: string; product_id: string; quantity_requested: number; quantity_approved: number | null; quantity_issued: number; notes: string | null };
type LedgerTransaction = { id: string; transaction_number: number; transaction_type: string; status: string; product_id: string; quantity: number; transaction_date: string; reference_number: string | null; source_or_destination: string | null; issued_to: string | null; purpose: string | null; notes: string | null; adjustment_direction: string; control_book_section: string | null; container_number: string | null; item_type: string | null; item_description: string | null; package_quantity: number; unit_quantity: number; work_section: string | null; miner_company_number: string | null; miner_name: string | null; miner_acknowledged: boolean };
type PurchaseOrder = { id:string; order_number:number; supplier_name:string; supplier_contact:string|null; supplier_email:string|null; supplier_reference:string|null; quotation_reference:string|null; order_date:string; required_delivery_date:string|null; work_area:string; purpose:string; requested_by:string; requester_name:string; status:string; supplier_order_number:string|null; submitted_at:string; ordered_at:string|null; created_at:string };
type PurchaseOrderItem = { id:string; order_id:string; product_id:string|null; item_description:string; quantity:number; unit_of_measure:string; notes:string|null };
type PurchaseApproval = { id:string; order_id:string; approval_stage:string; decision:string; comments:string|null; actioned_by:string; actioned_by_name:string; actioned_at:string };
type PurchaseDelivery = { id:string; delivery_number:number; order_id:string; supplier_delivery_note:string; received_date:string; received_by:string; received_by_name:string; notes:string|null; created_at:string };
type PurchaseDeliveryItem = { id:string; delivery_id:string; order_item_id:string; quantity_received:number; notes:string|null };

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
  const [resetEmailMode, setResetEmailMode] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [section, setSection] = useState("overview");
  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [magazineName, setMagazineName] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [profiles, setProfiles] = useState<EMSProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [productUnit, setProductUnit] = useState("units");
  const [productSection, setProductSection] = useState("Boxes");
  const [productMinimum, setProductMinimum] = useState("0");
  const [productNotes, setProductNotes] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingMovementCount, setPendingMovementCount] = useState(0);
  const [documentReviewRows, setDocumentReviewRows] = useState<{id:string;title:string;document_number:string;review_date:string|null;status:string}[]>([]);
  const [controlBookRows, setControlBookRows] = useState<LedgerTransaction[]>([]);
  const [ledgerProduct, setLedgerProduct] = useState("all");
  const [ledgerCategory, setLedgerCategory] = useState("all");
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [dailyOrders, setDailyOrders] = useState<DailyOrder[]>([]);
  const [dailyOrderItems, setDailyOrderItems] = useState<DailyOrderItem[]>([]);
  const [dailyApprovalQuantities, setDailyApprovalQuantities] = useState<Record<string,string>>({});
  const [dailyApprovalNotes, setDailyApprovalNotes] = useState<Record<string,string>>({});
  const [dailyIssueOrderId, setDailyIssueOrderId] = useState("");
  const [dailyIssueAck, setDailyIssueAck] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [purchaseApprovals, setPurchaseApprovals] = useState<PurchaseApproval[]>([]);
  const [purchaseDeliveries, setPurchaseDeliveries] = useState<PurchaseDelivery[]>([]);
  const [purchaseDeliveryItems, setPurchaseDeliveryItems] = useState<PurchaseDeliveryItem[]>([]);
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseContact, setPurchaseContact] = useState("");
  const [purchaseEmail, setPurchaseEmail] = useState("");
  const [purchaseSupplierRef, setPurchaseSupplierRef] = useState("");
  const [purchaseQuoteRef, setPurchaseQuoteRef] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0,10));
  const [purchaseRequiredDate, setPurchaseRequiredDate] = useState("");
  const [purchaseWorkArea, setPurchaseWorkArea] = useState("");
  const [purchasePurpose, setPurchasePurpose] = useState("");
  const [purchaseLines, setPurchaseLines] = useState([{product_id:"",item_description:"",quantity:"",unit_of_measure:"units",notes:""}]);
  const [purchaseComment, setPurchaseComment] = useState("");
  const [placingOrderId, setPlacingOrderId] = useState("");
  const [supplierOrderNumber, setSupplierOrderNumber] = useState("");
  const [deliveryOrderId, setDeliveryOrderId] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0,10));
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string,string>>({});
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderShift, setOrderShift] = useState("day");
  const [workArea, setWorkArea] = useState("");
  const [blastSite, setBlastSite] = useState("");
  const [minerName, setMinerName] = useState("");
  const [minerCompanyNumber, setMinerCompanyNumber] = useState("");
  const [orderPurpose, setOrderPurpose] = useState("");
  const [draftOrderItems, setDraftOrderItems] = useState([{ product_id: "", quantity_requested: "", notes: "" }]);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("issuer");
  const [dataLoading, setDataLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

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
    const [mag, people, productRows, txRows, orderRows, orderItemRows, ledgerRows, purchaseRows, purchaseItemRows, approvalRows, deliveryRows, deliveryItemRows, pendingRows, docRows] = await Promise.all([
      supabase.from("ems_magazine").select("magazine_name,responsible_user_id,is_active").eq("singleton", true).maybeSingle(),
      supabase.from("ems_profiles").select("user_id,full_name,email,role,is_active").order("full_name"),
      supabase.from("ems_explosive_products").select("id,product_code,product_name,control_book_section,unit_of_measure,minimum_stock,is_active,approval_status,submitted_by,approved_by,approved_at,approval_notes").order("product_name"),
      supabase.from("ems_stock_transactions").select("id,transaction_number,transaction_type,status,quantity,transaction_date,reference_number").order("transaction_date", { ascending: false }).limit(8),
      supabase.from("ems_daily_orders").select("id,order_number,order_date,shift,work_area,blast_site,miner_name,miner_company_number,requester_name,purpose,status,requested_by,approval_notes").order("created_at", { ascending: false }).limit(50),
      supabase.from("ems_daily_order_items").select("id,order_id,product_id,quantity_requested,quantity_approved,quantity_issued,notes").order("created_at"),
      Promise.resolve({data:[],error:null}),
      supabase.from("ems_purchase_orders").select("id,order_number,supplier_name,supplier_contact,supplier_email,supplier_reference,quotation_reference,order_date,required_delivery_date,work_area,purpose,requested_by,requester_name,status,supplier_order_number,submitted_at,ordered_at,created_at").order("created_at",{ascending:false}).limit(100),
      supabase.from("ems_purchase_order_items").select("id,order_id,product_id,item_description,quantity,unit_of_measure,notes").order("created_at"),
      supabase.from("ems_purchase_order_approvals").select("id,order_id,approval_stage,decision,comments,actioned_by,actioned_by_name,actioned_at").order("actioned_at"),
      supabase.from("ems_purchase_deliveries").select("id,delivery_number,order_id,supplier_delivery_note,received_date,received_by,received_by_name,notes,created_at").order("received_date",{ascending:false}),
      supabase.from("ems_purchase_delivery_items").select("id,delivery_id,order_item_id,quantity_received,notes").order("created_at"),
      supabase.from("ems_stock_transactions").select("id",{count:"exact",head:true}).eq("status","pending_approval"),
      supabase.from("ems_document_register").select("id,title,document_number,review_date,status").order("review_date",{ascending:true}).limit(300)
    ]);
    let allPostedLedgerRows:LedgerTransaction[]=[];let ledgerOffset=0;let ledgerLoadError:string|null=null;
    while(true){const page=await supabase.from("ems_stock_transactions").select("id,transaction_number,transaction_type,status,product_id,quantity,transaction_date,reference_number,source_or_destination,issued_to,purpose,notes,adjustment_direction,control_book_section,container_number,item_type,item_description,package_quantity,unit_quantity,work_section,miner_company_number,miner_name,miner_acknowledged").eq("status","posted").order("transaction_date",{ascending:true}).order("transaction_number",{ascending:true}).range(ledgerOffset,ledgerOffset+999);if(page.error){ledgerLoadError=page.error.message;break;}const batch=(page.data||[]) as LedgerTransaction[];allPostedLedgerRows=allPostedLedgerRows.concat(batch);if(batch.length<1000)break;ledgerOffset+=1000;}
    if (mag.error) setError("Could not load magazine details. Check the database permissions.");
    else if (mag.data) { setMagazine(mag.data as Magazine); setMagazineName(mag.data.magazine_name); setResponsibleUserId(mag.data.responsible_user_id || ""); }
    if (people.data) setProfiles(people.data as EMSProfile[]);
    if (productRows.data) setProducts(productRows.data as Product[]);
    if (txRows.data) setTransactions(txRows.data as Transaction[]);
    if (orderRows.data) setDailyOrders(orderRows.data as DailyOrder[]);
    if (orderItemRows.data) setDailyOrderItems(orderItemRows.data as DailyOrderItem[]);
    setControlBookRows(allPostedLedgerRows);
    if (ledgerLoadError) setError("The Explosives Control Book could not load all posted stock movements: " + ledgerLoadError);
    if (purchaseRows.data) setPurchaseOrders(purchaseRows.data as PurchaseOrder[]);
    if (purchaseItemRows.data) setPurchaseOrderItems(purchaseItemRows.data as PurchaseOrderItem[]);
    if (approvalRows.data) setPurchaseApprovals(approvalRows.data as PurchaseApproval[]);
    if (deliveryRows.data) setPurchaseDeliveries(deliveryRows.data as PurchaseDelivery[]);
    if (deliveryItemRows.data) setPurchaseDeliveryItems(deliveryItemRows.data as PurchaseDeliveryItem[]);
    if (pendingRows.error) setError("Pending approval count could not be loaded: " + pendingRows.error.message); else setPendingMovementCount(pendingRows.count || 0);
    if (docRows.error) setError("Document review reminders could not be loaded: " + docRows.error.message); else setDocumentReviewRows(docRows.data || []);
    setDataLoading(false);
  }

  useEffect(() => {
    setResetMode(new URLSearchParams(window.location.search).get("mode") === "reset" || new URLSearchParams(window.location.hash.slice(1)).get("type") === "invite");
    if (!supabase) { setAuthChecking(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) { setUser(data.session.user); await loadProfile(data.session.user); }
      setAuthChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
      if (event === "PASSWORD_RECOVERY" || new URLSearchParams(window.location.hash.slice(1)).get("type") === "invite") setResetMode(true);
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
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError("This password-reset link does not contain a valid sign-in session. Please open the newest reset email link again. If it has expired, request a new link.");
      setBusy(false);
      return;
    }
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

  async function addExplosiveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !canManageProducts) return;
    setBusy(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("ems_explosive_products").insert({
      product_code: productCode.trim(), product_name: productName.trim(), control_book_section: productSection, unit_of_measure: productUnit.trim(),
      minimum_stock: Number(productMinimum), is_active: false, approval_status: "pending_approval",
      submitted_by: user.id, created_by: user.id, approval_notes: productNotes.trim() || null
    });
    if (insertError) setError("Product could not be submitted: " + insertError.message);
    else { setNotice("Product submitted for mine authorisation. It will only be available for stock movements after approval."); setProductCode(""); setProductName(""); setProductSection("Boxes"); setProductUnit("units"); setProductMinimum("0"); setProductNotes(""); await loadDashboard(); }
    setBusy(false);
  }

  async function reviewExplosiveProduct(product: Product, decision: "approved" | "rejected") {
    if (!supabase || !user || !canApproveProducts) return;
    if (product.submitted_by === user.id) { setError("A product must be approved by someone other than the person who submitted it."); return; }
    setBusy(true); setError(""); setNotice("");
    const { error: reviewError } = await supabase.from("ems_explosive_products").update({
      approval_status: decision, approved_by: user.id, approved_at: new Date().toISOString(),
      approval_notes: productNotes.trim() || product.approval_notes || null, is_active: decision === "approved"
    }).eq("id", product.id).eq("approval_status", "pending_approval");
    if (reviewError) setError("Product decision could not be saved: " + reviewError.message);
    else { setNotice(decision === "approved" ? "Product approved and made available for authorised stock movements." : "Product rejected and kept unavailable for stock movements."); setProductNotes(""); await loadDashboard(); }
    setBusy(false);
  }

  async function submitDailyOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    if (draftOrderItems.some(i => !i.product_id || !i.quantity_requested || Number(i.quantity_requested) <= 0)) {
      setError("Choose a product and enter a quantity greater than zero for every order line."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const { error: submitError } = await supabase.rpc("ems_submit_daily_order", {
      p_order_date: orderDate, p_shift: orderShift, p_work_area: workArea, p_blast_site: blastSite,
      p_purpose: orderPurpose,
      p_items: draftOrderItems.map(i => ({ product_id: i.product_id, quantity_requested: Number(i.quantity_requested), notes: i.notes })),
      p_miner_name: minerName, p_miner_company_number: minerCompanyNumber
    });
    if (submitError) setError("Daily order could not be submitted: " + submitError.message);
    else {
      setNotice("Daily explosive order submitted for authorisation.");
      setWorkArea(""); setBlastSite(""); setMinerName(""); setMinerCompanyNumber(""); setOrderPurpose("");
      setDraftOrderItems([{ product_id: "", quantity_requested: "", notes: "" }]);
      await loadDashboard();
    }
    setBusy(false);
  }

  async function inviteEMSUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || profile?.role !== "admin") return;
    setBusy(true); setError(""); setNotice("");
    const { data, error: inviteError } = await supabase.functions.invoke("ems-admin-invite-user", {
      body: { full_name: inviteFullName.trim(), email: inviteEmail.trim(), role: inviteRole }
    });
    if (inviteError || data?.error) {
      setError("Staff invitation could not be sent: " + (inviteError?.message || data?.error || "Unknown error"));
    } else {
      setNotice("Invitation sent to " + inviteEmail.trim() + ". The staff member must use the email link to set their password.");
      setInviteFullName(""); setInviteEmail(""); setInviteRole("issuer");
      await loadDashboard();
    }
    setBusy(false);
  }

  async function updateEMSUser(person: EMSProfile, patch: Partial<Pick<EMSProfile,"role"|"is_active">>) {
    if (!supabase || profile?.role !== "admin" || person.user_id === user?.id) return;
    if (patch.role === "admin") { setError("Administrator access cannot be assigned from this screen."); return; }
    if (patch.is_active === false && !window.confirm("Deactivate " + person.full_name + "? They will no longer be able to sign in to the EMS.")) return;
    setBusy(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("ems_profiles").update(patch).eq("user_id", person.user_id);
    if (updateError) setError("Staff access could not be updated: " + updateError.message);
    else { setNotice("Staff access updated for " + person.full_name + "."); await loadDashboard(); }
    setBusy(false);
  }

  async function updateDailyOrder(order: DailyOrder, action: "approve" | "reject" | "fulfil") {
    if (!supabase || !user) return;
    setBusy(true); setError(""); setNotice("");
    let resultMessage = "";
    if (action === "approve" || action === "reject") {
      const orderItems = dailyOrderItems.filter(i => i.order_id === order.id);
      const approvedItems = action === "approve" ? orderItems.map(i => ({
        id: i.id,
        quantity_approved: Number(dailyApprovalQuantities[i.id] ?? i.quantity_requested)
      })) : [];
      if (action === "approve" && approvedItems.some((i,index) =>
        !Number.isFinite(i.quantity_approved) || i.quantity_approved < 0 ||
        i.quantity_approved > Number(orderItems[index].quantity_requested)
      )) {
        setError("Each approved quantity must be zero or more and cannot exceed the quantity requested.");
        setBusy(false); return;
      }
      const comments = (dailyApprovalNotes[order.id] || "").trim();
      if (action === "reject" && !comments) {
        setError("Enter a reason before rejecting this daily request.");
        setBusy(false); return;
      }
      const { error: decisionError } = await supabase.rpc("ems_process_daily_order", {
        p_order_id: order.id,
        p_decision: action,
        p_items: approvedItems,
        p_comments: comments || null
      });
      if (decisionError) setError("Daily request decision could not be saved: " + decisionError.message);
      else resultMessage = action === "approve"
        ? "Request approved with the authorised quantities. The Issuer can now prepare the issue."
        : "Request rejected. The reason has been recorded.";
    } else {
      if (dailyIssueOrderId !== order.id || !dailyIssueAck) {
        setError("Confirm the named miner's acknowledgement before issuing explosives.");
        setBusy(false); return;
      }
      const { data: created, error: fulfilError } = await supabase.rpc("ems_fulfil_daily_order", {
        p_order_id: order.id,
        p_miner_acknowledged: true
      });
      if (fulfilError) setError("Issue could not be prepared: " + fulfilError.message);
      else resultMessage = Number(created) > 0
        ? "Issue recorded for stock approval. The stock balance will decrease only after the Authorising Officer approves and the Magazine Master posts each movement."
        : "All approved quantities have already been issued and posted.";
      setDailyIssueOrderId("");
      setDailyIssueAck(false);
    }
    if (resultMessage) { setNotice(resultMessage); await loadDashboard(); }
    setBusy(false);
  }

  async function submitPurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (purchaseLines.some(line => !line.product_id || !line.quantity || Number(line.quantity) <= 0)) {
      setError("Select an approved product from the product register and enter a quantity greater than zero for every inventory line. Add missing products to the register first."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const { error: submitError } = await supabase.rpc("ems_submit_purchase_order", {
      p_supplier_name: purchaseSupplier,
      p_supplier_contact: purchaseContact,
      p_supplier_email: purchaseEmail,
      p_supplier_reference: purchaseSupplierRef,
      p_quotation_reference: purchaseQuoteRef,
      p_order_date: purchaseDate,
      p_required_delivery_date: purchaseRequiredDate || null,
      p_work_area: purchaseWorkArea,
      p_purpose: purchasePurpose,
      p_items: purchaseLines.map(line => ({
        product_id: line.product_id || null,
        item_description: line.item_description,
        quantity: Number(line.quantity),
        unit_of_measure: line.unit_of_measure,
        notes: line.notes
      }))
    });
    if (submitError) setError("Purchase order could not be submitted: " + submitError.message);
    else {
      setNotice("Explosives and accessories order submitted for Shiftboss review.");
      setPurchaseSupplier(""); setPurchaseContact(""); setPurchaseEmail(""); setPurchaseSupplierRef(""); setPurchaseQuoteRef("");
      setPurchaseRequiredDate(""); setPurchaseWorkArea(""); setPurchasePurpose("");
      setPurchaseLines([{product_id:"",item_description:"",quantity:"",unit_of_measure:"units",notes:""}]);
      await loadDashboard();
    }
    setBusy(false);
  }

  async function processPurchaseApproval(order: PurchaseOrder, decision: "approve" | "reject") {
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: approvalError } = await supabase.rpc("ems_process_purchase_order_approval", {
      p_order_id: order.id, p_decision: decision, p_comments: purchaseComment
    });
    if (approvalError) setError("Approval could not be recorded: " + approvalError.message);
    else { setNotice(decision === "approve" ? "Approval recorded. The order has moved to the next review stage." : "Purchase order rejected and the decision recorded."); setPurchaseComment(""); await loadDashboard(); }
    setBusy(false);
  }

  async function placePurchaseOrder(event: FormEvent<HTMLFormElement>, order: PurchaseOrder) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: placeError } = await supabase.rpc("ems_place_purchase_order", {p_order_id:order.id,p_supplier_order_number:supplierOrderNumber});
    if (placeError) setError("Supplier order reference could not be saved: " + placeError.message);
    else { setNotice("Supplier order placement recorded."); setPlacingOrderId(""); setSupplierOrderNumber(""); await loadDashboard(); }
    setBusy(false);
  }

  async function submitPurchaseDelivery(event: FormEvent<HTMLFormElement>, order: PurchaseOrder) {
    event.preventDefault();
    if (!supabase) return;
    const lines = purchaseOrderItems.filter(i=>i.order_id===order.id).map(i=>({
      order_item_id:i.id, quantity_received:Number(deliveryQuantities[i.id]||0)
    })).filter(i=>i.quantity_received>0);
    if (!deliveryNote.trim() || !lines.length) { setError("Enter the supplier delivery note and at least one received quantity."); return; }
    for (const line of lines) {
      const item = purchaseOrderItems.find(i=>i.id===line.order_item_id)!;
      const alreadyReceived = purchaseDeliveryItems.filter(d=>d.order_item_id===item.id).reduce((sum,d)=>sum+Number(d.quantity_received),0);
      if (line.quantity_received > Number(item.quantity)-alreadyReceived) { setError("A received quantity is greater than the outstanding quantity for "+item.item_description+"."); return; }
    }
    setBusy(true); setError(""); setNotice("");
    const { error: deliveryError } = await supabase.rpc("ems_record_purchase_delivery", {
      p_order_id:order.id, p_supplier_delivery_note:deliveryNote, p_received_date:deliveryDate,
      p_notes:deliveryNotes, p_lines:lines
    });
    if (deliveryError) setError("Delivery could not be recorded: " + deliveryError.message);
    else { setNotice("Supplier delivery recorded. Registered products have generated receipt movements in the stock approval queue. Stock balances will increase after authorisation and Magazine Master posting."); setDeliveryOrderId(""); setDeliveryNote(""); setDeliveryNotes(""); setDeliveryQuantities({}); await loadDashboard(); }
    setBusy(false);
  }

  const activePeople = profiles.filter(p => p.is_active);
  const activeProducts = products.filter(p => p.is_active && p.approval_status === "approved");
  const canManageProducts = profile?.role === "admin" || profile?.role === "magazine_master";
  const canApproveProducts = profile?.role === "admin" || profile?.role === "authorising_officer" || profile?.role === "management";
  const pendingStock = pendingMovementCount;
  const pendingDaily = dailyOrders.filter(o => o.status === "submitted").length;
  const pendingProducts = products.filter(p => p.approval_status === "pending_approval").length;
  const pendingSupplierOrders = purchaseOrders.filter(o => ["pending_shift_boss","pending_magazine_master","pending_mine_overseer"].includes(o.status)).length;
  const pending = pendingStock + pendingDaily + pendingProducts + pendingSupplierOrders;
  const canManageMagazine = profile?.role === "admin";
  const canApproveOrders = profile?.role === "admin" || profile?.role === "authorising_officer";
  const canFulfilOrders = profile?.role === "admin" || profile?.role === "magazine_master" || profile?.role === "issuer";
  const canShiftBossReview = profile?.role === "admin" || profile?.role === "authorising_officer";
  const canMagazineMasterReview = profile?.role === "admin" || profile?.role === "magazine_master";
  const canMineOverseerReview = profile?.role === "admin" || profile?.role === "management";
  const canPlacePurchaseOrder = profile?.role === "admin" || profile?.role === "magazine_master";
  const canRecordPurchaseDelivery = profile?.role === "admin" || profile?.role === "magazine_master";
  const roleName = (profile?.role || "").replaceAll("_", " ");
  const dueDocumentReviews = documentReviewRows.filter(d => d.status === "current" && d.review_date && d.review_date <= new Date(Date.now() + 30*86400000).toISOString().slice(0,10));
  const controlBookBalances = activeProducts.flatMap(p => {
    const recordedSections = Array.from(new Set(controlBookRows.filter(t => t.product_id === p.id).map(t => productBookSection(p, t.control_book_section))));
    const sections = recordedSections.length ? recordedSections : [productBookSection(p)];
    return sections.map(section => ({
      product: p,
      section,
      balance: controlBookRows.filter(t => t.product_id === p.id && productBookSection(p, t.control_book_section) === section).reduce((sum,t) => {
        const amount = Number(t.unit_quantity ?? t.quantity ?? 0);
        if (t.transaction_type === "receipt" || t.transaction_type === "return") return sum + amount;
        if (t.transaction_type === "issue") return sum - amount;
        return sum + (t.adjustment_direction === "increase" ? amount : -amount);
      }, 0)
    }));
  });
  const lowStockProducts = controlBookBalances.filter(({product,balance}) => balance <= Number(product.minimum_stock));
  function productBookSection(product?: Product, recordedSection?: string | null) {
    if (recordedSection && ["Boxes","Bags","Tamping"].includes(recordedSection)) return recordedSection;
    if (product?.control_book_section && ["Boxes","Bags","Tamping"].includes(product.control_book_section)) return product.control_book_section;
    const label = `${product?.product_code || ""} ${product?.product_name || ""}`.toLowerCase();
    if (/tamp/.test(label)) return "Tamping";
    if (/bag/.test(label)) return "Bags";
    if (/box/.test(label)) return "Boxes";
    return "Unclassified";
  }
  const runningBalances = new Map<string, number>();
  const runningPackageBalances = new Map<string, number>();
  const controlBookEntries = controlBookRows.map(t => {
    const product = products.find(p => p.id === t.product_id);
    const movement = t.transaction_type === "receipt" || t.transaction_type === "return"
      ? Number(t.unit_quantity ?? t.quantity ?? 0)
      : t.transaction_type === "issue" ? -Number(t.unit_quantity ?? t.quantity ?? 0)
      : t.adjustment_direction === "increase" ? Number(t.unit_quantity ?? t.quantity ?? 0) : -Number(t.unit_quantity ?? t.quantity ?? 0);
    const packageMovement = t.transaction_type === "receipt" || t.transaction_type === "return"
      ? Number(t.package_quantity || 0)
      : t.transaction_type === "issue" ? -Number(t.package_quantity || 0)
      : t.adjustment_direction === "increase" ? Number(t.package_quantity || 0) : -Number(t.package_quantity || 0);
    const ledgerKey = t.product_id + "::" + productBookSection(product, t.control_book_section);
    const openingUnits = runningBalances.get(ledgerKey) || 0;
    const openingPackages = runningPackageBalances.get(ledgerKey) || 0;
    const balance = openingUnits + movement;
    const closingPackages = openingPackages + packageMovement;
    runningBalances.set(ledgerKey, balance);
    runningPackageBalances.set(ledgerKey, closingPackages);
    return { ...t, product, movement, balance, openingUnits, openingPackages, closingPackages };
  }).filter(t => (ledgerProduct === "all" || t.product_id === ledgerProduct)
    && (ledgerCategory === "all" || productBookSection(t.product, t.control_book_section) === ledgerCategory)
    && (!ledgerFrom || t.transaction_date.slice(0,10) >= ledgerFrom)
    && (!ledgerTo || t.transaction_date.slice(0,10) <= ledgerTo))
    .reverse();

  if (authChecking) return <main className="shell login-shell"><div className="hero"><div className="eyebrow">CROCODILE RIVER MINE</div><h1>Explosives <em>Management</em></h1><p className="intro">Checking your secure EMS session…</p></div></main>;

  if (resetMode || !user || !profile) return (
    <main className="shell login-shell">
      <header className="topbar"><div className="brand"><img className="brand-logo" src="/crm-logo.svg" alt="Eastplats logo" /><div><strong>CROCODILE RIVER MINE</strong><span>EXPLOSIVES MANAGEMENT SYSTEM</span></div></div><div className="secure">SECURE ACCESS</div></header>
      <section className="hero">
        <div className="eyebrow">CONTROLLED INVENTORY · TRACEABLE APPROVALS</div>
        <h1>Explosives <em>Management</em></h1>
        <p className="intro">One central magazine. Controlled stock movements. Clear accountability and traceable approvals.</p>
        <div className="panel">
          <div className="panel-title">{resetMode ? "SET A NEW PASSWORD" : resetEmailMode ? "CREATE YOUR PASSWORD" : "SYSTEM SIGN IN"}</div>
          <p className="muted">{resetMode ? "You have opened a secure password setup or reset link. Choose a new password to continue." : resetEmailMode ? "We will email you a secure link to create your password." : "Sign in using your authorised EMS account."}</p>
          {resetMode ? (
            <form onSubmit={saveNewPassword}>
              <label>New password</label><input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
              <button disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
              <button type="button" className="link-button" onClick={()=>{setResetMode(false);setError("");setNotice("");}}>Back to sign in</button>
            </form>
          ) : resetEmailMode ? (
            resetRequested ? (
              <div><p className="muted">If this email belongs to an EMS account, a password setup link has been sent. Check your inbox and spam folder.</p><button type="button" className="link-button" onClick={()=>{setResetEmailMode(false);setResetRequested(false);setError("");setNotice("");}}>Back to sign in</button></div>
            ) : (
              <form onSubmit={requestReset}>
                <label>Authorised EMS email address</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required />
                <button disabled={busy}>{busy ? "Sending link…" : "Send password setup link"}</button>
                <button type="button" className="link-button" onClick={()=>{setResetEmailMode(false);setError("");setNotice("");}}>Back to sign in</button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={signIn}>
                <label>Email address</label><input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required />
                <label>Password</label><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required />
                <button disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
              </form>
              <button type="button" className="link-button" onClick={()=>{setResetEmailMode(true);setResetRequested(false);setError("");setNotice("");}}>Create your password / Forgot password</button>
            </>
          )}
          {notice && <div className="feedback success">{notice}</div>}
          {error && <div className="feedback error">{error}</div>}
          <small>AUTHORISED PERSONNEL ONLY · ALL ACCESS IS LOGGED</small>
        </div>
      </section>
      <div className="features"><article><b>01 / CONTROL</b><h3>Central magazine records</h3><p>Maintain one accountable system record for the mine's magazine.</p></article><article><b>02 / ACCOUNTABILITY</b><h3>Role-based access</h3><p>System access is limited according to each approved user profile.</p></article><article><b>03 / TRACEABILITY</b><h3>Auditable records</h3><p>Maintain a clear record of authorised system activity and approvals.</p></article></div>
      <footer>CROCODILE RIVER MINE · EXPLOSIVES MANAGEMENT SYSTEM</footer>
    </main>
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="side-brand"><img className="side-logo" src="/crm-logo.svg" alt="Eastplats logo" /><div><strong>CROCODILE RIVER MINE</strong><span>EXPLOSIVES MANAGEMENT</span></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <button className={section === "overview" ? "nav-item active" : "nav-item"} onClick={() => setSection("overview")}>▤ <span>Home</span></button>
        <button className={section === "products" ? "nav-item active" : "nav-item"} onClick={() => setSection("products")}>▤ <span>Stock</span></button>
        <a className="nav-item" href="/stock-control">⇄ <span>Issue / Return</span></a>
        {profile?.role === "admin" && <button className={section === "people" ? "nav-item active" : "nav-item"} onClick={() => setSection("people")}>♙ <span>Users</span></button>}
        <a className="nav-item" href="/stock-control?tab=audit">◷ <span>Activity history</span></a>
        <div className="nav-caption">MAGAZINE OPERATIONS</div>
        <button className={section === "magazine" ? "nav-item active" : "nav-item"} onClick={() => setSection("magazine")}>▣ <span>Magazine</span></button>
        <button className={section === "daily-orders" ? "nav-item active" : "nav-item"} onClick={() => setSection("daily-orders")}>▧ <span>Daily requests</span></button>
        <button className={section === "control-book" ? "nav-item active" : "nav-item"} onClick={() => setSection("control-book")}>▤ <span>Stock book</span></button>
        <button className={section === "ordering" ? "nav-item active" : "nav-item"} onClick={() => setSection("ordering")}>▧ <span>Supplier orders</span></button>
        <button className={section === "deliveries" ? "nav-item active" : "nav-item"} onClick={() => setSection("deliveries")}>⇩ <span>Receive delivery</span></button>
        <a className="nav-item" href="/compliance">✓ <span>Safety & reports</span></a>
        <a className="nav-item" href="/operations">⇄ <span>Magazine tasks</span></a>
        <a className="nav-item" href="/control-book/new">▤ <span>Add stock entry</span></a>
      </aside>
      <section className="main-area">
        <header className="app-top"><div><span className="crumb">CROCODILE RIVER MINE / EMS</span><h1>{section === "overview" ? "Overview" : section === "products" ? "Explosives inventory" : section === "people" ? "User access" : section === "magazine" ? "Magazine management" : section === "daily-orders" ? "Daily explosive order sheet" : section === "control-book" ? "Explosives control book" : section === "ordering" ? "Explosives & accessories ordering" : section === "deliveries" ? "Supplier delivery receiving" : "Stock records"}</h1></div><div className="top-right"><span className="status-dot"></span> System online <button onClick={loadDashboard} className="refresh-btn">↻ Refresh</button></div></header>
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
              <article className="stat-card"><span>AWAITING APPROVAL</span><strong>{pending}</strong><small>Stock, daily requests, products and supplier orders</small></article>
              <article className="stat-card"><span>LOW STOCK ALERTS</span><strong>{lowStockProducts.length}</strong><small>Products at or below minimum</small></article>
              <article className="stat-card"><span>DOCUMENT REVIEWS</span><strong>{dueDocumentReviews.length}</strong><small>Due or due within 30 days</small></article>
            </div>
            <div className="content-grid">
              <section className="data-card"><div className="card-heading"><div><h3>Recent stock records</h3><p>Latest recorded movements and their current status.</p></div><button className="text-action" onClick={() => setSection("transactions")}>View records →</button></div>
                {transactions.length ? <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>TYPE</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>EMS-{t.transaction_number}</td><td className="capitalize">{t.transaction_type}</td><td>{new Date(t.transaction_date).toLocaleDateString("en-ZA")}</td><td><span className={"state "+t.status}>{t.status.replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">No stock transactions have been recorded yet.</div>}
              </section>
              <section className="data-card quick-card"><div className="card-heading"><div><h3>System shortcuts</h3><p>Manage core EMS setup.</p></div></div><button onClick={() => setSection("magazine")} className="shortcut">▣ <span><b>Magazine configuration</b><small>View the main magazine and responsible person</small></span> →</button><button onClick={() => setSection("people")} className="shortcut">♙ <span><b>User profiles</b><small>Review assigned roles and account status</small></span> →</button><button onClick={() => setSection("products")} className="shortcut">▤ <span><b>Product register</b><small>View registered product records</small></span> →</button><button onClick={() => setSection("daily-orders")} className="shortcut">▧ <span><b>Daily explosive order</b><small>Submit and track daily requirements</small></span> →</button><button onClick={() => setSection("control-book")} className="shortcut">▤ <span><b>Explosives control book</b><small>Review the posted magazine ledger and balances</small></span> →</button><button onClick={() => setSection("ordering")} className="shortcut">▧ <span><b>Explosives & accessories ordering</b><small>Request, approve and track supplier deliveries</small></span> →</button><a href="/stock-control" className="shortcut">▣ <span><b>Stock management & approvals</b><small>Balances, movement approvals, reports and audit trail</small></span> →</a></section>
            </div>
            <section className="data-card wide-card">
              <div className="card-heading"><div><h3>Action required</h3><p>Items that need attention from the magazine or management team.</p></div><span className="role-pill">{lowStockProducts.length + dueDocumentReviews.length + pending} alerts</span></div>
              <div className="content-grid">
                <div>
                  <h4>Low stock</h4>
                  {controlBookBalances.filter(({product,balance})=>balance<=Number(product.minimum_stock)).length ? controlBookBalances.filter(({product,balance})=>balance<=Number(product.minimum_stock)).map(({product,section,balance})=><div className="purchase-history-row" key={product.id+"-"+section}><b>{section} · {product.product_name}</b><small>{balance.toLocaleString("en-ZA")} {product.unit_of_measure} available · Minimum {Number(product.minimum_stock).toLocaleString("en-ZA")}</small></div>) : <p className="muted">No low-stock alerts based on the current posted balances.</p>}
                </div>
                <div>
                  <h4>Document reviews</h4>
                  {dueDocumentReviews.length ? dueDocumentReviews.map(d=><div className="purchase-history-row" key={d.id}><b>{d.document_number} · {d.title}</b><small>Review date: {d.review_date ? new Date(d.review_date+"T00:00:00").toLocaleDateString("en-ZA") : "Not set"}</small></div>) : <p className="muted">No document reviews are due within the next 30 days.</p>}
                  <p className="muted">Pending stock movements: <b>{pendingStock}</b></p><p className="muted">Daily requests awaiting approval: <b>{pendingDaily}</b></p><p className="muted">Product approvals: <b>{pendingProducts}</b></p><p className="muted">Supplier order approvals: <b>{pendingSupplierOrders}</b></p>
                </div>
              </div>
            </section>
          </>}
          {section === "magazine" && <section className="data-card wide-card"><div className="card-heading"><div><h3>Main magazine configuration</h3><p>Maintain the system record and assign the responsible Magazine Master.</p></div><span className="state approved"> {magazine?.is_active ? "Active" : "Inactive"} </span></div>
            {magazine ? <form className="config-form" onSubmit={saveMagazine}><label>Magazine name<input value={magazineName} onChange={e=>setMagazineName(e.target.value)} disabled={!canManageMagazine}/></label><label>Responsible person<select value={responsibleUserId} onChange={e=>setResponsibleUserId(e.target.value)} disabled={!canManageMagazine}><option value="">Not assigned</option>{activePeople.filter(p=>p.role === "magazine_master").map(p=><option key={p.user_id} value={p.user_id}>{p.full_name} — {p.role.replaceAll("_"," ")}</option>)}</select></label><div className="info-note">Only an administrator can change the magazine configuration. The assigned person must have an active EMS profile with the appropriate role.</div>{canManageMagazine && <button className="primary-btn" disabled={busy || !magazineName.trim()}>{busy ? "Saving…" : "Save magazine details"}</button>}{!canManageMagazine && <p className="muted">Your role can view this configuration but cannot edit it.</p>}</form> : <div className="empty-state">The main magazine record was not found. Ask the system administrator to verify the database setup.</div>}
          </section>}
          {section === "people" && <section className="data-card wide-card">
            {profile?.role === "admin" ? <>
              <div className="card-heading"><div><h3>Staff access and responsibilities</h3><p>Invite staff, assign their mine role and deactivate access when they leave or change duties.</p></div><span className="role-pill">{activePeople.length} active</span></div>
              <form className="order-form" onSubmit={inviteEMSUser}>
                <h4>Invite a staff member</h4>
                <div className="order-fields">
                  <label>Full name<input value={inviteFullName} onChange={e=>setInviteFullName(e.target.value)} required placeholder="Staff member's full name" /></label>
                  <label>Work email<input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} required placeholder="name@company.co.za" /></label>
                  <label>EMS role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="issuer">Issuer</option><option value="magazine_master">Magazine Master</option><option value="authorising_officer">Authorising Officer</option><option value="management">Management</option></select></label>
                </div>
                <div className="info-note">An invitation email will be sent. The invited person must set their own password. Administrator access is not assignable from this screen.</div>
                <button className="primary-btn" disabled={busy}>{busy ? "Sending invitation…" : "Send staff invitation"}</button>
              </form>
              <div className="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>ACCESS</th></tr></thead><tbody>{profiles.map(p=><tr key={p.user_id}>
                <td><b>{p.full_name}</b>{p.user_id===user?.id?<div className="order-subtext">Your administrator account</div>:null}</td>
                <td>{p.email}</td>
                <td>{p.user_id===user?.id?<span className="capitalize">{p.role.replaceAll("_"," ")}</span>:<select value={p.role} disabled={busy} onChange={e=>updateEMSUser(p,{role:e.target.value})}><option value="issuer">Issuer</option><option value="magazine_master">Magazine Master</option><option value="authorising_officer">Authorising Officer</option><option value="management">Management</option></select>}</td>
                <td>{p.user_id===user?.id?<span className="state approved">Active</span>:<button type="button" className="mini-action" disabled={busy} onClick={()=>updateEMSUser(p,{is_active:!p.is_active})}>{p.is_active?"Deactivate":"Reactivate"}</button>}</td>
              </tr>)}</tbody></table></div>
              <p className="table-footnote">Only the system administrator can manage staff accounts. Role and access changes are recorded in the activity history.</p>
            </> : <div className="empty-state">Only the System Administrator can manage EMS staff accounts.</div>}
          </section>}
          {section === "products" && <>
            {canManageProducts && <section className="data-card wide-card"><div className="card-heading"><div><h3>Add explosive product</h3><p>Magazine Master or System Administrator submits a product for mine authorisation.</p></div><span className="state pending_approval">Approval required</span></div><form className="order-form" onSubmit={addExplosiveProduct}><div className="order-fields"><label>Product code<input value={productCode} onChange={e=>setProductCode(e.target.value)} placeholder="Mine-approved product code" required /></label><label>Product name<input value={productName} onChange={e=>setProductName(e.target.value)} placeholder="Exact approved product name" required /></label><label>Register<select value={productSection} onChange={e=>setProductSection(e.target.value)} required><option value="Boxes">Boxes register</option><option value="Bags">Bags register</option><option value="Tamping">Tamping register</option></select></label><label>Unit of measure<select value={productUnit} onChange={e=>setProductUnit(e.target.value)}><option value="units">Units</option><option value="boxes">Boxes</option><option value="bags">Bags</option><option value="cases">Cases</option><option value="kg">Kilograms (kg)</option><option value="metres">Metres</option></select></label><label>Minimum stock reference<input type="number" min="0" step="0.001" value={productMinimum} onChange={e=>setProductMinimum(e.target.value)} required /></label></div><label>Supporting note / mine register reference<textarea rows={2} value={productNotes} onChange={e=>setProductNotes(e.target.value)} placeholder="Reference the approved product list or supporting document" /></label><div className="info-note">Use only the exact product name, code and unit shown on the mine-approved explosives register. Submission does not make the product available for stock transactions until an authorised approver approves it.</div><button className="primary-btn" disabled={busy}>{busy ? "Submitting…" : "Submit product for approval"}</button></form></section>}
            <section className="data-card wide-card"><div className="card-heading"><div><h3>Explosive product register</h3><p>Approved product records and minimum-stock reference values. Pending products are excluded from stock transactions.</p></div><span className="role-pill">{activeProducts.length} approved active</span></div>{products.length ? <div className="table-wrap"><table><thead><tr><th>PRODUCT CODE</th><th>PRODUCT NAME</th><th>REGISTER</th><th>UNIT</th><th>MINIMUM STOCK</th><th>APPROVAL</th><th>STATUS / ACTION</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.product_code}</td><td><b>{p.product_name}</b>{p.approval_notes?<div className="order-subtext">{p.approval_notes}</div>:null}</td><td>{p.control_book_section || "Not assigned"}</td><td>{p.unit_of_measure}</td><td>{p.minimum_stock}</td><td><span className={"state "+(p.approval_status==="approved"?"approved":p.approval_status==="rejected"?"rejected":"pending_approval")}>{(p.approval_status||"approved").replaceAll("_"," ")}</span>{p.approved_at?<div className="order-subtext">{new Date(p.approved_at).toLocaleDateString("en-ZA")}</div>:null}</td><td>{p.approval_status==="pending_approval" && canApproveProducts && p.submitted_by!==user?.id ? <span className="action-pair"><button type="button" className="mini-action" disabled={busy} onClick={()=>reviewExplosiveProduct(p,"approved")}>Approve</button><button type="button" className="mini-action danger" disabled={busy} onClick={()=>reviewExplosiveProduct(p,"rejected")}>Reject</button></span> : <span className={"state "+(p.is_active?"approved":"rejected")}>{p.is_active?"Active":"Inactive"}</span>}</td></tr>)}</tbody></table></div> : <div className="empty-state">No mine-approved product records have been entered yet. The Magazine Master can submit products using the form above.</div>}{!canManageProducts && !canApproveProducts && <p className="table-footnote">Your role can view the approved product register but cannot add or approve products.</p>}</section>
          </>}
          {section === "daily-orders" && <section className="daily-orders-layout">
            <section className="data-card wide-card">
              <div className="card-heading"><div><h3>Daily explosives request</h3><p>Enter the shift and work location, then list the explosives needed for the job.</p></div><span className="state pending_approval">New request</span></div>
              <form className="order-form" onSubmit={submitDailyOrder}>
                <h4>1. Work details</h4>
                <div className="order-fields">
                  <label>Date needed<input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)} required /></label>
                  <label>Shift<select value={orderShift} onChange={e=>setOrderShift(e.target.value)}><option value="day">Day shift</option><option value="night">Night shift</option></select></label>
                  <label>Work area / section<input value={workArea} onChange={e=>setWorkArea(e.target.value)} placeholder="e.g. Mining section" required /></label>
                  <label>Blast location<input value={blastSite} onChange={e=>setBlastSite(e.target.value)} placeholder="Where will the explosives be used?" /></label>
                </div>
                <h4>2. Miner who needs the explosives</h4>
                <div className="order-fields">
                  <label>Miner full name<input value={minerName} onChange={e=>setMinerName(e.target.value)} placeholder="Enter miner name and surname" required /></label>
                  <label>Miner company number<input value={minerCompanyNumber} onChange={e=>setMinerCompanyNumber(e.target.value)} placeholder="Enter miner company number" required /></label>
                </div>
                <label>What work will be done?<textarea value={orderPurpose} onChange={e=>setOrderPurpose(e.target.value)} rows={2} placeholder="Briefly describe the planned work" required /></label>
                <div className="order-lines-heading"><h4>3. Explosives needed</h4><button type="button" className="text-action" disabled={activeProducts.length===0} onClick={()=>setDraftOrderItems([...draftOrderItems,{product_id:"",quantity_requested:"",notes:""}])}>+ Add another product</button></div>
                {activeProducts.length===0 ? <div className="info-note"><b>No products are available yet.</b><br />The Administrator or Magazine Master must first add the mine-approved explosives to the Product Register and have them authorised. You can submit a daily request once approved products are available.</div> :
                  draftOrderItems.map((line,index)=><div className="order-line" key={index}>
                    <label>Choose explosive<select value={line.product_id} onChange={e=>setDraftOrderItems(draftOrderItems.map((x,i)=>i===index?{...x,product_id:e.target.value}:x))} required><option value="">Select a product</option>{activeProducts.map(p=><option key={p.id} value={p.id}>{p.product_name} ({p.unit_of_measure})</option>)}</select></label>
                    <label>Quantity needed<input type="number" min="0.001" step="0.001" value={line.quantity_requested} onChange={e=>setDraftOrderItems(draftOrderItems.map((x,i)=>i===index?{...x,quantity_requested:e.target.value}:x))} placeholder="Enter quantity" required /></label>
                    <label>Notes (optional)<input value={line.notes} onChange={e=>setDraftOrderItems(draftOrderItems.map((x,i)=>i===index?{...x,notes:e.target.value}:x))} placeholder="Any details for this item" /></label>
                    {draftOrderItems.length>1 && <button type="button" className="remove-line" onClick={()=>setDraftOrderItems(draftOrderItems.filter((_,i)=>i!==index))}>Remove product</button>}
                  </div>)}
                <div className="info-note">Your name and request details are recorded automatically. The request must be approved before explosives can be issued from the magazine.</div>
                <button className="primary-btn" disabled={busy || activeProducts.length===0}>{busy ? "Submitting…" : "Send request for approval"}</button>
              </form>
            </section>
            <section className="data-card wide-card"><div className="card-heading"><div><h3>Daily requests</h3><p>Check who submitted each request and whether it is awaiting approval or has been fulfilled.</p></div><span className="role-pill">{dailyOrders.length} requests</span></div>
              {dailyOrders.length ? <div className="table-wrap"><table><thead><tr><th>REQUEST</th><th>DATE / SHIFT</th><th>MINER / COMPANY NO.</th><th>REQUESTED BY</th><th>WORK AREA</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{dailyOrders.map(o=>{
                const items=dailyOrderItems.filter(i=>i.order_id===o.id);
                const canPrepareIssue=canFulfilOrders && ["approved","issued_pending_posting"].includes(o.status);
                return <tr key={o.id}>
                  <td><b>{"DO-"+o.order_number}</b><div className="order-subtext">{items.map(i=>{const p=products.find(x=>x.id===i.product_id);return <div key={i.id}>{p?.product_name||"Product"} · Requested {Number(i.quantity_requested).toLocaleString("en-ZA")} {p?.unit_of_measure||""}{o.status==="submitted"&&canApproveOrders?<label style={{display:"inline-flex",alignItems:"center",gap:5,marginLeft:8}}>Approve <input aria-label={"Approved quantity for "+(p?.product_name||"product")} type="number" min="0" max={i.quantity_requested} step="0.001" style={{width:86,padding:4}} value={dailyApprovalQuantities[i.id]??String(i.quantity_requested)} onChange={e=>setDailyApprovalQuantities({...dailyApprovalQuantities,[i.id]:e.target.value})}/></label>:<span> · Approved {i.quantity_approved??"—"} · Issued {i.quantity_issued}</span>}</div>;})}</div></td>
                  <td>{new Date(o.order_date+"T00:00:00").toLocaleDateString("en-ZA")}<div className="order-subtext">{o.shift} shift</div></td>
                  <td>{o.miner_name}<div className="order-subtext">{o.miner_company_number}</div></td>
                  <td>{o.requester_name}</td><td>{o.work_area}{o.blast_site ? <div className="order-subtext">{o.blast_site}</div> : null}</td>
                  <td><span className={"state "+(o.status==="approved"?"approved":o.status==="rejected"?"rejected":o.status==="fulfilled"?"posted":"pending_approval")}>{o.status.replaceAll("_"," ")}</span></td>
                  <td>
                    {canApproveOrders && o.status==="submitted" && <div style={{display:"grid",gap:6,minWidth:150}}><input aria-label="Approval or rejection notes" placeholder="Notes / rejection reason" value={dailyApprovalNotes[o.id]||""} onChange={e=>setDailyApprovalNotes({...dailyApprovalNotes,[o.id]:e.target.value})}/><span className="action-pair"><button className="mini-action" disabled={busy} onClick={()=>updateDailyOrder(o,"approve")}>Approve quantities</button><button className="mini-action danger" disabled={busy} onClick={()=>updateDailyOrder(o,"reject")}>Reject</button></span></div>}
                    {canPrepareIssue && dailyIssueOrderId!==o.id && <button className="mini-action" disabled={busy} onClick={()=>{setDailyIssueOrderId(o.id);setDailyIssueAck(false);}}>{o.status==="approved"?"Prepare issue":"Issue remaining"}</button>}
                    {canPrepareIssue && dailyIssueOrderId===o.id && <div style={{display:"grid",gap:8,minWidth:190}}><label style={{display:"flex",gap:7,alignItems:"flex-start"}}><input type="checkbox" checked={dailyIssueAck} onChange={e=>setDailyIssueAck(e.target.checked)}/> I confirm the named miner has acknowledged receipt.</label><span className="action-pair"><button className="mini-action" disabled={busy||!dailyIssueAck} onClick={()=>updateDailyOrder(o,"fulfil")}>Confirm issue</button><button className="mini-action danger" disabled={busy} onClick={()=>{setDailyIssueOrderId("");setDailyIssueAck(false);}}>Cancel</button></span></div>}
                    {!((canApproveOrders&&o.status==="submitted")||canPrepareIssue) && <span className="order-subtext">—</span>}
                  </td>
                </tr>;
              })}</tbody></table></div> : <div className="empty-state">No daily requests have been submitted yet.</div>}
            </section>
          </section>}

          {section === "ordering" && <section className="purchase-orders-layout">
            <section className="data-card wide-card">
              <div className="card-heading"><div><h3>New explosives & accessories order</h3><p>Submit a supplier order request for the mine's staged review and authorisation.</p></div><span className="state pending_approval">New request</span></div>
              <form className="order-form" onSubmit={submitPurchaseOrder}>
                <div className="order-fields">
                  <label>Supplier name<input value={purchaseSupplier} onChange={e=>setPurchaseSupplier(e.target.value)} placeholder="Supplier / authorised distributor" required /></label>
                  <label>Supplier contact<input value={purchaseContact} onChange={e=>setPurchaseContact(e.target.value)} placeholder="Contact person or telephone" /></label>
                  <label>Supplier email<input type="email" value={purchaseEmail} onChange={e=>setPurchaseEmail(e.target.value)} placeholder="Supplier email address" /></label>
                  <label>Supplier quotation reference<input value={purchaseQuoteRef} onChange={e=>setPurchaseQuoteRef(e.target.value)} placeholder="Quotation number (if available)" /></label>
                  <label>Supplier reference<input value={purchaseSupplierRef} onChange={e=>setPurchaseSupplierRef(e.target.value)} placeholder="Supplier account / reference" /></label>
                  <label>Order date<input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)} required /></label>
                  <label>Required delivery date<input type="date" value={purchaseRequiredDate} onChange={e=>setPurchaseRequiredDate(e.target.value)} /></label>
                  <label>Work area / department<input value={purchaseWorkArea} onChange={e=>setPurchaseWorkArea(e.target.value)} placeholder="Department or mining section" required /></label>
                </div>
                <label>Purpose / reason for order<textarea value={purchasePurpose} onChange={e=>setPurchasePurpose(e.target.value)} rows={3} placeholder="Explain the business requirement for this order" required /></label>
                <div className="order-lines-heading"><h4>Explosives and accessories requested</h4><button type="button" className="text-action" onClick={()=>setPurchaseLines([...purchaseLines,{product_id:"",item_description:"",quantity:"",unit_of_measure:"units",notes:""}])}>+ Add item</button></div>
                {purchaseLines.map((line,index)=><div className="order-line purchase-line" key={index}>
                  <label>Registered product (required for stock tracking)<select required value={line.product_id} onChange={e=>{const selected=products.find(p=>p.id===e.target.value);setPurchaseLines(purchaseLines.map((x,i)=>i===index?{...x,product_id:e.target.value,item_description:selected?.product_name||"",unit_of_measure:selected?.unit_of_measure||x.unit_of_measure}:x));}}><option value="">Select approved product</option>{activeProducts.map(p=><option key={p.id} value={p.id}>{p.product_code} — {p.product_name}</option>)}</select></label>
                  <label>Item description<input value={line.item_description} onChange={e=>setPurchaseLines(purchaseLines.map((x,i)=>i===index?{...x,item_description:e.target.value}:x))} placeholder="Explosive or accessory description" required /></label>
                  <label>Quantity<input type="number" min="0.001" step="0.001" value={line.quantity} onChange={e=>setPurchaseLines(purchaseLines.map((x,i)=>i===index?{...x,quantity:e.target.value}:x))} required /></label>
                  <label>Unit<input value={line.unit_of_measure} onChange={e=>setPurchaseLines(purchaseLines.map((x,i)=>i===index?{...x,unit_of_measure:e.target.value}:x))} placeholder="e.g. units, boxes, kg" required /></label>
                  <label>Line notes<input value={line.notes} onChange={e=>setPurchaseLines(purchaseLines.map((x,i)=>i===index?{...x,notes:e.target.value}:x))} placeholder="Optional item notes" /></label>
                  {purchaseLines.length>1 && <button type="button" className="remove-line" onClick={()=>setPurchaseLines(purchaseLines.filter((_,i)=>i!==index))}>Remove item</button>}
                </div>)}
                <div className="info-note">Approval sequence: Shiftboss review → Magazine Master review → Mine Overseer approval. The approver's decision, name, date and comments are retained in the approval history.</div>
                <button className="primary-btn" disabled={busy}>{busy ? "Submitting…" : "Submit order for approval"}</button>
              </form>
            </section>

            <section className="data-card wide-card">
              <div className="card-heading"><div><h3>Supplier order register</h3><p>Order requests, staged approvals, supplier placement and recorded deliveries.</p></div><span className="role-pill">{purchaseOrders.length} orders</span></div>
              {purchaseOrders.length ? <div className="purchase-order-list">
                {purchaseOrders.map(o=>{
                  const items=purchaseOrderItems.filter(i=>i.order_id===o.id);
                  const approvals=purchaseApprovals.filter(a=>a.order_id===o.id);
                  const deliveries=purchaseDeliveries.filter(d=>d.order_id===o.id);
                  const outstanding=(item:PurchaseOrderItem)=>Number(item.quantity)-purchaseDeliveryItems.filter(d=>d.order_item_id===item.id).reduce((sum,d)=>sum+Number(d.quantity_received),0);
                  const awaitingShift=o.status==="pending_shift_boss";
                  const awaitingMagazine=o.status==="pending_magazine_master";
                  const awaitingMine=o.status==="pending_mine_overseer";
                  const canReview=(awaitingShift&&canShiftBossReview)||(awaitingMagazine&&canMagazineMasterReview)||(awaitingMine&&canMineOverseerReview);
                  return <article className="purchase-order-card" key={o.id}>
                    <div className="purchase-order-head">
                      <div><span className="order-subtext">PURCHASE REQUEST · PO-{o.order_number}</span><h4>{o.supplier_name}</h4><p>{o.work_area} · Requested by {o.requester_name}</p></div>
                      <span className={"state "+(o.status==="approved"||o.status==="ordered"||o.status==="delivered"?"approved":o.status==="rejected"?"rejected":"pending_approval")}>{o.status.replaceAll("_"," ")}</span>
                    </div>
                    <div className="purchase-order-meta">
                      <span><b>Order date</b>{new Date(o.order_date+"T00:00:00").toLocaleDateString("en-ZA")}</span>
                      <span><b>Required delivery</b>{o.required_delivery_date?new Date(o.required_delivery_date+"T00:00:00").toLocaleDateString("en-ZA"):"Not specified"}</span>
                      <span><b>Quotation</b>{o.quotation_reference||"—"}</span>
                      <span><b>Supplier order no.</b>{o.supplier_order_number||"Not placed"}</span>
                    </div>
                    <p className="purchase-purpose">{o.purpose}</p>
                    <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>ORDER QTY</th><th>RECEIVED</th><th>OUTSTANDING</th><th>UNIT</th></tr></thead><tbody>{items.map(i=>{
                      const received=Number(i.quantity)-outstanding(i);
                      return <tr key={i.id}><td><b>{i.item_description}</b>{i.notes?<div className="order-subtext">{i.notes}</div>:null}</td><td>{Number(i.quantity).toLocaleString("en-ZA")}</td><td>{received.toLocaleString("en-ZA")}</td><td>{outstanding(i).toLocaleString("en-ZA")}</td><td>{i.unit_of_measure}</td></tr>;
                    })}</tbody></table></div>
                    <div className="purchase-history"><b>Approval history</b>
                      {approvals.length?approvals.map(a=><div className="purchase-history-row" key={a.id}><span>{a.approval_stage.replaceAll("_"," ")}</span><span>{a.decision}</span><small>{new Date(a.actioned_at).toLocaleString("en-ZA")} · {a.actioned_by_name}{a.comments?" · "+a.comments:""}</small></div>):<p className="order-subtext">No approval decisions recorded yet.</p>}
                    </div>
                    {deliveries.length>0 && <div className="purchase-history"><b>Delivery records</b>{deliveries.map(d=><div className="purchase-history-row" key={d.id}><span>DN: {d.supplier_delivery_note}</span><span>{new Date(d.received_date+"T00:00:00").toLocaleDateString("en-ZA")}</span><small>{purchaseDeliveryItems.filter(x=>x.delivery_id===d.id).reduce((sum,x)=>sum+Number(x.quantity_received),0).toLocaleString("en-ZA")} total units recorded · Received by {d.received_by_name}{d.notes?" · "+d.notes:""}</small></div>)}</div>}
                    {canReview && <div className="purchase-actions">
                      <label>Approval comments<input value={purchaseComment} onChange={e=>setPurchaseComment(e.target.value)} placeholder="Optional review comments" /></label>
                      <div className="action-pair"><button className="mini-action" disabled={busy} onClick={()=>processPurchaseApproval(o,"approve")}>Approve</button><button className="mini-action danger" disabled={busy} onClick={()=>processPurchaseApproval(o,"reject")}>Reject</button></div>
                      <small>Current stage: {awaitingShift?"Shiftboss":awaitingMagazine?"Magazine Master":"Mine Overseer"}</small>
                    </div>}
                    {canPlacePurchaseOrder&&o.status==="approved"&&<div className="purchase-actions">
                      {placingOrderId===o.id?<form className="inline-order-form" onSubmit={e=>placePurchaseOrder(e,o)}><label>Supplier purchase order number<input value={supplierOrderNumber} onChange={e=>setSupplierOrderNumber(e.target.value)} required /></label><button className="mini-action" disabled={busy}>Save supplier order</button><button type="button" className="remove-line" onClick={()=>setPlacingOrderId("")}>Cancel</button></form>:<button className="mini-action" onClick={()=>{setPlacingOrderId(o.id);setSupplierOrderNumber("");}}>Record supplier order placement</button>}
                    </div>}
                    {canRecordPurchaseDelivery&&["approved","ordered","partially_delivered"].includes(o.status)&&<div className="purchase-actions">
                      {deliveryOrderId===o.id?<form className="order-form delivery-form" onSubmit={e=>submitPurchaseDelivery(e,o)}>
                        <h4>Record supplier delivery</h4>
                        <div className="order-fields"><label>Supplier delivery note<input value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)} required /></label><label>Received date<input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} required /></label></div>
                        {items.filter(i=>outstanding(i)>0).map(i=><label key={i.id}>{i.item_description} · Outstanding {outstanding(i).toLocaleString("en-ZA")} {i.unit_of_measure}<input type="number" min="0" max={outstanding(i)} step="0.001" value={deliveryQuantities[i.id]||""} onChange={e=>setDeliveryQuantities({...deliveryQuantities,[i.id]:e.target.value})} placeholder="Quantity received now" /></label>)}
                        <label>Delivery notes<textarea rows={2} value={deliveryNotes} onChange={e=>setDeliveryNotes(e.target.value)} /></label>
                        <div className="action-pair"><button className="mini-action" disabled={busy}>Save delivery</button><button type="button" className="remove-line" onClick={()=>setDeliveryOrderId("")}>Cancel</button></div>
                      </form>:<button className="mini-action" onClick={()=>{setDeliveryOrderId(o.id);setDeliveryNote("");setDeliveryDate(new Date().toISOString().slice(0,10));setDeliveryNotes("");setDeliveryQuantities({});}}>Record delivery</button>}
                    </div>}
                  </article>;
                })}
              </div>:<div className="empty-state">No supplier orders have been submitted yet. Create the first order above.</div>}
            </section>
          </section>}

          {section === "deliveries" && <section className="purchase-orders-layout">
            <section className="data-card wide-card">
              <div className="card-heading"><div><h3>Receive a delivery</h3><p>Choose an order, enter what arrived, and save. You can record a delivery in more than one part.</p></div><span className="role-pill">Delivery receiving</span></div>
              {!canRecordPurchaseDelivery ? <div className="empty-state">Only the Administrator or Magazine Master can receive deliveries. Your account does not have permission.</div> :
                purchaseOrders.filter(o=>["approved","ordered","partially_delivered"].includes(o.status)).length ? <div className="purchase-order-list">
                  {purchaseOrders.filter(o=>["approved","ordered","partially_delivered"].includes(o.status)).map(o=>{
                    const items=purchaseOrderItems.filter(i=>i.order_id===o.id);
                    const outstanding=(item:PurchaseOrderItem)=>Number(item.quantity)-purchaseDeliveryItems.filter(d=>d.order_item_id===item.id).reduce((sum,d)=>sum+Number(d.quantity_received),0);
                    return <article className="purchase-order-card" key={o.id}>
                      <div className="purchase-order-head">
                        <div><span className="order-subtext">SUPPLIER ORDER · PO-{o.order_number}</span><h4>{o.supplier_name}</h4><p>{o.supplier_order_number ? "Supplier PO: "+o.supplier_order_number : "Supplier order reference not yet recorded"} · {o.work_area}</p></div>
                        <span className={"state "+(o.status==="partially_delivered"?"pending_approval":"approved")}>{o.status.replaceAll("_"," ")}</span>
                      </div>
                      <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>ORDERED</th><th>RECEIVED</th><th>LEFT TO RECEIVE</th><th>UNIT</th></tr></thead><tbody>{items.map(i=>{
                        const received=Number(i.quantity)-outstanding(i);
                        return <tr key={i.id}><td><b>{i.item_description}</b></td><td>{Number(i.quantity).toLocaleString("en-ZA")}</td><td>{received.toLocaleString("en-ZA")}</td><td><b>{outstanding(i).toLocaleString("en-ZA")}</b></td><td>{i.unit_of_measure}</td></tr>;
                      })}</tbody></table></div>
                      <div className="purchase-actions">
                        {deliveryOrderId===o.id?<form className="order-form delivery-form" onSubmit={e=>submitPurchaseDelivery(e,o)}>
                          <h4>What arrived today?</h4>
                          <div className="order-fields"><label>Delivery note number<input value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)} required /></label><label>Date received<input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} required /></label></div>
                          <div className="info-note">Enter the amount that arrived today. Do not enter the full order amount unless it all arrived.</div>
                          {items.filter(i=>outstanding(i)>0).map(i=><label key={i.id}>{i.item_description} · Ordered {Number(i.quantity).toLocaleString("en-ZA")} · Already delivered { (Number(i.quantity)-outstanding(i)).toLocaleString("en-ZA")} · Still outstanding {outstanding(i).toLocaleString("en-ZA")} {i.unit_of_measure}<input type="number" min="0" max={outstanding(i)} step="0.001" value={deliveryQuantities[i.id]||""} onChange={e=>setDeliveryQuantities({...deliveryQuantities,[i.id]:e.target.value})} placeholder="Received today" /></label>)}
                          <label>Delivery notes<textarea rows={2} value={deliveryNotes} onChange={e=>setDeliveryNotes(e.target.value)} /></label>
                          <div className="action-pair"><button className="mini-action" disabled={busy}>{busy?"Saving delivery…":"Save delivery"}</button><button type="button" className="remove-line" onClick={()=>setDeliveryOrderId("")}>Cancel</button></div>
                        </form>:<button className="mini-action" onClick={()=>{setDeliveryOrderId(o.id);setDeliveryNote("");setDeliveryDate(new Date().toISOString().slice(0,10));setDeliveryNotes("");setDeliveryQuantities({});}}>＋ Receive this order</button>}
                      </div>
                      {purchaseDeliveries.filter(d=>d.order_id===o.id).length>0 && <div className="purchase-history"><b>Previous delivery notes</b>{purchaseDeliveries.filter(d=>d.order_id===o.id).map(d=><div className="purchase-history-row" key={d.id}><span>{d.supplier_delivery_note}</span><span>{new Date(d.received_date+"T00:00:00").toLocaleDateString("en-ZA")}</span><small>Received by {d.received_by_name}</small></div>)}</div>}
                    </article>;
                  })}
                </div>:<div className="empty-state">No orders are ready to receive yet. An order will appear here after it has been approved.</div>}
            </section>
          </section>}

          {section === "control-book" && <section className="control-book-layout">
            <section className="data-card wide-card">
              <div className="card-heading"><div><h3>Magazine stock position</h3><p>Calculated from posted receipts, issues, returns and authorised adjustments only.</p></div><span className="role-pill">{controlBookRows.length} posted movements</span></div>
              <div className="balance-grid">
                {controlBookBalances.map(({product,section,balance}) => <article className="balance-card" key={product.id+"-"+section}><span>{section} · {product.product_code}</span><strong>{balance.toLocaleString("en-ZA",{maximumFractionDigits:3})}</strong><small>{product.product_name} · {product.unit_of_measure}</small><em>{balance <= Number(product.minimum_stock) ? "At or below minimum stock" : "Above minimum stock"}</em></article>)}
                {controlBookBalances.length===0 && <div className="empty-state">Add mine-approved products to the Product Register to see their balances.</div>}
              </div>
            </section>
            <section className="data-card wide-card">
              <div className="card-heading"><div><h3>Explosives control book</h3><p>Chronological, read-only register of posted magazine movements.</p></div><button className="text-action" type="button" onClick={()=>window.print()}>Print control book ↗</button></div>
              <div className="ledger-filters">
                <label>Control-book section<select value={ledgerCategory} onChange={e=>setLedgerCategory(e.target.value)}><option value="all">All sections</option><option value="Boxes">Boxes</option><option value="Bags">Bags</option><option value="Tamping">Tamping</option><option value="Unclassified">Unclassified products</option></select></label>
                <label>Product<select value={ledgerProduct} onChange={e=>setLedgerProduct(e.target.value)}><option value="all">All products</option>{activeProducts.map(p=><option key={p.id} value={p.id}>{p.product_code} — {p.product_name}</option>)}</select></label>
                <label>From date<input type="date" value={ledgerFrom} onChange={e=>setLedgerFrom(e.target.value)} /></label>
                <label>To date<input type="date" value={ledgerTo} onChange={e=>setLedgerTo(e.target.value)} /></label>
                <button type="button" className="text-action" onClick={()=>{setLedgerProduct("all");setLedgerCategory("all");setLedgerFrom("");setLedgerTo("");}}>Clear filters</button>
              </div>
              <div className="info-note">This register follows MIN-DOC-0052: Boxes, Bags and Tamping. Each posted movement can retain the box/bag number, type, description, package and unit quantities, work section, miner company number, miner name and digital acknowledgement. Legacy movements remain visible; fields not captured on older records display as blank. Only posted movements affect balances.</div>
              {controlBookEntries.length ? <div className="table-wrap"><table className="ledger-table"><thead><tr><th>DATE</th><th>BOOK REF.</th><th>SECTION / PRODUCT</th><th>BOX / BAG NO.</th><th>TYPE / DESCRIPTION</th><th>OPENING</th><th>RECEIVED</th><th>ISSUED</th><th>WORK SECTION</th><th>MINER COMPANY NO.</th><th>MINER NAME / ACKNOWLEDGEMENT</th><th>RETURNED</th><th>ADJUSTMENT / OPENING BALANCE</th><th>CLOSING</th><th>REFERENCE / NOTES</th></tr></thead><tbody>{controlBookEntries.map(t=><tr key={t.id}><td>{new Date(t.transaction_date).toLocaleDateString("en-ZA")}</td><td><b>EMS-{t.transaction_number}</b></td><td><b>{productBookSection(t.product,t.control_book_section)}</b><div className="order-subtext">{t.product?.product_name || "Product unavailable"} · {t.product?.product_code || ""}</div></td><td>{t.container_number || "—"}</td><td>{t.item_type || "—"}<div className="order-subtext">{t.item_description || ""}</div></td><td>{Number(t.openingPackages||0).toLocaleString("en-ZA")} boxes/bags · {Number(t.openingUnits||0).toLocaleString("en-ZA")} units</td><td>{t.transaction_type==="receipt" ? Number(t.package_quantity||0).toLocaleString("en-ZA")+" boxes/bags · "+Number(t.unit_quantity||0).toLocaleString("en-ZA")+" units" : "—"}</td><td>{t.transaction_type==="issue" ? Number(t.package_quantity||0).toLocaleString("en-ZA")+" boxes/bags · "+Number(t.unit_quantity||0).toLocaleString("en-ZA")+" units" : "—"}</td><td>{t.work_section || t.source_or_destination || "—"}</td><td>{t.miner_company_number || "—"}</td><td>{t.miner_name || t.issued_to || "—"}<div className="order-subtext">{t.miner_acknowledged ? "Acknowledged digitally" : "No digital acknowledgement"}</div></td><td>{t.transaction_type==="return" ? Number(t.package_quantity||0).toLocaleString("en-ZA")+" boxes/bags · "+Number(t.unit_quantity||0).toLocaleString("en-ZA")+" units" : "—"}</td><td>{t.transaction_type==="adjustment" ? <><b>{t.adjustment_direction==="increase"&&t.openingUnits===0 ? "Opening balance: " : t.adjustment_direction==="increase" ? "Increase: " : "Decrease: "}</b>{Number(t.package_quantity||0).toLocaleString("en-ZA")} boxes/bags · {Number(t.unit_quantity||0).toLocaleString("en-ZA")} units</> : "—"}</td><td><b>{Number(t.closingPackages||0).toLocaleString("en-ZA")} boxes/bags · {t.balance.toLocaleString("en-ZA",{maximumFractionDigits:3})} units</b></td><td>{t.reference_number || "—"}{t.purpose ? <div className="order-subtext">{t.purpose}</div> : null}{t.notes ? <div className="order-subtext">{t.notes}</div> : null}</td></tr>)}</tbody></table></div> : <div className="empty-state">No posted stock movements match these filters. Record and post a receipt, issue, return or adjustment to begin the control book.</div>}
              <p className="table-footnote">Running balances are calculated in transaction date and transaction number order for each product. Records are read-only in this module; corrections must follow the authorised stock transaction process.</p>
            </section>
          </section>}
          {section === "transactions" && <section className="data-card wide-card"><div className="card-heading"><div><h3>Stock transaction records</h3><p>Recorded receipts, issues, returns and adjustments. This view is read-only.</p></div><span className="role-pill">Latest 8 records</span></div>{transactions.length ? <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>TYPE</th><th>DATE</th><th>QUANTITY</th><th>STATUS</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>EMS-{t.transaction_number}</td><td className="capitalize">{t.transaction_type}</td><td>{new Date(t.transaction_date).toLocaleString("en-ZA")}</td><td>{t.quantity}</td><td><span className={"state "+t.status}>{t.status.replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div> : <div className="empty-state">No stock transaction records are available yet.</div>}</section>}
          <footer className="app-footer">CROCODILE RIVER MINE · EXPLOSIVES MANAGEMENT SYSTEM · AUTHORISED ACCESS ONLY</footer>
        </div>
      </section>
    </main>
  );
}
