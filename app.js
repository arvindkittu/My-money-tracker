"use strict";
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s), KEY = "mm3", TW = 27;
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => iso(new Date());
const r2 = n => Math.round(n * 100) / 100;
const fmt = n => "₹" + (+n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mname = (k, o) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString("en-IN", o || { month: "long" });
const sum = a => r2(a.reduce((s, t) => s + t.amount, 0));
const DC = {
  expense: [["Food", "🍔", "#f59e0b"], ["Bills", "🧾", "#a78bfa"], ["Home", "🏠", "#34d399"], ["Health", "🏥", "#f87171"], ["EMI", "🏦", "#fb923c"], ["Travel", "🚗", "#60a5fa"], ["Shopping", "🛍️", "#f472b6"], ["Other", "📦", "#9ca3af"]],
  income: [["Salary", "💼", "#34d399"], ["Business", "🏢", "#f59e0b"], ["Side income", "💻", "#60a5fa"], ["Bonus", "🎉", "#f472b6"], ["Interest", "📈", "#a78bfa"], ["Other", "💰", "#9ca3af"]]
};
const fresh = () => ({ tx: [], budgets: {}, cats: JSON.parse(JSON.stringify(DC)), name: "My Money", del: {}, su: 0 });
let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!S || !Array.isArray(S.tx)) S = fresh();
S.del = S.del || {}; S.su = S.su || 0;
const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert("Could not save data on this device."); } };
const save = () => { saveLocal(); schedSync(); };
let type = "expense", range = "1M", vm = today().slice(0, 7), D = null, B = 0, tab = "insights";
const budgetFor = m => { const k = Object.keys(S.budgets).filter(x => x <= m).sort().pop(); return k ? S.budgets[k] : 0; };
const catInfo = (t, n) => S.cats[t].find(c => c[0] === n) || ["Other", "📦", "#9ca3af"];
const sheet = $("#sheet"), scrim = $("#scrim");
const showSheet = () => { scrim.classList.add("on"); sheet.classList.add("open"); };
const hideSheet = () => { scrim.classList.remove("on"); sheet.classList.remove("open"); if (document.activeElement) document.activeElement.blur(); };
scrim.onclick = hideSheet;

/* ---------- Dashboard ---------- */
function render() {
  $$("#typeSeg button").forEach(b => b.classList.toggle("on", b.dataset.t === type));
  $$("#rangeSeg button").forEach(b => b.classList.toggle("on", b.dataset.r === range));
  const yr = String(new Date().getFullYear()), all = S.tx.filter(t => t.type === type);
  const list = range === "1M" ? all.filter(t => t.date.startsWith(vm)) : range === "1Y" ? all.filter(t => t.date.startsWith(yr)) : all;
  $("#period").textContent = range === "1M" ? mname(vm) : range === "1Y" ? yr : "All time";
  const tot = sum(list), bud = budgetFor(vm), isB = type === "expense" && range === "1M";
  $("#total").textContent = fmt(tot);
  const bl = $("#bl");
  bl.textContent = isB ? (bud ? "of " + fmt(bud) + " budget" : "Set a budget") : "";
  bl.className = "bl" + (isB && bud && tot > bud ? " over" : "");
  chart(list);
  const L = $("#list");
  if (!list.length) { L.innerHTML = '<div class="empty">No transactions yet</div>'; return; }
  if (range === "1M") {
    L.innerHTML = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.u || 0) - (a.u || 0)).map(t =>
      `<button class="row" data-id="${esc(t.id)}"><div class="badge">${t.date.slice(8)}<small>${mname(t.date, { month: "short" }).toUpperCase()}</small></div><span class="n">${esc(t.note || t.cat)}</span><span class="a ${type}">${fmt(t.amount)}</span></button>`).join("");
  } else {
    const by = {}; list.forEach(t => { const k = t.date.slice(0, 7); by[k] = (by[k] || 0) + t.amount; });
    L.innerHTML = Object.keys(by).sort().reverse().map(k =>
      `<button class="row mr" data-m="${k}"><span class="n">${mname(k)}${range === "All" ? " " + k.slice(0, 4) : ""}</span><span class="a ${type}">${fmt(r2(by[k]))}</span><span class="chev">›</span></button>`).join("");
  }
}

function chart(list) {
  const c = $("#chart"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
  c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext("2d"); x.scale(dpr, dpr);
  const keys = [], lab = [], now = new Date(), tk = today();
  if (range === "1M") {
    const y = +vm.slice(0, 4), m = +vm.slice(5, 7), n = new Date(y, m, 0).getDate();
    for (let d = 1; d <= n; d++) { keys.push(vm + "-" + pad(d)); lab.push(d); }
  } else {
    let sy = now.getFullYear(), sm = 0, cnt = 12;
    if (range === "All") {
      const f = list.map(t => t.date.slice(0, 7)).sort()[0];
      if (f) { sy = +f.slice(0, 4); sm = +f.slice(5, 7) - 1; }
      else { sm = now.getMonth(); }
      cnt = Math.max(1, (now.getFullYear() - sy) * 12 + now.getMonth() - sm + 1);
    }
    for (let i = 0; i < cnt; i++) {
      const d = new Date(sy, sm + i, 1);
      keys.push(d.getFullYear() + "-" + pad(d.getMonth() + 1));
      lab.push(d.toLocaleDateString("en", { month: "narrow" }));
    }
  }
  const vals = keys.map(k => list.filter(t => t.date.startsWith(k)).reduce((a, t) => a + t.amount, 0));
  const L = 26, R = 26, top = 10, base = H - 46, slot = (W - L - R) / keys.length;
  const bw = Math.min(range === "1M" ? 12 : 30, slot * .55), max = Math.max(1, ...vals);
  x.strokeStyle = "#333"; x.lineWidth = 1.2; x.setLineDash([5, 6]);
  x.beginPath(); x.moveTo(L, base); x.lineTo(W - R, base); x.stroke(); x.setLineDash([]);
  const td = +today().slice(8), isCur = range === "1M" && vm === tk.slice(0, 7);
  x.font = "15px -apple-system,sans-serif"; x.textAlign = "center";
  vals.forEach((v, i) => {
    const cx = L + slot * (i + .5);
    if (v > 0) {
      const h = Math.max(4, (base - top) * v / max);
      x.fillStyle = type === "expense" ? "#ff5f5f" : "#4ade80";
      x.beginPath(); (x.roundRect || x.rect).call(x, cx - bw / 2, base - h, bw, h, 4); x.fill();
    }
    const d = lab[i];
    const show = range !== "1M" || d === 1 || (isCur && d === td) || (d >= 9 && (d - 9) % 4 === 0 && !(isCur && Math.abs(d - td) < 3));
    if (show) { x.fillStyle = "#cfcfcf"; x.fillText(String(d), cx, H - 14); }
    if (isCur && d === td) { x.fillStyle = "#4ade80"; x.beginPath(); x.arc(cx, base - 12, 3.5, 0, 7); x.fill(); }
  });
}

/* ---------- Add / edit sheet ---------- */
function openAdd(t) {
  D = t ? { id: t.id, type: t.type, amt: String(t.amount), note: t.note || "", cat: t.cat, date: t.date, panel: "keys" }
        : { type, amt: "", note: "", cat: type === "expense" ? "Other" : "Salary", date: today(), panel: "keys" };
  D.cm = D.date.slice(0, 7); sheet.className = "sheet"; drawAdd(); showSheet();
}
function calendar() {
  const y = +D.cm.slice(0, 4), m = +D.cm.slice(5, 7), first = new Date(y, m - 1, 1), off = (first.getDay() + 6) % 7;
  const n = new Date(y, m, 0).getDate(), t = today();
  let h = `<div class="cal"><div class="ch"><button data-cm="-1">‹</button><b>${first.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b><button data-cm="1" ${D.cm >= t.slice(0, 7) ? "disabled" : ""}>›</button></div><div class="cg">`
    + "MTWTFSS".split("").map(d => `<small>${d}</small>`).join("") + "<span></span>".repeat(off);
  for (let d = 1; d <= n; d++) {
    const ds = D.cm + "-" + pad(d), f = ds > t;
    h += `<button data-d="${ds}" class="${ds === D.date ? "sel" : ""} ${f ? "fut" : ""}" ${f ? "disabled" : ""}>${d}</button>`;
  }
  return h + "</div></div>";
}
function drawAdd() {
  const c = catInfo(D.type, D.cat);
  let body;
  if (D.panel === "cats") {
    body = '<div class="cats">' + S.cats[D.type].map(k => `<button class="crow" data-cat="${esc(k[0])}"><span class="ce">${k[1]}</span><span class="cn">${esc(k[0])}</span><i style="background:${k[2]}"></i><b>${k[0] === D.cat ? "✓" : ""}</b></button>`).join("")
      + '<button class="crow" id="addCat"><span class="ce">＋</span><span class="cn">Add category</span></button></div>';
  } else if (D.panel === "cal") body = calendar();
  else body = '<div class="keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join("") + '<button data-k="<">‹</button><button data-k="0">0</button><button class="save" data-k="save">Save</button></div>';
  const dl = D.date === today() ? "Today" : new Date(+D.date.slice(0, 4), +D.date.slice(5, 7) - 1, +D.date.slice(8)).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  sheet.classList.toggle("p", D.panel !== "keys");
  sheet.innerHTML = `<div class="hd"></div>${D.id ? '<button class="del" id="delTx">Delete</button>' : ""}
  <div class="seg mid"><button data-st="expense" class="${D.type === "expense" ? "on" : ""}">Expense</button><button data-st="income" class="${D.type === "income" ? "on" : ""}">Income</button></div>
  <div class="amt ${D.amt ? "" : "z"}" id="amt"><span>₹</span>${D.amt || 0}</div>
  <input class="note" id="note" placeholder="Description" maxlength="60" value="${esc(D.note)}">
  <div class="chips"><button class="chip" id="catBtn">${c[1]} ${esc(c[0])} ⌄</button><button class="chip" id="dateBtn">📅 ${dl}</button></div>${body}`;
}
function key(k) {
  if (k === "save") return saveTx();
  if (k === "<") D.amt = D.amt.slice(0, -1);
  else if (D.amt.length < 9 && !(D.amt === "" && k === "0")) D.amt += k;
  const a = $("#amt"); a.innerHTML = "<span>₹</span>" + (D.amt || 0); a.classList.toggle("z", !D.amt);
}
function saveTx() {
  const a = +D.amt || 0;
  if (!(a > 0)) { alert("Enter an amount greater than zero."); return; }
  const tx = { id: D.id || crypto.randomUUID(), type: D.type, amount: a, date: D.date, note: D.note.trim(), cat: D.cat, u: Date.now() };
  const i = S.tx.findIndex(t => t.id === tx.id);
  if (i >= 0) S.tx[i] = tx; else S.tx.push(tx);
  save(); hideSheet(); type = tx.type; vm = tx.date.slice(0, 7); range = "1M"; render();
}
sheet.oninput = e => { if (e.target.id === "note") D.note = e.target.value; };
sheet.onkeydown = e => { if (e.key === "Enter") e.target.blur(); };
sheet.onclick = e => {
  const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
  if (d.st) { D.type = d.st; if (!S.cats[D.type].some(c => c[0] === D.cat)) D.cat = D.type === "expense" ? "Other" : "Salary"; D.panel = "keys"; drawAdd(); }
  else if (d.k !== undefined) key(d.k);
  else if (d.cat !== undefined) { D.cat = d.cat; D.panel = "keys"; drawAdd(); }
  else if (b.id === "catBtn") { D.panel = D.panel === "cats" ? "keys" : "cats"; drawAdd(); }
  else if (b.id === "dateBtn") { D.panel = D.panel === "cal" ? "keys" : "cal"; drawAdd(); }
  else if (b.id === "addCat") {
    const n = (prompt("Category name") || "").trim().slice(0, 20), list = S.cats[D.type];
    if (n && !list.some(c => c[0].toLowerCase() === n.toLowerCase())) {
      const em = (prompt("Emoji (optional)") || "").trim() || "🏷️";
      list.splice(list.length - 1, 0, [n, em, ["#f59e0b", "#60a5fa", "#f472b6", "#34d399", "#a78bfa"][n.length % 5]]);
      S.su = Date.now(); save(); D.cat = n; D.panel = "keys"; drawAdd();
    }
  }
  else if (d.cm) { const dt = new Date(+D.cm.slice(0, 4), +D.cm.slice(5, 7) - 1 + +d.cm, 1); D.cm = dt.getFullYear() + "-" + pad(dt.getMonth() + 1); drawAdd(); }
  else if (d.d) { D.date = d.d; D.panel = "keys"; drawAdd(); }
  else if (b.id === "delTx") { if (confirm("Delete this transaction?")) { S.del[D.id] = Date.now(); S.tx = S.tx.filter(t => t.id !== D.id); save(); hideSheet(); render(); } }
  else if (b.id === "setBudget") { if (B > 0) S.budgets[vm] = B; else delete S.budgets[vm]; S.su = Date.now(); save(); hideSheet(); render(); }
};

/* ---------- Budget sheet ---------- */
function openBudget() {
  B = budgetFor(vm) || 50000;
  const pk = iso(new Date(+vm.slice(0, 4), +vm.slice(5, 7) - 2, 1)).slice(0, 7);
  const sp = sum(S.tx.filter(t => t.type === "expense" && t.date.startsWith(pk))), pb = budgetFor(pk);
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><h3>Set your ${mname(vm)} budget</h3><p class="sub">How much do you want to spend this month?</p>
  <div class="big" id="bv">₹ ${B.toLocaleString("en-IN")}</div>
  <div class="rwrap"><div class="ruler" id="ruler"><div class="rail"><div class="ticks" style="width:${500 * TW}px"></div></div></div><i class="ind"></i></div>
  <div class="kl" id="kl">${B / 1000}K</div>
  <div class="last"><small>LAST MONTH</small><div>${fmt(sp)}${pb ? " of " + fmt(pb) + " budget" : " spent"}</div>${pb ? (sp <= pb ? '<p class="ok">You stayed within budget. Keep it up.</p>' : '<p class="bad">You went over budget by ' + fmt(r2(sp - pb)) + ".</p>") : ""}</div>
  <button class="save wide" id="setBudget">Set Budget</button>`;
  showSheet();
  const r = $("#ruler"); r.scrollLeft = B / 1000 * TW;
  requestAnimationFrame(() => { r.scrollLeft = B / 1000 * TW; });
  r.onscroll = () => { B = Math.max(0, Math.min(500, Math.round(r.scrollLeft / TW))) * 1000; $("#bv").textContent = "₹ " + B.toLocaleString("en-IN"); $("#kl").textContent = B / 1000 + "K"; };
}

/* ---------- Insights & settings pages ---------- */
function renderIns() {
  $$("#insTabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const el = $("#insBody"), ex = S.tx.filter(t => t.type === "expense" && t.date.startsWith(vm)), tot = sum(ex);
  if (!ex.length) { el.innerHTML = '<div class="empty" style="text-align:center">No expenses in ' + mname(vm) + "</div>"; return; }
  if (tab === "spending") {
    const by = {}; ex.forEach(t => by[t.cat] = (by[t.cat] || 0) + t.amount);
    el.innerHTML = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, v]) => { const c = catInfo("expense", n);
      return `<div class="srow"><span class="ce">${c[1]}</span><div><div class="sl"><b>${esc(n)}</b><em>${fmt(r2(v))}</em></div><div class="bar"><i style="width:${v / tot * 100}%;background:${c[2]}"></i></div></div></div>`; }).join("");
  } else {
    const y = +vm.slice(0, 4), m = +vm.slice(5, 7), dim = new Date(y, m, 0).getDate(), cur = vm === today().slice(0, 7);
    const days = cur ? new Date().getDate() : dim, avg = tot / days, bud = budgetFor(vm);
    const pk = iso(new Date(y, m - 2, 1)).slice(0, 7), prev = sum(S.tx.filter(t => t.type === "expense" && t.date.startsWith(pk)));
    const cards = [["Spent in " + mname(vm), fmt(tot)], ["Daily average", fmt(r2(avg))]];
    if (cur) cards.push(["Projected month-end", fmt(Math.round(avg * dim))]);
    if (bud) cards.push([tot > bud ? "Over budget by" : "Left in budget", fmt(r2(Math.abs(bud - tot)))]);
    if (prev) cards.push(["Vs last month", (tot >= prev ? "+" : "−") + Math.round(Math.abs(tot - prev) / prev * 100) + "%"]);
    el.innerHTML = cards.map(c => `<div class="icard"><small>${c[0]}</small><b>${c[1]}</b></div>`).join("");
  }
}
$("#insTabs").onclick = e => { const b = e.target.closest("button"); if (b) { tab = b.dataset.tab; renderIns(); } };
const openPage = id => { if (id === "insights") renderIns(); else { $("#nm").textContent = S.name + " ✎"; refreshAcct(); } $("#" + id).classList.add("open"); };
$$("[data-close]").forEach(b => b.onclick = () => b.closest(".page").classList.remove("open"));
$("#nm").onclick = () => { const n = prompt("Your name", S.name); if (n && n.trim()) { S.name = n.trim().slice(0, 30); S.su = Date.now(); save(); $("#nm").textContent = S.name + " ✎"; } };
$("#bk").onclick = async () => {
  const f = new File([JSON.stringify(S, null, 1)], "my-money-backup-" + today() + ".json", { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
};
$("#imp").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const o = JSON.parse(await f.text()); let n;
    if (Array.isArray(o.tx)) n = { ...fresh(), ...o };
    else if (Array.isArray(o.transactions)) { // backup from the old My Money app
      n = fresh();
      n.tx = o.transactions.filter(t => t && t.date && +t.amount > 0).map(t => ({ id: t.id || crypto.randomUUID(), type: t.type === "income" ? "income" : "expense", amount: +t.amount, date: String(t.date).slice(0, 10), note: t.note || "", cat: "Other", u: Date.now() }));
      if (+o.budget > 0) n.budgets[today().slice(0, 7)] = +o.budget;
    } else throw 0;
    if (!confirm("Replace current data with " + n.tx.length + " transactions from this file?")) return;
    const ids = new Set(n.tx.map(t => t.id)), del = { ...(n.del || {}), ...S.del }; S.tx.forEach(t => { if (!ids.has(t.id)) del[t.id] = Date.now(); }); n.del = del; n.su = Date.now(); n.tx.forEach(t => t.u = Date.now()); S = n; save(); render(); alert("Imported.");
  } catch (err) { alert("That file is not a valid backup."); }
};
$("#er").onclick = () => { if (confirm("Erase all data on this device? This cannot be undone.") && confirm("Really erase everything?")) { const del = { ...S.del }; S.tx.forEach(t => del[t.id] = Date.now()); S = fresh(); S.del = del; S.su = Date.now(); save(); render(); $("#settings").classList.remove("open"); } };

/* ---------- Cloud sync (Supabase) ---------- */
const SB_URL = "https://qmqwzhfkvykvdkdurtdh.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtcXd6aGZrdnlrdmRrZHVydGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDk4MjcsImV4cCI6MjEwOTAyNTgyN30.PHhMIjvOHIAokPdoede5ZVfglaUC0QxOGu6spw_4cXU";
const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;
let user = null, syncMsg = "", syncing = false, st = null;
const schedSync = () => { if (user) { clearTimeout(st); st = setTimeout(syncNow, 1500); } };
function setMsg(m) { syncMsg = m; refreshAcct(); }
function refreshAcct() {
  $("#acct").textContent = user ? "☁️ " + user.email + (syncMsg ? " · " + syncMsg : "") : "☁️ Sign in to sync";
  $("#lo").hidden = !user;
}
// Merge two states: transactions by id (newest edit wins, deletes tracked), settings newest-wins
function merge(a, b) {
  if (!b || !Array.isArray(b.tx)) return a;
  const now = Date.now(), del = {}, m = new Map();
  [a.del, b.del].forEach(o => Object.entries(o || {}).forEach(([k, v]) => { if (now - v < 90 * 864e5) del[k] = Math.max(del[k] || 0, v); }));
  [...a.tx, ...b.tx].forEach(t => { const c = m.get(t.id); if (!c || (t.u || 0) > (c.u || 0)) m.set(t.id, t); });
  Object.entries(del).forEach(([id, ts]) => { const t = m.get(id); if (t && ts >= (t.u || 0)) m.delete(id); });
  const s = (b.su || 0) > (a.su || 0) ? b : a;
  return { tx: [...m.values()], del, budgets: s.budgets || {}, cats: s.cats || a.cats, name: s.name || a.name, su: Math.max(a.su || 0, b.su || 0) };
}
async function syncNow() {
  if (!sb || !user || syncing || !navigator.onLine) return;
  syncing = true; setMsg("Syncing…");
  try {
    for (let i = 0; i < 3; i++) {
      const { data: row, error } = await sb.from("user_app_state").select("data,updated_at").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      S = merge(S, row && row.data && row.data.v2);
      const now = new Date().toISOString(), data = { ...(row && row.data || {}), v2: JSON.parse(JSON.stringify(S)) }; // keeps the old app's data untouched
      const r = row
        ? await sb.from("user_app_state").update({ data, updated_at: now }).eq("user_id", user.id).eq("updated_at", row.updated_at).select("user_id")
        : await sb.from("user_app_state").insert({ user_id: user.id, data, updated_at: now }).select("user_id");
      if (r.error) { if (r.error.code === "23505") continue; throw r.error; }
      if (r.data && r.data.length) { saveLocal(); render(); setMsg("Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); return; }
    }
    setMsg("Conflict, will retry");
  } catch (e) { setMsg("Sync failed: " + (e.message || e)); }
  finally { syncing = false; }
}
function claimDevice() {
  const own = localStorage.getItem("mm3owner");
  if (own && own !== user.id) {
    if (confirm("This device holds data from a different account. Replace it with this account's data?")) { S = fresh(); saveLocal(); render(); }
    else { sb.auth.signOut(); return false; }
  }
  localStorage.setItem("mm3owner", user.id); return true;
}
function openAuth() {
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><h3>Sign in</h3><p class="sub">Sync your data across devices</p>
  <input class="fi" id="em" type="email" autocomplete="email" placeholder="Email">
  <input class="fi" id="pw" type="password" autocomplete="current-password" placeholder="Password (min 6 characters)">
  <div class="msg" id="am"></div><button class="save wide" id="si" style="margin-top:6px">Sign in</button>
  <button class="ghost" id="su2">Create account</button><button class="ghost" id="fp">Forgot password?</button>`;
  showSheet();
}
sheet.addEventListener("click", async e => {
  const id = e.target.id; if (!["si", "su2", "fp"].includes(id)) return;
  const em = $("#em").value.trim(), pw = $("#pw").value, am = $("#am");
  if (!sb) { am.textContent = "Cloud library not loaded. Go online and reload."; return; }
  if (!em) { am.textContent = "Enter your email."; return; }
  if (id !== "fp" && pw.length < 6) { am.textContent = "Password must be at least 6 characters."; return; }
  am.textContent = "Please wait…";
  try {
    if (id === "fp") { const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname }); if (error) throw error; am.textContent = "Password reset email sent."; return; }
    const r = id === "si" ? await sb.auth.signInWithPassword({ email: em, password: pw }) : await sb.auth.signUp({ email: em, password: pw });
    if (r.error) throw r.error;
    if (r.data.session) hideSheet(); else am.textContent = "Check your email to confirm, then sign in.";
  } catch (err) { am.textContent = err.message || "Something went wrong."; }
});
if (sb) sb.auth.onAuthStateChange((ev, s) => {
  user = s ? s.user : null; refreshAcct();
  if (ev === "PASSWORD_RECOVERY") setTimeout(() => { const p = prompt("Enter a new password (min 6 characters)"); if (p && p.length >= 6) sb.auth.updateUser({ password: p }).then(r => alert(r.error ? r.error.message : "Password updated.")); }, 0);
  if (user && (ev === "SIGNED_IN" || ev === "INITIAL_SESSION")) setTimeout(() => { if (claimDevice()) syncNow(); }, 0);
});
addEventListener("online", syncNow);
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncNow(); });
$("#acct").onclick = () => user ? syncNow() : openAuth();
$("#lo").onclick = async () => { if (confirm("Log out? Your data stays on this device.")) { await sb.auth.signOut(); setMsg(""); } };

/* ---------- Wiring ---------- */
$("#typeSeg").onclick = e => { const b = e.target.closest("button"); if (b) { type = b.dataset.t; render(); } };
$("#rangeSeg").onclick = e => { const b = e.target.closest("button"); if (b) { range = b.dataset.r; render(); } };
$("#list").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.id) openAdd(S.tx.find(t => t.id === b.dataset.id));
  else if (b.dataset.m) { vm = b.dataset.m; range = "1M"; render(); }
};
$("#bl").onclick = () => { if (type === "expense" && range === "1M") openBudget(); };
$("#fab").onclick = () => openAdd();
$("#menuBtn").onclick = () => openPage("insights");
$("#walletBtn").onclick = () => openPage("settings");
addEventListener("resize", render);
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
