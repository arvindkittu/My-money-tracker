"use strict";
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s), KEY = "mm3", TW = 9;
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => iso(new Date());
const r2 = n => Math.round(n * 100) / 100;
const fmt = n => "₹" + (+n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mname = (k, o) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString("en-IN", o || { month: "long" });
const sum = a => r2(a.reduce((s, t) => s + t.amount, 0));
const DC = {
  expense: [["Food", "🍔", "#f59e0b"], ["Bills", "🧾", "#a78bfa"], ["Home", "🏠", "#34d399"], ["Health", "🏥", "#f87171"], ["EMI", "🏦", "#fb923c"], ["Travel", "🚗", "#60a5fa"], ["Shopping", "🛍️", "#f472b6"], ["Investment", "📈", "#22d3ee"], ["Other", "📦", "#9ca3af"]],
  income: [["Salary", "💼", "#34d399"], ["Business", "🏢", "#f59e0b"], ["Side income", "💻", "#60a5fa"], ["Bonus", "🎉", "#f472b6"], ["Interest", "📈", "#a78bfa"], ["Other", "💰", "#9ca3af"]]
};
const fresh = () => ({ tx: [], budgets: {}, cats: JSON.parse(JSON.stringify(DC)), name: "My Money", del: {}, su: 0, rec: [], goals: [], loans: [], inv: [], snaps: [] });
let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!S || !Array.isArray(S.tx)) S = fresh();
S.del = S.del || {}; S.su = S.su || 0; S.rec = S.rec || []; S.goals = S.goals || []; S.loans = S.loans || []; S.inv = S.inv || []; S.snaps = S.snaps || []; ensureInvCat();
const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert("Could not save data on this device."); } };
const save = () => { saveLocal(); schedSync(); };
let type = "expense", range = "1M", vm = today().slice(0, 7), D = null, B = 0, tab = "insights";
const budgetFor = m => { const k = Object.keys(S.budgets).filter(x => x <= m).sort().pop(); return k ? S.budgets[k] : 0; };
const catInfo = (t, n) => S.cats[t].find(c => c[0] === n) || ["Other", "📦", "#9ca3af"];
const sheet = $("#sheet"), scrim = $("#scrim");
const ICO_ED = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>', ICO_DEL = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/></svg>', CHECK = '<svg viewBox="0 0 24 24" style="width:26px;height:26px;stroke:#000;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
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
      `<div class="rw"><div class="ra l"><button class="ed" data-redit="${esc(t.id)}" aria-label="Edit">${ICO_ED}</button></div><div class="ra r"><button class="dl" data-rdel="${esc(t.id)}" aria-label="Delete">${ICO_DEL}</button></div><button class="row" data-id="${esc(t.id)}"><div class="badge">${t.date.slice(8)}<small>${mname(t.date, { month: "short" }).toUpperCase()}</small></div><span class="n">${esc(t.note || t.cat)}</span><span class="a ${type}">${fmt(t.amount)}</span></button></div>`).join("");
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
  const L = 26, R = 26, top = 10, base = H - 30, slot = (W - L - R) / keys.length;
  const bw = Math.min(range === "1M" ? 14 : 24, slot * .68), max = Math.max(1, ...vals);
  x.strokeStyle = "#333"; x.lineWidth = 1.2; x.setLineDash([5, 6]);
  x.beginPath(); x.moveTo(L, base); x.lineTo(W - R, base); x.stroke(); x.setLineDash([]);
  const td = +today().slice(8), isCur = range === "1M" && vm === tk.slice(0, 7);
  x.font = "13px -apple-system,sans-serif"; x.textAlign = "center";
  vals.forEach((v, i) => {
    const cx = L + slot * (i + .5);
    if (v > 0) {
      const h = Math.max(4, (base - top) * v / max);
      x.fillStyle = type === "expense" ? "#ff5f5f" : "#4ade80";
      x.beginPath(); (x.roundRect || x.rect).call(x, cx - bw / 2, base - h, bw, h, 4); x.fill();
    }
    const d = lab[i];
    const show = range !== "1M" || d === 1 || (isCur && d === td) || (d >= 9 && (d - 9) % 4 === 0 && !(isCur && Math.abs(d - td) < 3));
    if (show) { x.fillStyle = "#cfcfcf"; x.fillText(String(d), cx, base + 21); }
    if (isCur && d === td) { x.fillStyle = "#4ade80"; x.beginPath(); x.arc(cx, base - 12, 3, 0, 7); x.fill(); }
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
  ensureInvCat();
  const c = catInfo(D.type, D.cat);
  let body;
  if (D.panel === "cats") {
    body = '<div class="cats">' + S.cats[D.type].map(k => `<div class="cwrap">${k[0] === "Other" ? "" : `<div class="cact"><button data-cedit="${esc(k[0])}">Edit</button><button data-cdel="${esc(k[0])}">Delete</button></div>`}<button class="crow" data-cat="${esc(k[0])}"><span class="ce">${k[1]}</span><span class="cn">${esc(k[0])}</span><i style="background:${k[2]}"></i><b>${k[0] === D.cat ? "✓" : ""}</b></button></div>`).join("")
      + '<button class="crow" id="addCat"><span class="ce">＋</span><span class="cn">Add category</span></button></div>';
  } else if (D.panel === "cal") body = calendar();
  else body = '<div class="keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join("") + '<button data-k="<">‹</button><button data-k="0">0</button><button class="save" id="nextBtn" data-k="next" aria-label="Next"' + (+D.amt > 0 ? "" : " disabled") + '>' + CHECK + '</button></div>';
  const dl = D.date === today() ? "Today" : new Date(+D.date.slice(0, 4), +D.date.slice(5, 7) - 1, +D.date.slice(8)).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  sheet.classList.remove("typing"); sheet.classList.toggle("p", D.panel !== "keys");
  sheet.innerHTML = `<div class="hd"></div>${D.id ? '<button class="del" id="delTx">Delete</button>' : ""}
  <div class="seg mid"><button data-st="expense" class="${D.type === "expense" ? "on" : ""}">Expense</button><button data-st="income" class="${D.type === "income" ? "on" : ""}">Income</button></div>
  <div class="amt ${D.amt ? "" : "z"}" id="amt"><span>₹</span>${D.amt || 0}</div>
  <input class="note" id="note" placeholder="Description" maxlength="60" value="${esc(D.note)}">
  ${pillHTML()}
  <div class="chips"><button class="chip" id="dateBtn"><span class="e">📅</span> ${dl}</button>${D.id ? "" : `<button class="chip" id="repBtn" style="color:${D.rep ? "#4ade80" : "inherit"}"><span class="e">🔁</span> ${D.rep ? "Monthly" : "Once"}</button>`}<button class="chip" id="catBtn">All ⌄</button></div>${body}<div class="savebar"><button class="save wide" id="svBtn" data-k="save"${D.note.trim() || D.id ? "" : " disabled"}>Save</button></div>`;
}
function key(k) {
  if (k === "save") return saveTx();
  if (k === "next") { if (+D.amt > 0) $("#note").focus(); return; }
  if (k === "<") D.amt = D.amt.slice(0, -1);
  else if (D.amt.length < 9 && !(D.amt === "" && k === "0")) D.amt += k;
  const a = $("#amt"); a.innerHTML = "<span>₹</span>" + (D.amt || 0); a.classList.toggle("z", !D.amt); const nb = $("#nextBtn"); if (nb) nb.disabled = !(+D.amt > 0);
}
function saveTx() {
  const a = +D.amt || 0;
  if (!(a > 0)) { alert("Enter an amount greater than zero."); return; }
  if (!D.id && !D.note.trim()) { $("#note").focus(); return; }
  const tx = { id: D.id || crypto.randomUUID(), type: D.type, amount: a, date: D.date, note: D.note.trim(), cat: D.cat, u: Date.now() };
  const i = S.tx.findIndex(t => t.id === tx.id);
  if (i >= 0) S.tx[i] = tx; else S.tx.push(tx);
  if (D.rep && !D.id) S.rec.push({ id: crypto.randomUUID(), type: tx.type, amount: tx.amount, cat: tx.cat, note: tx.note, day: +tx.date.slice(8), last: tx.date.slice(0, 7), u: Date.now() });
  save(); hideSheet(); type = tx.type; vm = tx.date.slice(0, 7); range = "1M"; render();
}
sheet.oninput = e => { if (e.target.id === "note") { D.note = e.target.value; const b = $("#svBtn"); if (b) b.disabled = !(D.note.trim() || D.id); } };
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
  else if (b.id === "repBtn") { D.rep = !D.rep; drawAdd(); }
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
  if (tab === "savings") return renderGoals(el);
  if (tab === "loans") return renderLoans(el);
  if (tab === "invest") return renderInv(el);
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
const openPage = id => { if (id === "insights") renderIns(); else { $("#nm").textContent = S.name + " ✎"; refreshAcct(); refreshDaily(); } $("#" + id).classList.add("open"); };
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
$("#er").onclick = () => { if (confirm("Erase all data on this device? This cannot be undone.") && confirm("Really erase everything?")) { const del = { ...S.del }; S.tx.forEach(t => del[t.id] = Date.now()); S.rec.forEach(r => del[r.id] = Date.now()); S.goals.forEach(r => del[r.id] = Date.now()); S.loans.forEach(r => del[r.id] = Date.now()); S.inv.forEach(r => del[r.id] = Date.now()); S.snaps.forEach(r => del[r.id] = Date.now()); S = fresh(); S.del = del; S.su = Date.now(); save(); render(); $("#settings").classList.remove("open"); } };

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
  const now = Date.now(), del = {};
  [a.del, b.del].forEach(o => Object.entries(o || {}).forEach(([k, v]) => { if (now - v < 90 * 864e5) del[k] = Math.max(del[k] || 0, v); }));
  const mix = (x = [], y = []) => {
    const m = new Map();
    [...x, ...y].forEach(t => { const c = m.get(t.id); if (!c || (t.u || 0) > (c.u || 0)) m.set(t.id, t); });
    Object.entries(del).forEach(([id, ts]) => { const t = m.get(id); if (t && ts >= (t.u || 0)) m.delete(id); });
    return [...m.values()];
  };
  const s = (b.su || 0) > (a.su || 0) ? b : a;
  return { tx: mix(a.tx, b.tx), rec: mix(a.rec, b.rec), goals: mix(a.goals, b.goals), loans: mix(a.loans, b.loans), inv: mix(a.inv, b.inv), snaps: mix(a.snaps, b.snaps), del, budgets: s.budgets || {}, cats: s.cats || a.cats, name: s.name || a.name, su: Math.max(a.su || 0, b.su || 0) };
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) { runRecurring(); snapNow(); refreshPrices({ auto: true, quiet: true }); syncNow(); } });
$("#acct").onclick = () => user ? syncNow() : openAuth();
$("#lo").onclick = async () => { if (confirm("Log out? Your data stays on this device.")) { await sb.auth.signOut(); setMsg(""); } };

/* ---------- Recurring ---------- */
function runRecurring() {
  const now = new Date(), cur = now.getFullYear() + "-" + pad(now.getMonth() + 1), t = today();
  let changed = false;
  S.rec.forEach(r => {
    let y = +r.last.slice(0, 4), m = +r.last.slice(5, 7);
    for (let g = 0; g < 120; g++) {
      m++; if (m > 12) { m = 1; y++; }
      const ym = y + "-" + pad(m);
      if (ym > cur) break;
      const date = ym + "-" + pad(Math.min(r.day, new Date(y, m, 0).getDate()));
      if (date > t) break;
      const id = "r_" + r.id + "_" + ym;
      if (!S.del[id] && !S.tx.some(x => x.id === id)) S.tx.push({ id, type: r.type, amount: r.amount, date, note: r.note, cat: r.cat, u: new Date(date + "T00:00:00").getTime() });
      r.last = ym; r.u = Date.now(); changed = true;
    }
  });
  if (changed) { save(); render(); }
}
function openRec() {
  sheet.className = "sheet";
  const L = S.rec.map(r => { const c = catInfo(r.type, r.cat); return `<div class="rrow"><span class="ce">${c[1]}</span><span class="n">${esc(r.note || r.cat)}<small>Monthly on day ${r.day}</small></span><span class="a ${r.type}">${fmt(r.amount)}</span><button data-rdel="${esc(r.id)}" style="color:#f87171">✕</button></div>`; }).join("");
  sheet.innerHTML = `<div class="hd"></div><h3>Recurring</h3><p class="sub">Added automatically every month</p>${L || '<div class="empty" style="text-align:center">None yet. Turn on 🔁 when adding a transaction.</div>'}`;
  showSheet();
}
sheet.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b && b.dataset.rdel && confirm("Stop this recurring entry? Past entries stay.")) {
    S.del[b.dataset.rdel] = Date.now(); S.rec = S.rec.filter(r => r.id !== b.dataset.rdel); save(); openRec();
  }
});

/* ---------- Savings goals & Loans ---------- */
const num = v => Math.max(0, r2(parseFloat(String(v).replace(/,/g, "")) || 0));
const pct = (a, b) => b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0;
let F = null;
function renderGoals(el) {
  el.innerHTML = (S.goals.map(g => {
    const p = pct(g.saved, g.target), left = Math.max(0, r2(g.target - g.saved));
    return `<div class="gcard"><div class="gh"><b>${esc(g.name)}</b><span>${fmt(g.saved)} / ${fmt(g.target)}</span></div><div class="bar"><i style="width:${p}%;background:var(--grn)"></i></div><div class="gf"><small>${p >= 100 ? "Goal reached 🎉" : p + "% · " + fmt(left) + " to go"}</small><button data-gedit="${esc(g.id)}">Edit</button><button class="pri" data-gadd="${esc(g.id)}">+ Add</button></div></div>`;
  }).join("") || '<div class="empty" style="text-align:center">No savings goals yet</div>') + '<button class="save wide" data-gnew="1">New goal</button>';
}
function renderLoans(el) {
  el.innerHTML = (S.loans.map(l => {
    const p = pct(l.paid, l.total), left = Math.max(0, r2(l.total - l.paid)), n = l.emi > 0 ? Math.ceil(left / l.emi) : 0;
    return `<div class="gcard"><div class="gh"><b>${esc(l.name)}</b><span>${fmt(l.paid)} / ${fmt(l.total)}</span></div><div class="bar"><i style="width:${p}%;background:#fb923c"></i></div><div class="gf"><small>${left <= 0 ? "Paid off 🎉" : fmt(left) + " left · " + n + " EMI" + (n === 1 ? "" : "s") + " of " + fmt(l.emi)}</small><button data-ledit="${esc(l.id)}">Edit</button>${left > 0 && l.emi > 0 ? `<button class="pri" data-lpay="${esc(l.id)}">Pay EMI</button>` : ""}</div></div>`;
  }).join("") || '<div class="empty" style="text-align:center">No loans yet</div>') + '<button class="save wide" data-lnew="1">New loan</button>';
}
function openForm(kind, id) {
  const G = kind === "goal", it = (G ? S.goals : S.loans).find(x => x.id === id) || {};
  F = { kind, id: it.id || "" };
  const fields = G
    ? [["Goal name", "name", it.name || "", "text"], ["Target amount (₹)", "target", it.target || "", "decimal"], ["Saved so far (₹)", "saved", it.saved || "", "decimal"]]
    : [["Loan name", "name", it.name || "", "text"], ["Total amount (₹)", "total", it.total || "", "decimal"], ["Monthly EMI (₹)", "emi", it.emi || "", "decimal"], ["Paid so far (₹)", "paid", it.paid || "", "decimal"]];
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div>${it.id ? '<button class="del" id="fdel">Delete</button>' : ""}<h3>${it.id ? "Edit" : "New"} ${G ? "goal" : "loan"}</h3><p class="sub"></p>`
    + fields.map(f => `<div class="lab">${f[0]}</div><input class="fi" data-f="${f[1]}" type="text" inputmode="${f[3]}" value="${esc(f[2])}" ${f[3] === "text" ? 'maxlength="30"' : 'placeholder="0"'}>`).join("")
    + '<button class="save wide" id="fsave">Save</button>';
  showSheet();
}
function openAddMoney(id) {
  const g = S.goals.find(x => x.id === id); if (!g) return;
  F = { kind: "goal", id };
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><h3>Add to ${esc(g.name)}</h3><p class="sub">${fmt(g.saved)} of ${fmt(g.target)} saved</p><input class="fi" data-f="amt" type="text" inputmode="decimal" placeholder="Amount (₹)"><button class="save wide" id="psave">Add</button>`;
  showSheet();
}
function payEmi(id) {
  const l = S.loans.find(x => x.id === id); if (!l) return;
  const a = Math.min(l.emi, r2(l.total - l.paid)); if (!(a > 0)) return;
  if (!confirm("Record " + fmt(a) + " EMI for " + l.name + "? This also adds an EMI expense for today.")) return;
  l.paid = r2(l.paid + a); l.u = Date.now();
  S.tx.push({ id: crypto.randomUUID(), type: "expense", amount: a, date: today(), note: l.name + " EMI", cat: "EMI", u: Date.now() });
  save(); renderIns(); render();
}
function finishForm() { snapNow(); save(); hideSheet(); const rid = F && F.kind === "inv" && F.ik ? F.id : ""; F = null; renderIns(); render(); if (rid) refreshPrices({ id: rid, quiet: true }); }
sheet.addEventListener("click", e => {
  const id = e.target.id;
  if (!F || !["fsave", "fdel", "psave"].includes(id)) return;
  const G = F.kind === "goal", key = { goal: "goals", loan: "loans", inv: "inv" }[F.kind], list = S[key];
  const v = k => { const el = sheet.querySelector('[data-f="' + k + '"]'); return el ? el.value : ""; };
  if (id === "fdel") { if (confirm("Delete this " + (F.kind === "inv" ? "investment" : F.kind) + "?")) { S.del[F.id] = Date.now(); S[key] = list.filter(x => x.id !== F.id); finishForm(); } return; }
  if (id === "psave") {
    const a = num(v("amt")); if (!(a > 0)) { alert("Enter an amount greater than zero."); return; }
    const g = S.goals.find(x => x.id === F.id); g.saved = r2(g.saved + a); g.u = Date.now(); finishForm(); return;
  }
  const name = v("name").trim();
  const o = F.kind === "inv" ? { name, kind: F.ik, invested: num(v("invested")), value: num(v("value")), units: num(v("units")), sym: v("sym").trim() } : G ? { name, target: num(v("target")), saved: num(v("saved")) } : { name, total: num(v("total")), emi: num(v("emi")), paid: num(v("paid")) };
  if (F.kind === "loan") o.paid = Math.min(o.paid, o.total);
  if (F.kind === "inv" && !(o.value > 0)) o.value = o.invested;
  const need = F.kind === "inv" ? o.invested : G ? o.target : o.total;
  if (!name || !(need > 0)) { alert("Enter a name and an amount greater than zero."); return; }
  const ex = list.find(x => x.id === F.id);
  if (ex) Object.assign(ex, o, { u: Date.now() }); else { const nid = crypto.randomUUID(); F.id = nid; list.push({ id: nid, ...o, u: Date.now() }); }
  finishForm();
});
$("#insBody").onclick = e => {
  const d = (e.target.closest("button") || {}).dataset; if (!d) return;
  if (d.gnew) openForm("goal"); else if (d.gedit) openForm("goal", d.gedit); else if (d.gadd) openAddMoney(d.gadd);
  else if (d.lnew) openForm("loan"); else if (d.ledit) openForm("loan", d.ledit); else if (d.lpay) payEmi(d.lpay);
  else if (d.inew) openInv(); else if (d.iedit) openInv(d.iedit); else if (d.ibuy) openBuy(d.ibuy);
};

/* ---------- Investments (stocks, mutual funds, gold) ---------- */
const IK = { stock: ["Stocks", "📈"], mf: ["Mutual Fund", "📊"], gold: ["Gold", "🪙"], other: ["Other", "💼"] };
function ensureInvCat() {
  const l = S.cats.expense;
  if (!l.some(c => c[0] === "Investment")) l.splice(Math.max(0, l.length - 1), 0, ["Investment", "📈", "#22d3ee"]);
}
function renderInv(el) {
  const inv = S.inv.reduce((a, h) => a + h.invested, 0), val = S.inv.reduce((a, h) => a + h.value, 0), d = r2(val - inv);
  const sg = x => x >= 0 ? "+" : "−", pc = (g, i) => Math.abs(Math.round(g / i * 1000) / 10) + "%";
  let h = S.inv.length ? `<div class="icard"><small>Current value</small><b>${fmt(r2(val))}</b><div class="${d >= 0 ? "ok" : "bad"}">${sg(d)}${fmt(Math.abs(d))}${inv > 0 ? " · " + sg(d) + pc(d, inv) : ""} on ${fmt(r2(inv))} invested</div></div>` : "";
  h += [...S.inv].sort((a, b) => Object.keys(IK).indexOf(a.kind) - Object.keys(IK).indexOf(b.kind) || b.value - a.value).map(x => {
    const k = IK[x.kind] || IK.other, g = r2(x.value - x.invested);
    return `<div class="gcard"><div class="gh"><b>${k[1]} ${esc(x.name)}</b><span>${fmt(x.value)}</span></div><div class="gf"><small>${k[0]} · invested ${fmt(x.invested)} · <span class="${g >= 0 ? "ok" : "bad"}">${sg(g)}${x.invested > 0 ? pc(g, x.invested) : fmt(Math.abs(g))}</span></small><button data-iedit="${esc(x.id)}">Edit</button><button class="pri" data-ibuy="${esc(x.id)}">+ Buy</button></div></div>`;
  }).join("") || '<div class="empty" style="text-align:center">No investments yet</div>';
  el.innerHTML = h + '<button class="save wide" data-inew="1">New investment</button>';
}
function openInv(id) {
  const it = S.inv.find(x => x.id === id) || {};
  F = { kind: "inv", id: it.id || "", ik: it.kind || "stock" };
  const f = (lab, k, val, mode, extra) => `<div class="lab">${lab}</div><input class="fi" data-f="${k}" type="text" inputmode="${mode}" value="${esc(val)}" ${extra}>`;
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div>${it.id ? '<button class="del" id="fdel">Delete</button>' : ""}<h3>${it.id ? "Edit" : "New"} investment</h3><p class="sub"></p><div class="seg mid" style="width:100%;margin-bottom:14px">${Object.entries(IK).map(([k, v]) => `<button data-ik="${k}" class="${k === F.ik ? "on" : ""}" style="flex:1;padding:6px 2px">${v[0]}</button>`).join("")}</div>`
    + f("Name", "name", it.name || "", "text", 'maxlength="30"') + f("Amount invested (₹)", "invested", it.invested || "", "decimal", 'placeholder="0"') + f("Current value (₹)", "value", it.value || "", "decimal", 'placeholder="Same as invested"') + f("Units / grams held (for live price)", "units", it.units || "", "decimal", 'placeholder="optional"') + f("Ticker or scheme code (live price)", "sym", it.sym || "", "text", 'placeholder="Stocks: RELIANCE.BSE · Funds: use Find · Gold: leave empty" autocapitalize="characters"') + '<button class="ghost" id="mfFind">🔎 Find mutual fund code from Name</button><div id="mfRes"></div>'
    + '<button class="save wide" id="fsave">Save</button>';
  showSheet();
}
function openBuy(id) {
  const x = S.inv.find(h => h.id === id); if (!x) return;
  F = { kind: "inv", id, log: true };
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><h3>Buy more ${esc(x.name)}</h3><p class="sub">Currently worth ${fmt(x.value)}</p><input class="fi" data-f="amt" type="text" inputmode="decimal" placeholder="Amount invested (₹)"><button class="ghost" id="logBtn" style="color:var(--grn)">Log as expense: On</button><button class="save wide" id="bsave">Add</button>`;
  showSheet();
}
sheet.addEventListener("click", e => {
  if (!F || F.kind !== "inv") return;
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.ik) { F.ik = b.dataset.ik; sheet.querySelectorAll("[data-ik]").forEach(x => x.classList.toggle("on", x === b)); }
  else if (b.id === "logBtn") { F.log = !F.log; b.textContent = "Log as expense: " + (F.log ? "On" : "Off"); b.style.color = F.log ? "var(--grn)" : "var(--mut)"; }
  else if (b.id === "bsave") {
    const a = num(sheet.querySelector('[data-f="amt"]').value); if (!(a > 0)) { alert("Enter an amount greater than zero."); return; }
    const x = S.inv.find(h => h.id === F.id); if (!x) return;
    x.invested = r2(x.invested + a); x.value = r2(x.value + a); x.u = Date.now();
    if (x.units > 0 && x.px > 0) x.units = Math.round((x.units + a / x.px) * 1e4) / 1e4;
    if (F.log) { ensureInvCat(); S.tx.push({ id: crypto.randomUUID(), type: "expense", amount: a, date: today(), note: x.name, cat: "Investment", u: Date.now() }); }
    finishForm();
  }
});

/* ---------- Live prices, refresh, monthly snapshots, reminder ---------- */
const PK = () => { try { return JSON.parse(localStorage.getItem("mm3pk")) || {}; } catch (e) { return {}; } };
const getJSON = async (url, ms = 9000) => {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); }
};
async function goldPerGram() {
  const g = await getJSON("https://api.gold-api.com/price/XAU"); let fx;
  try { fx = (await getJSON("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR")).rates.INR; }
  catch (e) { fx = (await getJSON("https://open.er-api.com/v6/latest/USD")).rates.INR; }
  if (!(g.price > 0) || !(fx > 0)) throw new Error("bad gold data");
  return g.price / 31.1035 * fx * (1 + (parseFloat(PK().adj) || 0) / 100); // 24K, per gram, INR
}
async function priceFor(h, cache) {
  if (h.kind === "gold") return cache.gold || (cache.gold = await goldPerGram());
  if (h.kind === "mf") {
    const j = await getJSON("https://api.mfapi.in/mf/" + encodeURIComponent(h.sym) + "/latest");
    const p = parseFloat(j.data && j.data[0] && j.data[0].nav); if (!(p > 0)) throw new Error("no NAV"); return p;
  }
  const pk = PK(); if (!pk.key) throw new Error("add a stock API key in ⚙️");
  if (pk.prov === "td") {
    const j = await getJSON("https://api.twelvedata.com/price?symbol=" + encodeURIComponent(h.sym) + "&apikey=" + encodeURIComponent(pk.key));
    const p = parseFloat(j.price); if (!(p > 0)) throw new Error(j.message || "no price"); return p;
  }
  const j = await getJSON("https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=" + encodeURIComponent(h.sym) + "&apikey=" + encodeURIComponent(pk.key));
  const p = parseFloat(j["Global Quote"] && j["Global Quote"]["05. price"]); if (!(p > 0)) throw new Error(j.Note || j.Information || "no price"); return p;
}
let refreshing = false, invNote = "";
function setNote(m) { invNote = m; const el = $("#invNote"); if (el) { el.textContent = m; el.className = ""; } }
async function refreshPrices(o = {}) {
  if (refreshing) return;
  const hs = S.inv.filter(h => h.units > 0 && (h.kind === "gold" || h.sym) && (!o.id || h.id === o.id) && (!o.auto || Date.now() - (h.pu || 0) > 432e5));
  if (!hs.length) { if (!o.quiet) alert("Nothing to refresh yet. Add units (grams for gold) and a ticker or scheme code to a holding."); return; }
  if (!navigator.onLine) { if (!o.quiet) alert("You're offline."); return; }
  refreshing = true; setNote("Refreshing prices…");
  const cache = {}, bad = []; let ok = 0;
  for (const h of hs) {
    try { const p = await priceFor(h, cache); h.px = p; h.value = r2(h.units * p); h.pu = Date.now(); h.u = Date.now(); ok++; }
    catch (e) { bad.push(h.name + ": " + (e.name === "AbortError" ? "timed out" : e.message || "failed")); }
  }
  refreshing = false;
  if (ok) { snapNow(); save(); }
  setNote(ok + " updated" + (bad.length ? " · " + bad.length + " failed (" + bad[0] + ")" : ""));
  if (tab === "invest" && $("#insights").classList.contains("open")) renderIns();
  setTimeout(() => { invNote = ""; if (tab === "invest" && $("#insights").classList.contains("open")) renderIns(); }, 8000);
}
function updateDot() {
  const last = Math.max(0, ...S.inv.map(h => Math.max(h.pu || 0, h.u || 0)));
  $("#menuBtn").classList.toggle("dot", S.inv.length > 0 && Date.now() - last > 7 * 864e5);
}
function snapNow() {
  updateDot();
  if (!S.inv.length) return;
  const ym = today().slice(0, 7), id = "s_" + ym, inv = r2(S.inv.reduce((a, h) => a + h.invested, 0)), val = r2(S.inv.reduce((a, h) => a + h.value, 0));
  const s = S.snaps.find(x => x.id === id);
  if (s && s.invested === inv && s.value === val) return;
  if (s) Object.assign(s, { invested: inv, value: val, u: Date.now() }); else S.snaps.push({ id, ym, invested: inv, value: val, u: Date.now() });
  save();
}
function invStatus() {
  if (invNote) return { t: invNote, old: false };
  if (!S.inv.length) return { t: "", old: false };
  const last = Math.max(...S.inv.map(h => Math.max(h.pu || 0, h.u || 0))), days = Math.floor((Date.now() - last) / 864e5), pu = Math.max(...S.inv.map(h => h.pu || 0));
  if (days >= 7) return { t: "Not updated for " + days + " days. Tap Refresh or update values.", old: true };
  return { t: pu ? "Prices updated " + new Date(pu).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Values entered manually", old: false };
}
function drawHist(c) {
  if (!c) return;
  const ss = [...S.snaps].sort((a, b) => a.ym.localeCompare(b.ym)).slice(-12);
  const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight; c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext("2d"); x.scale(dpr, dpr);
  const mx = Math.max(1, ...ss.map(s => Math.max(s.value, s.invested))), base = H - 22, slot = W / Math.max(ss.length, 4), bw = Math.min(26, slot * .6);
  x.font = "11px -apple-system,sans-serif"; x.textAlign = "center";
  ss.forEach((s, i) => {
    const cx = slot * (i + .5), h = Math.max(3, (base - 8) * s.value / mx), ih = (base - 8) * s.invested / mx;
    x.fillStyle = s.value >= s.invested ? "#4ade80" : "#ff5f5f"; x.beginPath(); (x.roundRect || x.rect).call(x, cx - bw / 2, base - h, bw, h, 4); x.fill();
    x.fillStyle = "#fff"; x.fillRect(cx - bw / 2 - 2, base - ih - 1, bw + 4, 2);
    x.fillStyle = "#9a9a9a"; x.fillText(mname(s.ym, { month: "narrow" }), cx, H - 6);
  });
}
const baseRenderInv = renderInv;
renderInv = el => {
  baseRenderInv(el);
  const st = invStatus();
  el.insertAdjacentHTML("afterbegin", `<div class="gf" style="margin:0 0 12px"><small id="invNote" class="${st.old ? "bad" : ""}">${esc(st.t)}</small><button data-iset="1">⚙️</button><button class="pri" data-iref="1">↻ Refresh</button></div>`);
  const ic = el.querySelector(".icard");
  if (ic && S.snaps.length) {
    const rows = [...S.snaps].sort((a, b) => b.ym.localeCompare(a.ym)).slice(0, 6).map(s => { const g = r2(s.value - s.invested); return `<div class="hl"><span>${mname(s.ym)} ${s.ym.slice(0, 4)}</span><span>${fmt(s.value)} <span class="${g >= 0 ? "ok" : "bad"}">${g >= 0 ? "+" : "−"}${fmt(Math.abs(g))}</span></span></div>`; }).join("");
    ic.insertAdjacentHTML("afterend", `<div class="icard"><small>Portfolio by month · bar = value, line = invested</small><canvas id="hist" style="width:100%;height:130px;margin:10px 0 6px"></canvas>${rows}</div>`);
    drawHist(el.querySelector("#hist"));
  }
};
function openPK() {
  const p = PK(); F = { kind: "pk", prov: p.prov || "av" };
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><h3>Price settings</h3><p class="sub">Mutual funds and gold need no key. Stocks need a free API key, saved on this device only.</p>
  <div class="seg mid" style="width:100%;margin-bottom:14px">${[["av", "Alpha Vantage"], ["td", "Twelve Data"]].map(([k, n]) => `<button data-pv="${k}" class="${k === F.prov ? "on" : ""}" style="flex:1;padding:6px 2px">${n}</button>`).join("")}</div>
  <div class="lab">Stock API key</div><input class="fi" data-f="key" value="${esc(p.key || "")}" autocapitalize="off" autocomplete="off" placeholder="Paste key">
  <div class="lab">Gold adjustment % (Indian retail is usually above spot)</div><input class="fi" data-f="adj" inputmode="decimal" value="${esc(p.adj || "")}" placeholder="0">
  <button class="save wide" id="pksave">Save</button>`;
  showSheet();
}
sheet.addEventListener("click", async e => {
  if (!F) return;
  const b = e.target.closest("button"); if (!b) return;
  if (F.kind === "pk") {
    if (b.dataset.pv) { F.prov = b.dataset.pv; sheet.querySelectorAll("[data-pv]").forEach(x => x.classList.toggle("on", x === b)); }
    else if (b.id === "pksave") { const g = k => sheet.querySelector('[data-f="' + k + '"]').value.trim(); localStorage.setItem("mm3pk", JSON.stringify({ prov: F.prov, key: g("key"), adj: g("adj") })); F = null; hideSheet(); }
  } else if (F.kind === "inv" && b.id === "mfFind") {
    const q = sheet.querySelector('[data-f="name"]').value.trim(); if (q.length < 3) { alert("Type part of the fund name in Name first."); return; }
    const box = $("#mfRes"); box.innerHTML = '<div class="lab">Searching…</div>';
    try {
      const r = await getJSON("https://api.mfapi.in/mf/search?q=" + encodeURIComponent(q));
      box.innerHTML = r.slice(0, 6).map(m => `<button class="ghost" style="height:auto;padding:8px 4px;text-align:left;font-size:13px" data-code="${m.schemeCode}">${esc(m.schemeName)}</button>`).join("") || '<div class="lab">No match. Try fewer words.</div>';
    } catch (err) { box.innerHTML = '<div class="lab">Search failed: ' + esc(err.message) + "</div>"; }
  } else if (F.kind === "inv" && b.dataset.code) {
    sheet.querySelector('[data-f="sym"]').value = b.dataset.code; $("#mfRes").innerHTML = '<div class="lab">Selected scheme code ' + esc(b.dataset.code) + "</div>";
  }
});
$("#insBody").addEventListener("click", e => {
  const d = (e.target.closest("button") || {}).dataset; if (!d) return;
  if (d.iref) refreshPrices({}); else if (d.iset) openPK();
});
/* ---------- Category swipe: edit / delete ---------- */
let swipeMoved = false;
(function () {
  const W = 140; let row = null, x0 = 0, base = 0, dx = 0;
  const shut = o => { o.style.transform = ""; o.classList.remove("open"); };
  sheet.addEventListener("pointerdown", e => {
    const r = e.target.closest(".cwrap .crow"); if (!r) return;
    sheet.querySelectorAll(".crow.open").forEach(o => { if (o !== r) shut(o); });
    row = r; x0 = e.clientX; base = r.classList.contains("open") ? -W : 0; dx = 0; r.style.transition = "none";
  });
  sheet.addEventListener("pointermove", e => {
    if (!row) return; dx = e.clientX - x0;
    if (Math.abs(dx) > 8) swipeMoved = true;
    if (swipeMoved) row.style.transform = "translateX(" + Math.max(-W, Math.min(0, base + dx)) + "px)";
  });
  const end = () => {
    if (!row) return; row.style.transition = "";
    const open = swipeMoved ? base + dx < -W / 2 : row.classList.contains("open");
    row.classList.toggle("open", open); row.style.transform = open ? "translateX(-" + W + "px)" : "";
    row = null; setTimeout(() => { swipeMoved = false; }, 120);
  };
  sheet.addEventListener("pointerup", end); sheet.addEventListener("pointercancel", end);
  // a swipe, or a tap on an opened row, must not select the category
  sheet.addEventListener("click", e => {
    const open = e.target.closest(".crow.open");
    if (swipeMoved || open) { e.stopPropagation(); e.preventDefault(); if (open && !swipeMoved) shut(open); }
  }, true);
})();
function recat(type, from, to) {
  const now = Date.now();
  S.tx.forEach(t => { if (t.type === type && t.cat === from) { t.cat = to; t.u = now; } });
  S.rec.forEach(r => { if (r.type === type && r.cat === from) { r.cat = to; r.u = now; } });
}
sheet.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || !D || !(b.dataset.cedit || b.dataset.cdel)) return;
  const list = S.cats[D.type];
  if (b.dataset.cedit) {
    const old = b.dataset.cedit, c = list.find(x => x[0] === old); if (!c) return;
    const n = (prompt("Category name", c[0]) || "").trim().slice(0, 20); if (!n) return;
    const em = (prompt("Emoji", c[1]) || "").trim() || c[1];
    if (n.toLowerCase() !== old.toLowerCase() && list.some(x => x[0].toLowerCase() === n.toLowerCase())) { alert("That category already exists."); return; }
    c[0] = n; c[1] = em; recat(D.type, old, n); if (D.cat === old) D.cat = n;
  } else {
    const old = b.dataset.cdel; if (!confirm("Delete \"" + old + "\"? Its transactions move to Other.")) return;
    S.cats[D.type] = list.filter(x => x[0] !== old); recat(D.type, old, "Other"); if (D.cat === old) D.cat = "Other";
  }
  S.su = Date.now(); save(); drawAdd(); render();
});

/* ---------- Reminders (calendar events) ---------- */
async function shareIcs(summary, desc, rrule, d, h, m) {
  const f2 = x => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + "T" + pad(x.getHours()) + pad(x.getMinutes()) + "00";
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m), e = new Date(+s + 15 * 6e4);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//My Money//EN", "BEGIN:VEVENT", "UID:my-money-" + summary.replace(/\W+/g, "-").toLowerCase() + "@mymoney", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTSTART:" + f2(s), "DTEND:" + f2(e), "RRULE:" + rrule, "SUMMARY:" + summary, "DESCRIPTION:" + desc, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + summary, "TRIGGER:PT0S", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const f = new File([ics], "my-money-" + summary.split(" ")[0].toLowerCase() + ".ics", { type: "text/calendar" });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (err) { if (err.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
}
function calReminder() { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return shareIcs("Update My Money portfolio", "Open My Money > Insights > Invest > Refresh.", "FREQ=MONTHLY", d, 9, 0); }
function refreshDaily() {
  const v = localStorage.getItem("mm3daily");
  $("#dailyVal").textContent = v ? new Date(2000, 0, 1, +v.slice(0, 2), +v.slice(3)).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Off";
}
async function dailyReminder() {
  const a = (prompt("Daily reminder time, 24-hour (for example 21:00). Type off to clear.", localStorage.getItem("mm3daily") || "21:00") || "").trim().toLowerCase();
  if (!a) return;
  if (a === "off") { localStorage.removeItem("mm3daily"); refreshDaily(); alert("To stop the reminders, delete the \"Log expenses\" event in the Calendar app."); return; }
  const mt = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(a); if (!mt) { alert("Use a time like 21:00."); return; }
  const h = +mt[1], m = +mt[2], d = new Date(); if (d.getHours() * 60 + d.getMinutes() >= h * 60 + m) d.setDate(d.getDate() + 1);
  localStorage.setItem("mm3daily", pad(h) + ":" + pad(m)); refreshDaily();
  await shareIcs("Log expenses in My Money", "Add today's expenses to My Money.", "FREQ=DAILY", d, h, m);
}

/* ---------- Typing mode, sheet swipe-down, transaction swipe ---------- */
sheet.addEventListener("focusin", e => { if (e.target.id === "note") sheet.classList.add("typing"); });
sheet.addEventListener("focusout", e => { if (e.target.id === "note") setTimeout(() => { if (document.activeElement !== e.target) sheet.classList.remove("typing"); }, 150); });
sheet.addEventListener("mousedown", e => { if (e.target.closest(".savebar")) e.preventDefault(); }); // keep the keyboard up while tapping Save
sheet.addEventListener("click", e => { if (e.target.closest("#amt") && document.activeElement && document.activeElement.id === "note") document.activeElement.blur(); });
if (window.visualViewport) { // lift the sheet above the on-screen keyboard
  const vv = window.visualViewport, fit = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    sheet.style.bottom = kb ? kb + "px" : ""; sheet.style.maxHeight = kb ? Math.round(vv.height * .96) + "px" : "";
  };
  vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit);
}
(function () { // drag the handle down to close any sheet
  let on = false, y0 = 0, dy = 0;
  sheet.addEventListener("pointerdown", e => { if (e.pointerType === "touch" || !e.target.closest(".hd")) return; on = true; y0 = e.clientY; dy = 0; sheet.style.transition = "none"; try { sheet.setPointerCapture(e.pointerId); } catch (_) {} });
  sheet.addEventListener("pointermove", e => { if (!on) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = "translateY(" + dy + "px)"; });
  const end = () => { if (!on) return; on = false; sheet.style.transition = ""; sheet.style.transform = ""; if (dy > 100) hideSheet(); };
  sheet.addEventListener("pointerup", end); sheet.addEventListener("pointercancel", end);
})();
(function () { // swipe down anywhere on a sheet to close it (touch)
  let t0 = false, y0 = 0, x0 = 0, dy = 0, drag = false, scroller = null;
  sheet.addEventListener("touchstart", e => {
    if (e.touches.length !== 1 || e.target.closest("input,.ruler")) { t0 = false; return; }
    scroller = e.target.closest(".cats"); // a scrolling list only starts a drag when it is at the top
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; drag = false; t0 = true;
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!t0) return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (!drag) {
      if (my > 8 && my > Math.abs(mx) * 1.2 && sheet.scrollTop <= 0 && (!scroller || scroller.scrollTop <= 0)) { drag = true; sheet.style.transition = "none"; y0 = t.clientY; }
      else { if (Math.abs(mx) > 8 || my < -8) t0 = false; return; }
    }
    e.preventDefault(); dy = Math.max(0, t.clientY - y0); sheet.style.transform = "translateY(" + dy + "px)";
  }, { passive: false });
  const end = () => { const was = drag; drag = false; t0 = false; if (!was) return; sheet.style.transition = ""; sheet.style.transform = ""; if (dy > 100) hideSheet(); };
  sheet.addEventListener("touchend", end); sheet.addEventListener("touchcancel", end);
})();
(function () { // swipe a transaction: right = Edit, left = Delete
  const L = $("#list"), W = 76; let r = null, x0 = 0, y0 = 0, base = 0, dx = 0, mv = false;
  const st = el => el.classList.contains("oL") ? W : el.classList.contains("oR") ? -W : 0;
  const shut = el => { el.style.transform = ""; el.classList.remove("oL", "oR"); };
  L.addEventListener("pointerdown", e => {
    const t = e.target.closest(".rw .row"); if (!t) return;
    L.querySelectorAll(".row.oL,.row.oR").forEach(o => { if (o !== t) shut(o); });
    r = t; x0 = e.clientX; y0 = e.clientY; base = st(t); dx = 0; mv = false;
  });
  L.addEventListener("pointermove", e => {
    if (!r) return; dx = e.clientX - x0;
    if (!mv && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) { mv = true; r.style.transition = "none"; }
    if (mv) r.style.transform = "translateX(" + Math.max(-W, Math.min(W, base + dx)) + "px)";
  });
  const end = () => {
    if (!r) return; r.style.transition = "";
    if (mv) { const p = base + dx; shut(r); if (p > W / 2) { r.classList.add("oL"); r.style.transform = "translateX(" + W + "px)"; } else if (p < -W / 2) { r.classList.add("oR"); r.style.transform = "translateX(-" + W + "px)"; } }
    r = null; setTimeout(() => { mv = false; }, 120);
  };
  L.addEventListener("pointerup", end); L.addEventListener("pointercancel", end);
  L.addEventListener("click", e => { // a swipe, or a tap on an opened row, must not open the editor
    const t = e.target.closest(".row"), open = t && (t.classList.contains("oL") || t.classList.contains("oR"));
    if (mv || open) { e.stopImmediatePropagation(); e.preventDefault(); if (open && !mv) shut(t); }
  }, true);
  L.addEventListener("click", e => {
    const b = e.target.closest("[data-redit],[data-rdel]"); if (!b) return;
    const id = b.dataset.redit || b.dataset.rdel, tx = S.tx.find(t => t.id === id); if (!tx) return;
    if (b.dataset.redit) openAdd(tx);
    else if (confirm("Delete this transaction?")) { S.del[id] = Date.now(); S.tx = S.tx.filter(t => t.id !== id); save(); render(); }
  });
})();

/* ---------- Category pills (5 most used, one line) ---------- */
function pillHTML() {
  const list = S.cats[D.type], cnt = {};
  S.tx.forEach(t => { if (t.type === D.type) cnt[t.cat] = (cnt[t.cat] || 0) + 1; });
  const top = [...list].sort((a, b) => (cnt[b[0]] || 0) - (cnt[a[0]] || 0) || list.indexOf(a) - list.indexOf(b)).slice(0, 5);
  if (!top.some(c => c[0] === D.cat)) { const sel = list.find(c => c[0] === D.cat); if (sel) top[4] = sel; }
  return '<div class="pills">' + list.filter(c => top.includes(c)).map(c => `<button class="pill${c[0] === D.cat ? " on" : ""}" data-pill="${esc(c[0])}"><span class="e">${c[1]}</span><span class="pn">${esc(c[0])}</span></button>`).join("") + "</div>";
}
sheet.addEventListener("click", e => {
  const b = e.target.closest("[data-pill]"); if (!b || !D) return;
  D.cat = b.dataset.pill; sheet.querySelectorAll(".pill").forEach(x => x.classList.toggle("on", x === b));
});

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
$("#rcBtn").onclick = openRec;
$("#remBtn").onclick = calReminder;
$("#dailyBtn").onclick = dailyReminder;
$("#menuBtn").onclick = () => openPage("insights");
$("#walletBtn").onclick = () => openPage("settings");
addEventListener("resize", render);
render();
runRecurring();
snapNow(); setTimeout(() => refreshPrices({ auto: true, quiet: true }), 1500);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
