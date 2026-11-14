"use strict";
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s), KEY = "mm3", TW = 9;
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => iso(new Date());
const r2 = n => Math.round(n * 100) / 100;
const fmt = n => "₹" + (+n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const sgn = n => (n >= 0 ? "+" : "−") + fmt(r2(Math.abs(n)));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mname = (k, o) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString("en-IN", o || { month: "long" });
const sum = a => r2(a.reduce((s, t) => s + t.amount, 0));
const DC = {
  expense: [["Food", "🍔", "#f59e0b"], ["Bills", "🧾", "#a78bfa"], ["Home", "🏠", "#34d399"], ["Health", "🏥", "#f87171"], ["EMI", "🏦", "#fb923c"], ["Travel", "🚗", "#60a5fa"], ["Shopping", "🛍️", "#f472b6"], ["Investment", "📈", "#22d3ee"], ["Other", "📦", "#9ca3af"]],
  income: [["Salary", "💼", "#34d399"], ["Business", "🏢", "#f59e0b"], ["Side income", "💻", "#60a5fa"], ["Bonus", "🎉", "#f472b6"], ["Interest", "📈", "#a78bfa"], ["Other", "💰", "#9ca3af"]]
};
const fresh = () => ({ tx: [], budgets: {}, cats: JSON.parse(JSON.stringify(DC)), name: "My Money", del: {}, su: 0, rec: [], goals: [], loans: [], cb: {} });
let S; try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!S || !Array.isArray(S.tx)) S = fresh();
S.del = S.del || {}; S.su = S.su || 0; S.rec = S.rec || []; S.goals = S.goals || []; S.loans = S.loans || []; delete S.inv; delete S.snaps; try { localStorage.removeItem("mm3pk"); } catch (e) {} S.cb = S.cb || {};
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
  const yr = String(new Date().getFullYear()), all = type === "net" ? S.tx : S.tx.filter(t => t.type === type), isN = type === "net";
  const list = range === "1M" ? all.filter(t => t.date.startsWith(vm)) : range === "1Y" ? all.filter(t => t.date.startsWith(yr)) : all;
  $("#period").textContent = range === "1M" ? mname(vm) + (vm.slice(0, 4) !== yr ? " " + vm.slice(0, 4) : "") : range === "1Y" ? yr : "All time";
  $("#mPrev").classList.toggle("hide", range !== "1M"); $("#mNext").classList.toggle("hide", range !== "1M"); $("#mNext").disabled = vm >= today().slice(0, 7);
  const tot = sum(list), bud = budgetFor(vm), isB = type === "expense" && range === "1M";
  const iS = sum(list.filter(t => t.type === "income")), eS = sum(list.filter(t => t.type === "expense")), nv = r2(iS - eS);
  $("#total").textContent = isN ? sgn(nv) : fmt(tot); $("#total").className = "total" + (isN ? (nv >= 0 ? " pos" : " neg") : "");
  const bl = $("#bl");
  const inScope = t => range === "1M" ? t.date.startsWith(vm) : range === "1Y" ? t.date.startsWith(yr) : true, any = S.tx.some(inScope);
  const net = r2(sum(S.tx.filter(t => t.type === "income" && inScope(t))) - sum(S.tx.filter(t => t.type === "expense" && inScope(t))));
  bl.textContent = isN ? (list.length ? "Income " + fmt(iS) + " · Spent " + fmt(eS) : "") : isB ? (bud ? "of " + fmt(bud) + " budget" : "Set a budget") : (any ? "Net saved " + sgn(net) : "");
  bl.className = "bl" + (isB && bud && tot > bud ? " over" : "") + (!isB && !isN && any ? (net >= 0 ? " pos" : " over") : "");
  const vk = type + "|" + range + "|" + vm, viewChanged = vk !== lastVK; lastVK = vk;
  if (viewChanged) animateChart(list); else chart(list);
  const L = $("#list"); if (viewChanged) { L.classList.remove("enter"); void L.offsetWidth; L.classList.add("enter"); }
  if (!list.length) { L.innerHTML = '<div class="empty">No transactions yet</div>'; return; }
  if (range === "1M") {
    L.innerHTML = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.u || 0) - (a.u || 0)).map(t =>
      `<div class="rw"><div class="ra l"><button class="ed" data-redit="${esc(t.id)}" aria-label="Edit">${ICO_ED}</button></div><div class="ra r"><button class="dl" data-rdel="${esc(t.id)}" aria-label="Delete">${ICO_DEL}</button></div><button class="row" data-id="${esc(t.id)}"><div class="badge">${t.date.slice(8)}<small>${mname(t.date, { month: "short" }).toUpperCase()}</small></div><span class="n">${esc(t.note || t.cat)}${txTime(t)}</span><span class="a ${t.type}">${isN ? (t.type === "income" ? "+" : "−") : ""}${fmt(t.amount)}</span></button></div>`).join("");
  } else {
    const by = {}; list.forEach(t => { const k = t.date.slice(0, 7); by[k] = (by[k] || 0) + (isN && t.type === "expense" ? -t.amount : t.amount); });
    L.innerHTML = Object.keys(by).sort().reverse().map(k =>
      `<button class="row mr" data-m="${k}"><span class="n">${mname(k)}${range === "All" ? " " + k.slice(0, 4) : ""}</span><span class="a ${isN ? (by[k] >= 0 ? "income" : "neg") : type}">${isN ? sgn(r2(by[k])) : fmt(r2(by[k]))}</span><span class="chev">›</span></button>`).join("");
  }
}

function chart(list, pr) {
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
  const isN = type === "net", sumK = (k, ty) => list.filter(t => t.date.startsWith(k) && (!ty || t.type === ty)).reduce((a, t) => a + t.amount, 0);
  const valsI = isN ? keys.map(k => sumK(k, "income")) : [], valsE = isN ? keys.map(k => sumK(k, "expense")) : [];
  const vals = isN ? keys.map((_, i) => Math.max(valsI[i], valsE[i])) : keys.map(k => sumK(k));
  const L = 26, R = 26, top = 10, base = H - 30, slot = (W - L - R) / keys.length;
  const bw = Math.min(range === "1M" ? 8 : 24, slot * .68), max = Math.max(1, ...vals);
  x.strokeStyle = "#333"; x.lineWidth = 1.2; x.setLineDash([5, 6]);
  
  const td = +today().slice(8), isCur = range === "1M" && vm === tk.slice(0, 7);
  x.font = "13px -apple-system,sans-serif"; x.textAlign = "center";
  vals.forEach((v, i) => {
    const cx = L + slot * (i + .5);
    const bar = (c2, val, col, w) => { if (val > 0) { const hh = Math.max(4, (base - top) * val / max * (pr ? pr(i) : 1)); x.fillStyle = col; x.beginPath(); (x.roundRect || x.rect).call(x, c2 - w / 2, base - hh, w, hh, 4); x.fill(); } };
    if (isN) { bar(cx - bw / 4 - .5, valsI[i], "#4ade80", bw / 2 - 1); bar(cx + bw / 4 + .5, valsE[i], "#ff5f5f", bw / 2 - 1); } else bar(cx, v, type === "expense" ? "#fe4f4f" : "#4ade80", bw);
    const d = lab[i];
    const show = range !== "1M" || d === 1 || (isCur && d === td) || ((d - 1) % 4 === 0 && !(isCur && Math.abs(d - td) < 3));
    if (show) { x.fillStyle = "#cfcfcf"; x.fillText(String(d), cx, base + 21); }
    if (v === 0 && range === "1M" && type === "expense" && !(isCur && d > td)) { x.fillStyle = "#4ade80"; x.beginPath(); x.arc(cx, base - 5, 2.4, 0, 7); x.fill(); }
  });
}

/* ---------- Add / edit sheet ---------- */
/* Tap feedback. Android vibrates with a pattern; iPhone (iOS 18 and later) plays its own tap when a hidden switch is toggled */
let hapticSwitch = null;
function haptic(kind) {
  const pattern = { warn: [30, 70, 30], del: [40] }[kind] || [12];
  if (navigator.vibrate) { navigator.vibrate(pattern); return; }
  if (!hapticSwitch) {
    const lab = document.createElement("label");
    lab.setAttribute("aria-hidden", "true");
    lab.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none";
    const box = document.createElement("input");
    box.type = "checkbox"; box.setAttribute("switch", ""); box.tabIndex = -1;
    lab.appendChild(box); document.body.appendChild(lab); hapticSwitch = lab;
  }
  hapticSwitch.click();
}
/* The time of the last save or edit, shown in grey under the description; generated or older entries have no time */
function txTime(t) {
  if (!t.u) return "";
  const d = new Date(t.u);
  if (!d.getHours() && !d.getMinutes() && !d.getSeconds() && !d.getMilliseconds()) return "";
  return "<small>" + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</small>";
}
function openAdd(t) {
  D = t ? { id: t.id, type: t.type, amt: String(t.amount), note: t.note || "", cat: t.cat, date: t.date, panel: "keys" }
        : { type: type === "net" ? "expense" : type, amt: "", note: "", cat: defaultCat(type === "net" ? "expense" : type), date: today(), panel: "keys" };
  D.cm = D.date.slice(0, 7); D.manual = !!t; sheet.className = "sheet"; drawAdd(); showSheet();
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
  const c = catInfo(D.type, D.cat), pop = D.pop ? " pop" : "";
  D.pop = false;
  let body;
  if (D.panel === "cats") {
    body = '<div class="cats' + pop + '">' + S.cats[D.type].map(k => `<div class="cwrap">${k[0] === "Other" ? "" : `<div class="cact"><button data-cedit="${esc(k[0])}">Edit</button><button data-cdel="${esc(k[0])}">Delete</button></div>`}<button class="crow" data-cat="${esc(k[0])}"><span class="ce">${k[1]}</span><span class="cn">${esc(k[0])}</span><i style="background:${k[2]}"></i><b>${k[0] === D.cat ? "✓" : ""}</b></button></div>`).join("")
      + '<button class="crow" id="addCat"><span class="ce">＋</span><span class="cn">Add category</span></button></div>';
  } else if (D.panel === "cal") body = calendar().replace('class="cal"', 'class="cal' + pop + '"');
  else body = '<div class="keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join("") + '<button data-k="<">‹</button><button data-k="0">0</button><button class="save" id="nextBtn" data-k="save" aria-label="Save"' + (+D.amt > 0 ? "" : " disabled") + '>Save</button></div>';
  const dl = D.date === today() ? "Today" : new Date(+D.date.slice(0, 4), +D.date.slice(5, 7) - 1, +D.date.slice(8)).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  sheet.classList.remove("typing"); sheet.classList.toggle("nofit", D.panel !== "keys");
  sheet.innerHTML = `<div class="hd"></div>${D.id ? '<button class="del" id="delTx">Delete</button><button class="dup" id="dupTx">Copy</button>' : ""}
  <div class="seg mid"><button data-st="expense" class="${D.type === "expense" ? "on" : ""}">Expense</button><button data-st="income" class="${D.type === "income" ? "on" : ""}">Income</button></div>
  <div class="amt ${D.amt ? "" : "z"}" id="amt"><span>₹</span>${D.amt || 0}</div>
  <input class="note" id="note" placeholder="Description" maxlength="60" value="${esc(D.note)}">
  ${quickHTML()}
  <div class="chips"><button class="chip" id="catBtn">${esc(c[1])} ${esc(c[0])} ⌄</button><button class="chip" id="dateBtn"><svg class="ic" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>${dl}</button></div>${body}<div class="savebar"><button class="save wide" id="svBtn" data-k="save"${D.note.trim() || D.id ? "" : " disabled"}>Save</button></div>`;
}
function key(k) {
  if (k === "save") return saveTx();
  if (k === "next") { if (+D.amt > 0) $("#note").focus({ preventScroll: true }); return; }
  if (k === "<") D.amt = D.amt.slice(0, -1);
  else if (D.amt.length < 9 && !(D.amt === "" && k === "0")) D.amt += k;
  const a = $("#amt"); a.innerHTML = "<span>₹</span>" + (D.amt || 0); a.classList.toggle("z", !D.amt); const nb = $("#nextBtn"); if (nb) nb.disabled = !(+D.amt > 0);
}
function saveTx() {
  const a = +D.amt || 0;
  if (!(a > 0)) { alert("Enter an amount greater than zero."); return; }
  if (!D.id && !D.note.trim()) { nudgeNote(); haptic("warn"); return; }
  const tx = { id: D.id || crypto.randomUUID(), type: D.type, amount: a, date: D.date, note: D.note.trim(), cat: D.cat, u: Date.now() };
  const i = S.tx.findIndex(t => t.id === tx.id);
  if (i >= 0) S.tx[i] = tx; else S.tx.push(tx);
  if (D.rep && !D.id) S.rec.push({ id: crypto.randomUUID(), type: tx.type, amount: tx.amount, cat: tx.cat, note: tx.note, day: +tx.date.slice(8), last: tx.date.slice(0, 7), u: Date.now() });
  haptic(D.id ? "edit" : "ok"); save(); hideSheet(); if (type !== "net") type = tx.type; vm = tx.date.slice(0, 7); range = "1M"; render(); catWarn(tx, !D.id);
}
sheet.oninput = e => { if (e.target.id === "note") { D.note = e.target.value; const b = $("#svBtn"); if (b) b.disabled = !(D.note.trim() || D.id); suggestCat(); } };
sheet.onkeydown = e => { if (e.key === "Enter") e.target.blur(); };
sheet.onclick = e => {
  const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
  if (d.st) { D.type = d.st; if (!S.cats[D.type].some(c => c[0] === D.cat)) D.cat = defaultCat(D.type); D.panel = "keys"; drawAdd(); }
  else if (d.k !== undefined) key(d.k);
  else if (d.cat !== undefined) { D.cat = d.cat; D.manual = true; D.panel = "keys"; drawAdd(); }
  else if (b.id === "catBtn") { D.panel = D.panel === "cats" ? "keys" : "cats"; D.pop = true; drawAdd(); }
  else if (b.id === "dateBtn") { D.panel = D.panel === "cal" ? "keys" : "cal"; D.cm = D.date.slice(0, 7); D.pop = true; drawAdd(); }
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
  
  else if (b.id === "delTx") { const id = D.id; hideSheet(); delTx(id); }
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
  const inc = sum(S.tx.filter(t => t.type === "income" && t.date.startsWith(vm)));
  if (tab === "spending") {
    const by = {}; ex.forEach(t => by[t.cat] = (by[t.cat] || 0) + t.amount);
    const names = [...new Set([...S.cats.expense.map(c => c[0]), ...Object.keys(by)])].sort((a, b) => (by[b] || 0) - (by[a] || 0));
    el.innerHTML = '<div class="lab" style="text-align:center;margin-bottom:6px">' + mname(vm) + " · tap a category to set a monthly limit</div>" + names.map(n => {
      const c = catInfo("expense", n), v = r2(by[n] || 0), lim = S.cb[n] || 0, p = lim ? v / lim : (tot ? v / tot : 0);
      const col = lim ? (p > 1 ? "#ff5f5f" : p >= .8 ? "#f59e0b" : c[2]) : c[2];
      return `<button class="srow" data-cb="${esc(n)}"><span class="ce">${c[1]}</span><div><div class="sl"><b>${esc(n)}</b><em>${fmt(v)}${lim ? " / " + fmt(lim) : ""}</em></div><div class="bar"><i style="width:${Math.min(100, p * 100)}%;background:${col}"></i></div></div></button>`;
    }).join("");
    return;
  }
  if (!ex.length && !inc) { el.innerHTML = '<div class="empty" style="text-align:center">No transactions in ' + mname(vm) + "</div>"; return; }
  const y = +vm.slice(0, 4), m = +vm.slice(5, 7), dim = new Date(y, m, 0).getDate(), cur = vm === today().slice(0, 7);
  const days = cur ? new Date().getDate() : dim, avg = tot / days, bud = budgetFor(vm);
  const pk = iso(new Date(y, m - 2, 1)).slice(0, 7), prev = sum(S.tx.filter(t => t.type === "expense" && t.date.startsWith(pk)));
  const cards = [["Spent in " + mname(vm), fmt(tot)], ["Income", fmt(inc)], ["Net saved", sgn(r2(inc - tot))], ["Daily average", fmt(r2(avg))]];
  if (cur) cards.push(["Projected month-end", fmt(Math.round(avg * dim))]);
  if (bud) cards.push([tot > bud ? "Over budget by" : "Left in budget", fmt(r2(Math.abs(bud - tot)))]);
  if (prev) cards.push(["Vs last month", (tot >= prev ? "+" : "−") + Math.round(Math.abs(tot - prev) / prev * 100) + "%"]);
  Object.entries(S.cb).forEach(([n, lim]) => { const v = sum(ex.filter(t => t.cat === n)); if (lim && v >= lim * .8) cards.push([n + (v > lim ? " is over its limit" : " is near its limit"), Math.round(v / lim * 100) + "% of " + fmt(lim)]); });
  el.innerHTML = cards.map(c => `<div class="icard"><small>${c[0]}</small><b>${c[1]}</b></div>`).join("") + '<button class="save wide" data-report="1">Share ' + mname(vm) + " report</button>";
}
$("#insTabs").onclick = e => { const b = e.target.closest("button"); if (b) { tab = b.dataset.tab; renderIns(); } };
const openPage = id => { if (id === "insights") renderIns(); else { $("#nm").textContent = S.name + " ✎"; refreshAcct(); refreshDaily(); } showPage($("#" + id)); };
$$("[data-close]").forEach(b => b.onclick = () => closePage(b.closest(".page")));
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
$("#er").onclick = () => { if (confirm("Erase all data on this device? This cannot be undone.") && confirm("Really erase everything?")) { const del = { ...S.del }; S.tx.forEach(t => del[t.id] = Date.now()); S.rec.forEach(r => del[r.id] = Date.now()); S.goals.forEach(r => del[r.id] = Date.now()); S.loans.forEach(r => del[r.id] = Date.now()); S = fresh(); S.del = del; S.su = Date.now(); save(); render(); closePage($("#settings")); } };

/* ---------- Cloud sync (Supabase) ---------- */
const SB_URL = "https://qmqwzhfkvykvdkdurtdh.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtcXd6aGZrdnlrdmRrZHVydGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDk4MjcsImV4cCI6MjEwOTAyNTgyN30.PHhMIjvOHIAokPdoede5ZVfglaUC0QxOGu6spw_4cXU";
const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;
let user = null, syncMsg = "", syncing = false, st = null;
const schedSync = () => { if (user) { clearTimeout(st); st = setTimeout(syncNow, 1500); } };
function setMsg(m) { syncMsg = m; refreshAcct(); }
function refreshAcct() {
  $("#acct").textContent = user ? user.email + (syncMsg ? " · " + syncMsg : "") : "Sign in to sync";
  document.querySelector(".em").textContent = user ? user.email : "Data is stored on this device";
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
  return { tx: mix(a.tx, b.tx), rec: mix(a.rec, b.rec), goals: mix(a.goals, b.goals), loans: mix(a.loans, b.loans), del, cb: s.cb || {}, budgets: s.budgets || {}, cats: s.cats || a.cats, name: s.name || a.name, su: Math.max(a.su || 0, b.su || 0) };
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) { runRecurring(); syncNow(); } });
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
      const sk = (r.skip || []).indexOf(ym); if (sk >= 0) r.skip.splice(sk, 1);
      if (!r.paused && sk < 0 && !S.del[id] && !S.tx.some(x => x.id === id)) S.tx.push({ id, type: r.type, amount: r.amount, date, note: r.note, cat: r.cat, u: new Date(date + "T00:00:00").getTime() });
      r.last = ym; r.u = Date.now(); changed = true;
    }
  });
  if (changed) { save(); render(); }
}
function openRec() {
  sheet.className = "sheet";
  const L = S.rec.map(r => {
    const c = catInfo(r.type, r.cat), nd = nextDue(r), sk = (r.skip || []).includes(nd.ym);
    return `<button class="rrow${r.paused ? " off" : ""}" data-rec="${esc(r.id)}"><span class="ce">${c[1]}</span><span class="n">${esc(r.note || r.cat)}<small>${r.paused ? "Paused · day " + r.day : (sk ? "Skipping " : "Next ") + dLabel(nd.date)}</small></span><span class="a ${r.type}">${fmt(r.amount)}</span><span class="chev">›</span></button>`;
  }).join("");
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
  const rows = S.goals.map(g => {
    const p = pct(g.saved, g.target), left = Math.max(0, r2(g.target - g.saved));
    return `<div class="nrow"><div class="nt"><i class="dot g"></i><span class="nn">${esc(g.name)}</span><span class="na">${fmt(g.saved)} / ${fmt(g.target)}</span></div><div class="nb"><i style="width:${p}%;background:var(--grn)"></i></div><div class="nf"><small>${p >= 100 ? "Goal reached 🎉" : p + "% · " + fmt(left) + " to go"}</small><button data-gedit="${esc(g.id)}">Edit</button><button class="acc g" data-gadd="${esc(g.id)}">+ Add</button></div></div>`;
  }).join("");
  el.innerHTML = `<h2 class="hd2">Put money aside<br>for what <span class="acc g">matters.</span></h2>`
    + `<div class="ncard">${rows || '<div class="nrow"><div class="nt"><i class="dot g"></i><span class="nn">Set a target for anything</span></div></div><div class="nrow"><div class="nt"><i class="dot g"></i><span class="nn">Add money as you save</span></div></div><div class="nrow"><div class="nt"><i class="dot g"></i><span class="nn">See how close you are</span></div></div>'}</div>`
    + `<p class="hint">Save it first, then buy it.<br>No EMIs, no interest.</p><button class="acc g link" data-gnew="1">+ Add a goal</button>`;
}
function renderLoans(el) {
  const rows = S.loans.map(l => {
    const p = pct(l.paid, l.total), left = Math.max(0, r2(l.total - l.paid)), n = l.emi > 0 ? Math.ceil(left / l.emi) : 0;
    return `<div class="nrow"><div class="nt"><i class="dot r"></i><span class="nn">${esc(l.name)}</span><span class="na">${fmt(l.paid)} / ${fmt(l.total)}</span></div><div class="nb"><i style="width:${p}%;background:var(--red)"></i></div><div class="nf"><small>${left <= 0 ? "Paid off 🎉" : fmt(left) + " left · " + n + " EMI" + (n === 1 ? "" : "s") + " of " + fmt(l.emi)}</small><button data-ledit="${esc(l.id)}">Edit</button>${left > 0 && l.emi > 0 ? `<button class="acc r" data-lpay="${esc(l.id)}">Pay EMI</button>` : ""}</div></div>`;
  }).join("");
  el.innerHTML = `<h2 class="hd2">All your loans,<br>in <span class="acc r">one place.</span></h2>`
    + `<div class="ncard">${rows || '<div class="nrow"><div class="nt"><i class="dot r"></i><span class="nn">Track every EMI you pay</span></div></div><div class="nrow"><div class="nt"><i class="dot r"></i><span class="nn">See your total EMI each month</span></div></div><div class="nrow"><div class="nt"><i class="dot r"></i><span class="nn">Know when each loan ends</span></div></div>'}</div>`
    + `<button class="acc r link" data-lnew="1">+ Add a loan</button>`;
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
  haptic("ok");
  save(); renderIns(); render();
}
function finishForm() { save(); hideSheet(); F = null; renderIns(); render(); }
sheet.addEventListener("click", e => {
  const id = e.target.id;
  if (!F || !["fsave", "fdel", "psave"].includes(id)) return;
  const G = F.kind === "goal", key = { goal: "goals", loan: "loans" }[F.kind], list = S[key];
  const v = k => { const el = sheet.querySelector('[data-f="' + k + '"]'); return el ? el.value : ""; };
  if (id === "fdel") { if (confirm("Delete this " + F.kind + "?")) { S.del[F.id] = Date.now(); S[key] = list.filter(x => x.id !== F.id); haptic("del"); finishForm(); } return; }
  if (id === "psave") {
    const a = num(v("amt")); if (!(a > 0)) { alert("Enter an amount greater than zero."); return; }
    const g = S.goals.find(x => x.id === F.id); g.saved = r2(g.saved + a); g.u = Date.now(); haptic("ok"); finishForm(); return;
  }
  const name = v("name").trim();
  const o = G ? { name, target: num(v("target")), saved: num(v("saved")) } : { name, total: num(v("total")), emi: num(v("emi")), paid: num(v("paid")) };
  if (F.kind === "loan") o.paid = Math.min(o.paid, o.total);
  const need = G ? o.target : o.total;
  if (!name || !(need > 0)) { alert("Enter a name and an amount greater than zero."); return; }
  const hapKind = F.id ? "edit" : "ok";
  const ex = list.find(x => x.id === F.id);
  if (ex) Object.assign(ex, o, { u: Date.now() }); else { const nid = crypto.randomUUID(); F.id = nid; list.push({ id: nid, ...o, u: Date.now() }); }
  haptic(hapKind);
  finishForm();
});
$("#insBody").onclick = e => {
  const d = (e.target.closest("button") || {}).dataset; if (!d) return;
  if (d.gnew) openForm("goal"); else if (d.gedit) openForm("goal", d.gedit); else if (d.gadd) openAddMoney(d.gadd);
  else if (d.lnew) openForm("loan"); else if (d.ledit) openForm("loan", d.ledit); else if (d.lpay) payEmi(d.lpay);
};

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
sheet.addEventListener("click", e => { if (e.target.closest("#amt")) { sheet.classList.remove("typing"); if (document.activeElement && document.activeElement.id === "note") document.activeElement.blur(); } });
// The sheet stays where it is; the on-screen keyboard opens over its lower part.
/* ---------- Add sheet: tapping the description never moves the page; Return closes the keyboard; an empty description shakes ---------- */
function nudgeNote() {
  const n = $("#note"); if (!n) return;
  n.classList.remove("nudge"); void n.offsetWidth; n.classList.add("nudge");
}
sheet.addEventListener("touchend", e => { const n = e.target.closest && e.target.closest("#note"); if (n && document.activeElement !== n) n.focus({ preventScroll: true }); }, { passive: true });
sheet.addEventListener("click", e => { const n = e.target.closest && e.target.closest("#note"); if (n && document.activeElement !== n) n.focus({ preventScroll: true }); });
sheet.addEventListener("keydown", e => { if (e.target.id === "note" && e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
/* Add sheet: a tap anywhere on the page closes the open calendar or category list; taps inside them and on their own chips still work */
sheet.addEventListener("click", e => {
  if (!$("#amt") || !D || D.panel === "keys") return;
  if (e.target.closest(".cats, .cal, #catBtn, #dateBtn, #delTx, #dupTx")) return;
  D.panel = "keys"; drawAdd();
  if (e.target.closest("#note")) $("#note").focus({ preventScroll: true });
});
/* A new entry starts on the category used most for its type; with no history, the first category (Food for expenses) */
function defaultCat(t) {
  const list = S.cats[t] || [], used = new Map();
  S.tx.forEach(x => { if (x.type === t && list.some(c => c[0] === x.cat)) used.set(x.cat, (used.get(x.cat) || 0) + 1); });
  let best = (list.find(c => c[0] === "Food") || list[0] || ["Other"])[0], bestN = 0;
  list.forEach(c => { if (c[0] === "Other") return; const n = used.get(c[0]) || 0; if (n > bestN) { best = c[0]; bestN = n; } });
  return best;
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
    else delTx(id);
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
  D.cat = b.dataset.pill; D.manual = true; sheet.querySelectorAll(".pill").forEach(x => x.classList.toggle("on", x === b));
});

/* ---------- Month navigation, category limits, toast ---------- */
function shiftMonth(d) {
  const t = new Date(+vm.slice(0, 4), +vm.slice(5, 7) - 1 + d, 1), ym = t.getFullYear() + "-" + pad(t.getMonth() + 1);
  const now = new Date(), lo = iso(new Date(now.getFullYear(), now.getMonth() - 36, 1)).slice(0, 7);
  if (ym > today().slice(0, 7) || ym < lo) return; vm = ym; render();
}
$("#mPrev").onclick = () => shiftMonth(-1); $("#mNext").onclick = () => shiftMonth(1);
(function () { // swipe the chart sideways to change month
  const c = $("#chart"); let x0 = 0, y0 = 0, on = false;
  c.addEventListener("pointerdown", e => { on = true; x0 = e.clientX; y0 = e.clientY; });
  c.addEventListener("pointerup", e => { if (!on) return; on = false; const dx = e.clientX - x0, dy = e.clientY - y0; if (range === "1M" && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1); });
  c.addEventListener("pointercancel", () => { on = false; });
})();
function toast(m, undo) {
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = m;
  if (undo) { const b = document.createElement("button"); b.className = "undo"; b.textContent = "Undo"; b.onclick = () => { undo(); t.classList.remove("on"); }; t.appendChild(b); }
  t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), undo ? 6000 : 3400);
}
function catWarn(tx, isNew) {
  const lim = S.cb[tx.cat]; if (!isNew || tx.type !== "expense" || !lim) return;
  const v = sum(S.tx.filter(t => t.type === "expense" && t.cat === tx.cat && t.date.startsWith(tx.date.slice(0, 7)))), before = r2(v - tx.amount);
  if (v > lim && before <= lim) toast("Over your " + tx.cat + " limit: " + fmt(v) + " of " + fmt(lim));
  else if (v >= lim * .8 && before < lim * .8) toast(tx.cat + ": " + Math.round(v / lim * 100) + "% of " + fmt(lim) + " used");
}
function openCB(name) {
  F = { kind: "cb", name }; sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><h3>${esc(name)} limit</h3><p class="sub">Monthly spending limit for this category. You get a warning at 80%.</p><input class="fi" data-f="lim" inputmode="decimal" placeholder="Amount (₹)" value="${S.cb[name] || ""}"><button class="save wide" id="cbsave">Save</button>${S.cb[name] ? '<button class="ghost" id="cbrm">Remove limit</button>' : ""}`;
  showSheet();
}
sheet.addEventListener("click", e => {
  if (!F || F.kind !== "cb") return;
  const id = e.target.id; if (id !== "cbsave" && id !== "cbrm") return;
  if (id === "cbrm") delete S.cb[F.name];
  else { const v = num(sheet.querySelector('[data-f="lim"]').value); if (!(v > 0)) { alert("Enter a limit greater than zero."); return; } S.cb[F.name] = v; }
  S.su = Date.now(); save(); hideSheet(); F = null; renderIns();
});
$("#insBody").addEventListener("click", e => { const b = e.target.closest("[data-cb]"); if (b) openCB(b.dataset.cb); });

/* ---------- Swipe a page sideways to go back, search & filter ---------- */
/* ---------- Page transitions: scale-in on open, swipe right to close ---------- */
var lastVK = "", chartRAF = 0;
const stage = $("#stage");
function syncStage() { stage.classList.toggle("under", !!document.querySelector(".page.open")); }
function showPage(p) { p.style.transform = ""; p.classList.add("open"); syncStage(); }
function closePage(p) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (!p.classList.contains("open")) return;
  p.style.transition = "transform .26s cubic-bezier(.22,.7,.3,1)"; p.style.transform = "translateX(100%)";
  stage.style.transition = ""; stage.style.transform = ""; stage.classList.remove("under");
  setTimeout(() => { p.classList.remove("open"); p.style.transition = ""; p.style.transform = ""; syncStage(); }, 270);
}
$$(".page").forEach(p => {
  let x0 = 0, y0 = 0, dx = 0, t0 = 0, on = false, drag = false;
  const W = () => window.innerWidth;
  p.addEventListener("touchstart", e => {
    if (e.touches.length !== 1 || e.target.closest("input,textarea,select,.seg,.fl,.cats,.cwrap")) { on = false; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; t0 = Date.now(); on = true; drag = false;
  }, { passive: true });
  p.addEventListener("touchmove", e => {
    if (!on) return;
    const t = e.touches[0], ddx = t.clientX - x0, ddy = t.clientY - y0;
    if (!drag) {
      if (ddx > 22 && ddx > Math.abs(ddy) * 2.5) { drag = true; p.style.transition = "none"; stage.style.transition = "none"; }
      else { if (Math.abs(ddy) > 12 || ddx < -12) on = false; return; }
    }
    dx = Math.max(0, ddx - 22); e.preventDefault();
    p.style.transform = "translateX(" + dx + "px)";
    stage.style.transform = "translateX(" + (-0.28 * W() * (1 - Math.min(1, Math.max(0, dx - 0.2 * W()) / (0.8 * W())))) + "px)";
  }, { passive: false });
  const end = () => {
    const was = drag; drag = false; on = false;
    if (!was) return;
    p.style.transition = ""; stage.style.transition = "";
    const fast = dx > 40 && dx / Math.max(1, Date.now() - t0) > 0.45;
    if (dx > W() * 0.35 || fast) closePage(p);
    else { p.style.transition = "transform .25s cubic-bezier(.22,.7,.3,1)"; p.style.transform = ""; stage.style.transform = ""; setTimeout(() => { p.style.transition = ""; }, 260); }
  };
  p.addEventListener("touchend", end); p.addEventListener("touchcancel", end);
});
function animateChart(list) {
  cancelAnimationFrame(chartRAF);
  const t0 = performance.now(), dur = 330, ease = t => 1 - Math.pow(1 - t, 3), clamp = v => Math.max(0, Math.min(1, v));
  const step = now => {
    const p = clamp((now - t0) / dur);
    chart(list, i => ease(clamp((p - 0.22 * (i / 31)) / 0.78)));
    chartRAF = p < 1 ? requestAnimationFrame(step) : 0;
  };
  step(t0);
}
const SQ = { q: "", t: "all", per: "All", cat: "" };
function renderSearch() {
  const now = new Date(), d3 = iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), yr = String(now.getFullYear());
  const q = SQ.q.trim().toLowerCase(), qn = q.replace(/[₹,\s]/g, ""), isNum = /^\d+(\.\d+)?$/.test(qn);
  const inPer = t => SQ.per === "All" || (SQ.per === "vm" && t.date.startsWith(vm)) || (SQ.per === "3M" && t.date >= d3) || (SQ.per === "1Y" && t.date.startsWith(yr));
  const base = S.tx.filter(t => (SQ.t === "all" || t.type === SQ.t) && inPer(t) && (!q || (t.note || "").toLowerCase().includes(q) || t.cat.toLowerCase().includes(q) || (isNum && String(t.amount).includes(qn))));
  const cats = [...new Set(base.map(t => t.cat))].sort(); if (SQ.cat && !cats.includes(SQ.cat)) SQ.cat = "";
  const res = base.filter(t => !SQ.cat || t.cat === SQ.cat).sort((a, b) => b.date.localeCompare(a.date) || (b.u || 0) - (a.u || 0));
  $$("#sType button").forEach(x => x.classList.toggle("on", x.dataset.s === SQ.t));
  $("#sPer").innerHTML = [["All", "All time"], ["vm", mname(vm)], ["3M", "3 months"], ["1Y", "This year"]].map(([k, n]) => `<button data-sp="${k}" class="${k === SQ.per ? "on" : ""}">${esc(n)}</button>`).join("");
  const em = c => (S.cats.expense.concat(S.cats.income).find(x => x[0] === c) || ["", "🏷️"])[1];
  $("#sCat").innerHTML = cats.map(c => `<button data-sc="${esc(c)}" class="${c === SQ.cat ? "on" : ""}">${em(c)} ${esc(c)}</button>`).join("");
  const I = sum(res.filter(t => t.type === "income")), E = sum(res.filter(t => t.type === "expense")), N = r2(I - E);
  $("#sSum").innerHTML = res.length ? `<div class="icard" style="margin-top:14px"><small>${res.length} result${res.length === 1 ? "" : "s"}</small><b class="${N >= 0 ? "up" : "dn"}">${sgn(N)}</b><div class="gl">Income ${fmt(I)} · Spent ${fmt(E)}</div></div>` : "";
  $("#sList").innerHTML = res.length ? res.slice(0, 200).map(t => `<button class="row" data-sid="${esc(t.id)}" style="padding:10px 4px"><div class="badge">${t.date.slice(8)}<small>${mname(t.date, { month: "short" }).toUpperCase()}</small></div><span class="n">${esc(t.note || t.cat)}<small>${esc(t.cat)} · ${t.date.slice(0, 4)}</small></span><span class="a ${t.type}">${t.type === "income" ? "+" : "−"}${fmt(t.amount)}</span></button>`).join("") + (res.length > 200 ? '<div class="empty" style="text-align:center">Showing the latest 200</div>' : "") : '<div class="empty" style="text-align:center">No matches</div>';
}
$("#sq").addEventListener("input", e => { SQ.q = e.target.value; renderSearch(); });
$("#sq").addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });
$("#search").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
  if (d.s) { SQ.t = d.s; renderSearch(); } else if (d.sp) { SQ.per = d.sp; renderSearch(); }
  else if (d.sc !== undefined) { SQ.cat = SQ.cat === d.sc ? "" : d.sc; renderSearch(); }
  else if (d.sid) { const tx = S.tx.find(t => t.id === d.sid); if (tx) openAdd(tx); }
});
$("#srchBtn").onclick = () => { renderSearch(); showPage($("#search")); $("#sq").focus(); };
const baseRender = render;
render = function () { baseRender.apply(this, arguments); if ($("#search").classList.contains("open")) renderSearch(); };

/* ---------- Undo delete, smart category, CSV export ---------- */
function delTx(id) {
  const tx = S.tx.find(t => t.id === id); if (!tx) return;
  haptic("del"); S.del[id] = Date.now(); S.tx = S.tx.filter(t => t.id !== id); save(); render();
  toast("Transaction deleted", () => { delete S.del[id]; S.tx.push({ ...tx, u: Date.now() }); save(); render(); });
}
function suggestCat() { // pick the category you usually use for this description, unless you already chose one
  if (!D || D.manual) return;
  const n = D.note.trim().toLowerCase(); if (n.length < 2) return;
  const cnt = {};
  S.tx.forEach(t => { if (t.type === D.type && t.note && t.note.toLowerCase().startsWith(n) && S.cats[D.type].some(c => c[0] === t.cat)) cnt[t.cat] = (cnt[t.cat] || 0) + 1; });
  const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  if (best && best !== D.cat) { D.cat = best; const p = sheet.querySelector(".pills"); if (p) p.outerHTML = pillHTML(); }
}
$("#csvBtn").onclick = async () => {
  if (!S.tx.length) { alert("Nothing to export yet."); return; }
  const q = v => { v = String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }; // quotes, and no formulas in Excel
  const rows = [...S.tx].sort((a, b) => a.date.localeCompare(b.date) || (a.u || 0) - (b.u || 0)).map(t => [t.date, t.type === "income" ? "Income" : "Expense", q(t.cat), q(t.note || ""), t.amount].join(","));
  const f = new File(["\uFEFF" + ["Date,Type,Category,Description,Amount"].concat(rows).join("\r\n")], "my-money-" + today() + ".csv", { type: "text/csv" });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
};

/* ---------- Frequent shortcuts & copy ---------- */
function quickHTML() { // your most repeated description + amount + category, one tap to fill
  if (D.id) return "";
  const m = new Map();
  S.tx.forEach(t => {
    if (t.type !== D.type || !(t.note || "").trim() || !S.cats[D.type].some(c => c[0] === t.cat)) return;
    const k = t.note.trim().toLowerCase() + "|" + t.amount + "|" + t.cat, e = m.get(k) || { n: 0, last: "", t };
    e.n++; if (t.date > e.last) { e.last = t.date; e.t = t; } m.set(k, e);
  });
  const top = [...m.values()].filter(e => e.n >= 2).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 4);
  if (!top.length) return "";
  return '<div class="qk">' + top.map(e => `<button class="qchip" data-q="${esc(e.t.id)}"><span>⚡</span>${esc(e.t.note.trim().slice(0, 14))} · ${fmt(e.t.amount)}</button>`).join("") + "</div>";
}
sheet.addEventListener("click", e => {
  const b = e.target.closest("[data-q]"); if (!b || !D) return;
  const t = S.tx.find(x => x.id === b.dataset.q); if (!t) return;
  D.amt = String(t.amount); D.note = t.note.trim(); D.cat = t.cat; D.manual = true;
  $("#amt").innerHTML = "<span>₹</span>" + D.amt; $("#amt").classList.remove("z"); $("#note").value = D.note;
  const nb = $("#nextBtn"); if (nb) nb.disabled = false; const sv = $("#svBtn"); if (sv) sv.disabled = false;
  const p = sheet.querySelector(".pills"); if (p) p.outerHTML = pillHTML();
  sheet.classList.add("typing"); // Save is ready; tap the amount to change it first
});
sheet.addEventListener("click", e => {
  if (!D || e.target.id !== "dupTx") return;
  D.id = ""; D.date = today(); D.cm = D.date.slice(0, 7); D.manual = true; drawAdd(); toast("Copied. Change anything, then save");
});

/* ---------- Monthly report (image + text) ---------- */
let RP = null;
function reportData() {
  const ex = S.tx.filter(t => t.type === "expense" && t.date.startsWith(vm)), inc = S.tx.filter(t => t.type === "income" && t.date.startsWith(vm));
  const spent = sum(ex), income = sum(inc), net = r2(income - spent), by = {};
  ex.forEach(t => by[t.cat] = (by[t.cat] || 0) + t.amount);
  const cats = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ n, v: r2(v), pct: spent ? Math.round(v / spent * 100) : 0, ci: catInfo("expense", n) }));
  const y = +vm.slice(0, 4), m = +vm.slice(5, 7), dim = new Date(y, m, 0).getDate(), cur = vm === today().slice(0, 7), days = cur ? new Date().getDate() : dim;
  const pk = iso(new Date(y, m - 2, 1)).slice(0, 7), prev = sum(S.tx.filter(t => t.type === "expense" && t.date.startsWith(pk)));
  return { label: mname(vm) + " " + vm.slice(0, 4), spent, income, net, cats, budget: budgetFor(vm), avg: Math.round(spent / days), prevLabel: mname(pk), prev, big: ex.slice().sort((a, b) => b.amount - a.amount)[0], count: ex.length + inc.length, rate: income > 0 ? Math.round(net / income * 100) : null };
}
function reportText(d) {
  const L = ["My Money · " + d.label, "Net saved " + sgn(d.net) + (d.rate !== null ? " (" + d.rate + "% of income)" : ""), "Income " + fmt(d.income) + " · Spent " + fmt(d.spent)];
  if (d.budget) L.push("Budget: " + fmt(d.spent) + " of " + fmt(d.budget) + " (" + Math.round(d.spent / d.budget * 100) + "%)");
  if (d.cats.length) { L.push("", "Spending by category"); d.cats.slice(0, 8).forEach(c => L.push(c.ci[1] + " " + c.n + " " + fmt(c.v) + " (" + c.pct + "%)")); }
  L.push("", "Daily average " + fmt(d.avg) + " · " + d.count + " transaction" + (d.count === 1 ? "" : "s"));
  if (d.prev > 0) { const ch = Math.round((d.spent - d.prev) / d.prev * 100); L.push("vs " + d.prevLabel + ": spending " + (ch === 0 ? "unchanged" : Math.abs(ch) + "% " + (ch > 0 ? "higher" : "lower"))); }
  return L.join("\n");
}
function drawReport(d) {
  const W = 1080, pad = 72, FN = "-apple-system, 'SF Pro Text', Helvetica, Arial, sans-serif";
  let rows = d.cats.slice(0, 6);
  if (d.cats.length > 6) { const rest = d.cats.slice(5); rows = d.cats.slice(0, 5).concat([{ n: "Other categories", v: r2(rest.reduce((a, c) => a + c.v, 0)), pct: rest.reduce((a, c) => a + c.pct, 0), ci: ["", "🏷️", "#6b7280"] }]); }
  const y0 = 730 + (d.budget ? 130 : 0), H = y0 + 70 + rows.length * 104 + 270;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const T = (s, px, y, col, w, al, ox) => { x.font = (w || 400) + " " + px + "px " + FN; x.fillStyle = col; x.textAlign = al || "left"; x.fillText(s, al === "right" ? W - pad : al === "center" ? W / 2 : (ox === undefined ? pad : ox), y); };
  const B = (x1, y1, w, h, r, col) => { x.fillStyle = col; x.beginPath(); (x.roundRect || x.rect).call(x, x1, y1, w, h, r); x.fill(); };
  B(0, 0, W, H, 0, "#000");
  T("My Money", 34, 110, "#8a8a8a", 600); T(d.label, 64, 192, "#fff", 700);
  T("Net saved", 36, 300, "#8a8a8a"); T(sgn(d.net), 124, 420, d.net >= 0 ? "#4ade80" : "#ff5f5f", 700);
  T(d.rate === null ? "" : d.net >= 0 ? d.rate + "% of income saved" : "Spent more than earned", 34, 478, "#8a8a8a");
  const cw = (W - pad * 3) / 2;
  [["Income", d.income, "#4ade80", pad], ["Spent", d.spent, "#fff", pad * 2 + cw]].forEach(([l, v, col, cx]) => { B(cx, 530, cw, 150, 28, "#141414"); T(l, 30, 580, "#8a8a8a", 400, "left", cx + 32); T(fmt(v), 56, 646, col, 700, "left", cx + 32); });
  if (d.budget) {
    const pct = Math.round(d.spent / d.budget * 100), col = pct > 100 ? "#ff5f5f" : pct >= 80 ? "#f59e0b" : "#4ade80";
    T("Budget " + fmt(d.budget) + " · " + pct + "% used" + (pct > 100 ? " · over by " + fmt(r2(d.spent - d.budget)) : ""), 34, 748, "#bdbdbd");
    B(pad, 774, W - pad * 2, 24, 12, "#1d1d1d"); B(pad, 774, Math.max(24, (W - pad * 2) * Math.min(pct, 100) / 100), 24, 12, col);
  }
  T("Spending by category", 40, y0, "#fff", 600);
  rows.forEach((r, i) => {
    const y = y0 + 70 + i * 104;
    T(r.ci[1], 44, y + 40, "#fff"); T(r.n.slice(0, 20), 38, y + 38, "#fff", 400, "left", pad + 70); T(fmt(r.v) + "   " + r.pct + "%", 38, y + 38, "#fff", 400, "right");
    B(pad, y + 58, W - pad * 2, 14, 7, "#1d1d1d"); B(pad, y + 58, Math.max(14, (W - pad * 2) * r.pct / 100), 14, 7, r.ci[2]);
  });
  const fy = y0 + 70 + rows.length * 104 + 60;
  T("Daily average " + fmt(d.avg) + " · " + d.count + " transaction" + (d.count === 1 ? "" : "s"), 32, fy, "#8a8a8a");
  if (d.big) T("Biggest expense: " + (d.big.note || d.big.cat).slice(0, 22) + " " + fmt(d.big.amount), 32, fy + 56, "#8a8a8a");
  if (d.prev > 0) { const ch = Math.round((d.spent - d.prev) / d.prev * 100); T("vs " + d.prevLabel + ": spending " + (ch === 0 ? "unchanged" : Math.abs(ch) + "% " + (ch > 0 ? "higher" : "lower")), 32, fy + 112, "#8a8a8a"); }
  T("Made with My Money", 28, H - 40, "#4a4a4a", 400, "center");
  return c;
}
function openReport() {
  const d = reportData();
  if (!d.count) { toast("No transactions in " + mname(vm)); return; }
  const c = drawReport(d); RP = { d, c, text: reportText(d), vm };
  sheet.className = "sheet"; F = { kind: "rep" };
  sheet.innerHTML = `<div class="hd"></div><h3>${esc(d.label)} report</h3><img class="rpv" alt="Monthly report preview" src="${c.toDataURL("image/png")}"><button class="save wide" id="repShare">Share image</button><button class="ghost" id="repText">Share as text</button>`;
  showSheet();
}
sheet.addEventListener("click", async e => {
  if (!F || F.kind !== "rep" || !RP) return;
  const id = e.target.id;
  if (id === "repShare") {
    const blob = await new Promise(r => RP.c.toBlob(r, "image/png")), f = new File([blob], "my-money-" + RP.vm + ".png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (err) { if (err.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
  } else if (id === "repText") {
    if (navigator.share) { try { await navigator.share({ text: RP.text }); return; } catch (err) { if (err.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(RP.text); toast("Report copied"); } catch (err) { alert(RP.text); }
  }
});
const baseRenderIns = renderIns;
renderIns = function () {
  baseRenderIns.apply(this, arguments);
};
$("#insBody").addEventListener("click", e => { if (e.target.closest("[data-rep]")) openReport(); });

/* ---------- Monthly report (picture + text) ---------- */
let REP = null;
function reportData(m) {
  const tx = S.tx.filter(t => t.date.startsWith(m)); if (!tx.length) return null;
  const ex = tx.filter(t => t.type === "expense"), inc = sum(tx.filter(t => t.type === "income")), spent = sum(ex), by = {};
  ex.forEach(t => by[t.cat] = (by[t.cat] || 0) + t.amount);
  const cats = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, v]) => { const c = catInfo("expense", n); return { n, v: r2(v), e: c[1], col: c[2], lim: S.cb[n] || 0 }; });
  const y = +m.slice(0, 4), mo = +m.slice(5, 7), dim = new Date(y, mo, 0).getDate(), days = m === today().slice(0, 7) ? new Date().getDate() : dim;
  const pk = iso(new Date(y, mo - 2, 1)).slice(0, 7), prev = sum(S.tx.filter(t => t.type === "expense" && t.date.startsWith(pk)));
  return { m, label: mname(m) + " " + y, inc, spent, net: r2(inc - spent), bud: budgetFor(m), cats, avg: Math.round(spent / days), prev, big: [...ex].sort((a, b) => b.amount - a.amount)[0] };
}
function reportText(R) {
  const L = ["My Money · " + R.label, "", "Net saved: " + sgn(R.net), "Income: " + fmt(R.inc) + "  ·  Spent: " + fmt(R.spent)];
  if (R.bud) L.push("Budget: " + fmt(R.spent) + " of " + fmt(R.bud) + " (" + Math.round(R.spent / R.bud * 100) + "%)");
  if (R.cats.length) { L.push("", "Where it went:"); R.cats.slice(0, 6).forEach(c => L.push(c.e + " " + c.n + "  " + fmt(c.v) + " (" + Math.round(c.v / R.spent * 100) + "%)")); }
  L.push("", "Daily average: " + fmt(R.avg)); if (R.prev) L.push("Vs last month: " + (R.spent >= R.prev ? "+" : "−") + Math.round(Math.abs(R.spent - R.prev) / R.prev * 100) + "%");
  return L.join("\n");
}
function drawReport(R) {
  const W = 1080, P = 64, IW = W - 2 * P, FN = '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
  const top = R.cats.slice(0, 6), rest = R.cats.slice(6), rows = top.concat(rest.length ? [{ n: "Others", v: r2(rest.reduce((a, c) => a + c.v, 0)), e: "•••", col: "#6b7280", lim: 0 }] : []);
  const H = Math.max(1080, 620 + (R.bud ? 210 : 0) + (rows.length ? 90 + rows.length * 104 : 0) + 280);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
  const rr = (a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
  const t = (s, px, py, size, col, wt = 400, al = "left") => { x.font = wt + " " + size + "px " + FN; x.fillStyle = col; x.textAlign = al; x.fillText(s, px, py); };
  const fit = (s, maxW, size) => { x.font = "400 " + size + "px " + FN; while (s.length > 1 && x.measureText(s).width > maxW) s = s.slice(0, -2) + "…"; return s; };
  const bar = (py, h, frac, col) => { x.fillStyle = "#1f1f1f"; rr(P, py, IW, h, h / 2); x.fill(); if (frac > 0) { x.fillStyle = col; rr(P, py, Math.max(h, IW * Math.min(1, frac)), h, h / 2); x.fill(); } };
  x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
  t("MY MONEY", P, 110, 30, "#8a8a8a", 600); t(R.label, P, 190, 72, "#f5f5f7", 700);
  t("Net saved", P, 290, 34, "#8a8a8a"); t(sgn(R.net), P, 410, 140, R.net >= 0 ? "#4ade80" : "#ff5f5f", 700);
  [["Income", R.inc, "#4ade80"], ["Spent", R.spent, "#ff5f5f"]].forEach(([l, v, c], i) => {
    const cx = P + i * (IW / 2 + 12); x.fillStyle = "#141414"; rr(cx, 470, IW / 2 - 12, 150, 28); x.fill();
    t(l, cx + 32, 524, 30, "#8a8a8a"); t(fmt(v), cx + 32, 584, 54, c, 700);
  });
  let y = 620;
  if (R.bud) {
    const p = R.spent / R.bud, col = p >= 1 ? "#ff5f5f" : p >= .8 ? "#fb923c" : "#4ade80"; y += 60;
    t("Budget", P, y, 34, "#8a8a8a"); t(Math.round(p * 100) + "% used", W - P, y, 34, col, 700, "right");
    bar(y + 24, 26, p, col); t(fmt(R.spent) + " of " + fmt(R.bud), P, y + 110, 34, "#f5f5f7"); y += 150;
  }
  if (rows.length) {
    y += 50; t("Where it went", P, y, 40, "#f5f5f7", 700); y += 40;
    rows.forEach(c => {
      const nm = c.e + " " + c.n, pc = Math.round(c.v / R.spent * 100) + "%";
      t(nm, P, y + 44, 38, "#f5f5f7"); x.font = "400 38px " + FN; let nx = P + x.measureText(nm).width + 18;
      t(pc, nx, y + 44, 30, "#8a8a8a"); x.font = "400 30px " + FN; nx += x.measureText(pc).width + 16;
      if (c.lim && c.v > c.lim) t("over limit", nx, y + 44, 30, "#ff5f5f", 600);
      t(fmt(c.v), W - P, y + 44, 38, "#f5f5f7", 700, "right"); bar(y + 64, 14, c.v / R.spent, c.lim && c.v > c.lim ? "#ff5f5f" : c.col); y += 104;
    });
  }
  y += 40; const bits = ["Daily average " + fmt(R.avg)];
  if (R.prev) bits.push("vs last month " + (R.spent >= R.prev ? "+" : "−") + Math.round(Math.abs(R.spent - R.prev) / R.prev * 100) + "%");
  t(bits.join("  ·  "), P, y + 30, 32, "#bdbdbd");
  if (R.big) t("Biggest: " + fit(R.big.note || R.big.cat, 560, 32) + " " + fmt(R.big.amount), P, y + 84, 32, "#bdbdbd");
  t("Made with My Money", W / 2, H - 50, 26, "#555", 400, "center");
  return cv;
}
function openReport() {
  const R = reportData(vm); if (!R) { alert("No transactions in " + mname(vm) + " yet."); return; }
  const cv = drawReport(R); REP = { R, cv }; F = { kind: "rep" };
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><h3>${esc(mname(vm))} report</h3><p class="sub">Share it as a picture or as text.</p><img class="rimg" src="${cv.toDataURL("image/png")}" alt="Monthly report"><button class="save wide" id="repImg" style="margin-top:0">Share picture</button><button class="ghost" id="repTxt">Share as text</button>`;
  showSheet();
}
$("#insBody").addEventListener("click", e => { if (e.target.closest("[data-report]")) openReport(); });
sheet.addEventListener("click", async e => {
  if (!REP || !F || F.kind !== "rep") return;
  if (e.target.id === "repImg") {
    const blob = await new Promise(r => REP.cv.toBlob(r, "image/png")), f = new File([blob], "my-money-" + REP.R.m + ".png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: "My Money " + REP.R.label }); return; } catch (err) { if (err.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
  } else if (e.target.id === "repTxt") {
    const text = reportText(REP.R);
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (err) { if (err.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(text); toast("Report text copied"); } catch (err) { prompt("Copy this text", text); }
  }
});

/* ---------- Edit, pause and skip recurring entries ---------- */
function nextDue(r) { // the first month after the last one created
  let y = +r.last.slice(0, 4), m = +r.last.slice(5, 7) + 1; if (m > 12) { m = 1; y++; }
  const ym = y + "-" + pad(m); return { ym, date: ym + "-" + pad(Math.min(r.day, new Date(y, m, 0).getDate())) };
}
const dLabel = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8)).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
function openRecEdit(id) {
  const r = S.rec.find(x => x.id === id); if (!r) return;
  const nd = nextDue(r), sk = (r.skip || []).includes(nd.ym);
  F = { kind: "recE", id }; sheet.className = "sheet";
  sheet.innerHTML = `<div class="hd"></div><button class="del" id="rdel2">Delete</button><h3>Edit recurring</h3><p class="sub">Changes apply to future entries. Past ones stay as they are.</p>
  <div class="lab">Description</div><input class="fi" id="rn" maxlength="60" value="${esc(r.note || "")}" placeholder="${esc(r.cat)}">
  <div class="lab">Amount (₹)</div><input class="fi" id="ra" inputmode="decimal" value="${r.amount}">
  <div class="lab">Day of month (1 to 31)</div><input class="fi" id="rdy" inputmode="numeric" value="${r.day}">
  <div class="lab">Category</div><select class="fi" id="rcat">${S.cats[r.type].map(c => `<option${c[0] === r.cat ? " selected" : ""}>${esc(c[0])}</option>`).join("")}</select>
  <button class="ghost" id="rskip">${sk ? "Undo skip of " : "Skip "}${dLabel(nd.date)}</button>
  <button class="ghost" id="rpause">${r.paused ? "Resume this rule" : "Pause this rule"}</button>
  <button class="save wide" id="rsave2" style="margin-top:8px">Save</button>`;
  showSheet();
}
sheet.addEventListener("click", e => {
  const row = e.target.closest("[data-rec]"); if (row) { openRecEdit(row.dataset.rec); return; }
  if (!F || F.kind !== "recE") return;
  const r = S.rec.find(x => x.id === F.id); if (!r) return; const id = e.target.id;
  if (id === "rdel2") { if (confirm("Delete this recurring entry? Past entries stay.")) { S.del[r.id] = Date.now(); S.rec = S.rec.filter(x => x.id !== r.id); save(); openRec(); } }
  else if (id === "rskip") { const nd = nextDue(r); r.skip = r.skip || []; const i = r.skip.indexOf(nd.ym); if (i >= 0) r.skip.splice(i, 1); else r.skip.push(nd.ym); r.u = Date.now(); save(); openRecEdit(r.id); }
  else if (id === "rpause") { r.paused = !r.paused; r.u = Date.now(); save(); openRec(); toast(r.paused ? "Paused. Skipped months are not added later" : "Resumed"); }
  else if (id === "rsave2") {
    const a = num($("#ra").value), dy = Math.round(+$("#rdy").value);
    if (!(a > 0) || !(dy >= 1 && dy <= 31)) { alert("Enter an amount above zero and a day from 1 to 31."); return; }
    r.amount = a; r.day = dy; r.note = $("#rn").value.trim(); r.cat = $("#rcat").value; r.u = Date.now(); save(); runRecurring(); openRec();
  }
});

/* ---------- Full-height layout on the Home Screen app ---------- */
function fitViewport() {
  const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  document.documentElement.style.setProperty("--app-h", (standalone ? Math.max(innerHeight, screen.height) : innerHeight) + "px");
}
fitViewport(); addEventListener("resize", fitViewport); addEventListener("orientationchange", fitViewport);

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
$("#dailyBtn").onclick = dailyReminder;
$("#menuBtn").onclick = () => openPage("insights");
$("#walletBtn").onclick = () => openPage("settings");
addEventListener("resize", render);
render();
runRecurring();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
