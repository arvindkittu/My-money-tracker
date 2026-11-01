const $ = id => document.getElementById(id);

const SUPABASE_URL = "https://qmqwzhfkvykvdkdurtdh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtcXd6aGZrdnlrdmRrZHVydGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDk4MjcsImV4cCI6MjEwOTAyNTgyN30.PHhMIjvOHIAokPdoede5ZVfglaUC0QxOGu6spw_4cXU";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let cloudUser = null;
async function testSupabaseConnection() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    alert("Supabase test failed: " + error.message);
  } else {
    alert("Supabase API connection successful.");
  }
}

const DBNAME = "myMoneyDB", STORE = "state";
let db;
let state = {
  transactions: [], budget: 0, categoryBudgets: {},
  goals: [], recurring: [], debts: [],
  currency: "INR", theme: "dark", recurringRuns: {}
};

function openDB() {
  return new Promise((resolve, reject) => {
    let r = indexedDB.open(DBNAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => { db = r.result; resolve(); };
    r.onerror = () => reject(r.error);
  });
}

function load() {
  return new Promise(resolve => {
    let r = db.transaction(STORE).objectStore(STORE).get("app");
    r.onsuccess = () => {
      if (r.result) state = { ...state, ...r.result };
      resolve();
    };
    r.onerror = () => resolve();
  });
}

function persist() {
  return new Promise(resolve => {
    let t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(state, "app");
    t.oncomplete = resolve;
    t.onerror = () => resolve();
  });
}

const today = () => new Date().toLocaleDateString("en-CA");
const month = () => today().slice(0, 7);
const money = n => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: state.currency,
  maximumFractionDigits: 0
}).format(Number(n) || 0);
const sum = (a, fn) => a.reduce((s, x) => s + fn(x), 0);
const monthTx = (m = month()) =>
  state.transactions.filter(t => t.date.startsWith(m));

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;"
  }[c]));
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(p =>
    p.classList.toggle("active", p.id === id));
  document.querySelectorAll("nav button").forEach(b =>
    b.classList.toggle("active", b.dataset.page === id));
  render();
  window.scrollTo(0, 0);
}

document.querySelectorAll("nav button").forEach(b =>
  b.onclick = () => showPage(b.dataset.page));

function setTheme() {
  document.documentElement.dataset.theme = state.theme;
  $("themeBtn").textContent =
    state.theme === "dark" ? "☀ Light" : "☾ Dark";
}

$("themeBtn").onclick = async () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  setTheme();
  await persist();
  renderCharts();
};

function setTxType(type) {
  $("txType").value = type;

  $("txExpenseBtn").classList.toggle(
    "primary", type === "expense"
  );

  $("txIncomeBtn").classList.toggle(
    "primary", type === "income"
  );
}

function openTx(t = null) {
  $("txForm").reset();
  $("txId").value = t?.id || "";

  setTxType(t?.type || "expense");

  $("txAmount").value = t?.amount || "";
  $("txDate").value = t?.date || today();
  $("txNote").value = t?.note || "";

  $("txDialogTitle").textContent =
    t ? "Edit transaction" : "Add transaction";

  $("txDialog").showModal();
}


function setTxType(type) {
  $("txType").value = type;

  $("txExpenseBtn").classList.toggle(
    "primary", type === "expense"
  );

  $("txIncomeBtn").classList.toggle(
    "primary", type === "income"
  );
}

function openTx(t = null) {
  $("txForm").reset();
  $("txId").value = t?.id || "";

  setTxType(t?.type || "expense");

  $("txAmount").value = t?.amount || "";
  $("txDate").value = t?.date || today();
  $("txNote").value = t?.note || "";

  $("txDialogTitle").textContent =
    t ? "Edit transaction" : "Add transaction";

  $("txDialog").showModal();
}

async function saveTx() {
  let amount = Number($("txAmount").value);

  if (!(amount > 0)) {
    alert("Enter an amount greater than zero.");
    return;
  }

  let id = $("txId").value || crypto.randomUUID();

  let tx = {
    id,
    type: $("txType").value,
    amount,
    date: $("txDate").value,
    note: $("txNote").value.trim()
  };

  if (!tx.date) {
    alert("Choose a date.");
    return;
  }

  let i = state.transactions.findIndex(x => x.id === id);

  if (i >= 0) {
    state.transactions[i] = {
      ...state.transactions[i],
      ...tx
    };
  } else {
    state.transactions.push(tx);
  }

  await persist();
  $("txDialog").close();
  render();
}

function txHTML(t) {
  return `<div class="item">
    <div style="min-width:0">
      <b>${escapeHTML(t.note || "Unnamed transaction")}</b>
      <div class="small muted">${escapeHTML(t.date)}</div>
    </div>
    <div style="text-align:right;white-space:nowrap">
      <b class="${t.type === "income" ? "positive" : "negative"}">
        ${t.type === "income" ? "+" : "−"}${money(t.amount)}
      </b>
      <div class="small">
        <button class="btn" onclick="editTx('${t.id}')">Edit</button>
        <button class="btn danger" onclick="deleteTx('${t.id}')">×</button>
      </div>
    </div>
  </div>`;
}


function editTx(id) {
  let t = state.transactions.find(x => x.id === id);
  if (t) openTx(t);
}

async function deleteTx(id) {
  if (confirm("Delete this transaction?")) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    await persist();
    render();
  }
}

function renderDashboard() {
  let a = monthTx();

  let inc = sum(
    a.filter(t => t.type === "income"),
    t => t.amount
  );

  let exp = sum(
    a.filter(t => t.type === "expense"),
    t => t.amount
  );

  $("todayLabel").textContent = new Date().toLocaleDateString(
    undefined,
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );

  $("incomeMetric").textContent = money(inc);
  $("expenseMetric").textContent = money(exp);
  $("netMetric").textContent = money(inc - exp);

  $("budgetMetric").textContent =
    state.budget ? money(state.budget - exp) : "—";

  $("budgetMetric").className =
    "metric " + (state.budget - exp < 0 ? "negative" : "");

  let recent = [...state.transactions]
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 5);

  $("recentList").innerHTML = recent.length
    ? recent.map(txHTML).join("")
    : '<div class="empty">Add your first transaction to get started.</div>';

  drawTrend("trendChart", 6);
}

function getTxDateRange() {
  const period = $("txPeriod").value;
  const now = new Date();
  const todayDate = today();

  if (period === "today") {
    return { start: todayDate, end: todayDate };
  }

  if (period === "month") {
    const m = month();
    return { start: m + "-01", end: m + "-31" };
  }

  if (period === "lastmonth") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const last = new Date(y, d.getMonth() + 1, 0).getDate();

    return {
      start: y + "-" + m + "-01",
      end: y + "-" + m + "-" + String(last).padStart(2, "0")
    };
  }

  if (period === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);

    const start = d.toLocaleDateString("en-CA");
    const endDate = new Date(d);
    endDate.setDate(endDate.getDate() + 6);

    return {
      start,
      end: endDate.toLocaleDateString("en-CA")
    };
  }

  if (period === "custom") {
    return {
      start: $("txStartDate").value,
      end: $("txEndDate").value
    };
  }

  return { start: "", end: "" };
}


function renderTransactions() {
  const query = $("txSearch").value.trim().toLowerCase();
  const type = $("txFilter").value;
  const sort = $("txSort").value;
  const range = getTxDateRange();

  $("txCustomDates").hidden =
    $("txPeriod").value !== "custom";

  let list = state.transactions.filter(t => {
    if (type !== "all" && t.type !== type) return false;

    if (range.start && t.date < range.start) return false;
    if (range.end && t.date > range.end) return false;

    if (
      $("txPeriod").value === "custom" &&
      !range.start && !range.end
    ) return false;

    if (
      $("txPeriod").value === "custom" &&
      range.start && range.end &&
      range.start > range.end
    ) return false;

    if (query) {
      const searchable = [
        t.note,
        t.type,
        t.date,
        String(t.amount)
      ].join(" ").toLowerCase();

      if (!searchable.includes(query)) return false;
    }

    return true;
  });

  list.sort((a, b) => {
    if (sort === "oldest") {
      return a.date.localeCompare(b.date);
    }

    if (sort === "high") {
      return Number(b.amount) - Number(a.amount) ||
        b.date.localeCompare(a.date);
    }

    if (sort === "low") {
      return Number(a.amount) - Number(b.amount) ||
        b.date.localeCompare(a.date);
    }

    return b.date.localeCompare(a.date);
  });

  $("txResultCount").textContent =
    list.length + (list.length === 1
      ? " transaction"
      : " transactions");

  $("txList").innerHTML = list.length
    ? list.map(txHTML).join("")
    : '<div class="empty">No matching transactions. Try changing or clearing your filters.</div>';
}

function clearTxFilters() {
  $("txSearch").value = "";
  $("txPeriod").value = "month";
  $("txFilter").value = "all";
  $("txSort").value = "newest";
  $("txStartDate").value = "";
  $("txEndDate").value = "";

  renderTransactions();
}

$("txSearch").addEventListener("input", renderTransactions);

[
  "txPeriod",
  "txFilter",
  "txSort",
  "txStartDate",
  "txEndDate"
].forEach(id =>
  $(id).addEventListener("change", renderTransactions)
);


function saveBudget() {
  state.budget = Math.max(0, Number($("totalBudget").value) || 0);
  persist().then(render);
}


function renderBudget() {
  $("totalBudget").value = state.budget || "";

  let spent = sum(
    monthTx().filter(t => t.type === "expense"),
    t => t.amount
  );

  $("budgetUsage").innerHTML = state.budget
    ? `<div class="row">
         <b>${money(spent)} spent</b>
         <b>${money(state.budget)} budget</b>
       </div>
       <div class="bar">
         <i style="width:${Math.min(100, spent / state.budget * 100)}%"></i>
       </div>
       <div class="small muted" style="margin-top:8px">
         ${money(Math.max(0, state.budget - spent))} remaining
       </div>`
    : '<div class="muted small">Set a monthly budget to see usage.</div>';
}

function drawTrend(id, n) {
  let cv = $(id), ctx = cv.getContext("2d");
  let w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);

  let labels = [], vals = [];
  for (let i = n - 1; i >= 0; i--) {
    let d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    let m = d.toLocaleDateString("en-CA").slice(0, 7);
    labels.push(d.toLocaleDateString(undefined, { month:"short" }));
    vals.push(sum(monthTx(m).filter(t => t.type === "expense"), t => t.amount));
  }

  let max = Math.max(1, ...vals), pad = 30;
  ctx.fillStyle = getComputedStyle(document.body)
    .getPropertyValue("--muted");
  ctx.font = "12px sans-serif";

  for (let i = 0; i < n; i++) {
    let x = pad + i * (w - 2 * pad) / n + 12;
    let bh = (h - 55) * vals[i] / max;
    ctx.fillStyle = getComputedStyle(document.body)
      .getPropertyValue("--accent");
    ctx.fillRect(x, h - 30 - bh, Math.max(14, (w - 2 * pad) / n - 18), bh);
    ctx.fillStyle = getComputedStyle(document.body)
      .getPropertyValue("--muted");
    ctx.fillText(labels[i], x, h - 10);
  }
}

function renderCharts() {
  drawTrend("trendChart", 6);
  drawTrend("analyticsChart", 6);
}

function drawIncomeExpenseChart() {
  const cv = $("analyticsChart");
  const ctx = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);

  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);

    const key = d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0");

    const items = monthTx(key);

    months.push({
      label: d.toLocaleDateString(undefined, { month: "short" }),
      income: sum(items.filter(t => t.type === "income"), t => t.amount),
      expense: sum(items.filter(t => t.type === "expense"), t => t.amount)
    });
  }

  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
  const top = 28, bottom = 38, left = 24;
  const chartH = h - top - bottom;
  const groupW = (w - left * 2) / months.length;
  const barW = Math.min(24, groupW * 0.27);

  const green = getComputedStyle(document.body)
    .getPropertyValue("--green").trim();
  const red = getComputedStyle(document.body)
    .getPropertyValue("--red").trim();
  const muted = getComputedStyle(document.body)
    .getPropertyValue("--muted").trim();

  months.forEach((m, i) => {
    const center = left + groupW * i + groupW / 2;
    const incomeH = chartH * m.income / max;
    const expenseH = chartH * m.expense / max;

    ctx.fillStyle = green;
    ctx.fillRect(center - barW - 2,
      top + chartH - incomeH, barW, incomeH);

    ctx.fillStyle = red;
    ctx.fillRect(center + 2,
      top + chartH - expenseH, barW, expenseH);

    ctx.fillStyle = muted;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(m.label, center, h - 12);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = green;
  ctx.fillRect(left, 7, 10, 10);
  ctx.fillStyle = muted;
  ctx.font = "11px sans-serif";
  ctx.fillText("Income", left + 15, 16);

  ctx.fillStyle = red;
  ctx.fillRect(left + 88, 7, 10, 10);
  ctx.fillStyle = muted;
  ctx.fillText("Expenses", left + 103, 16);
}


function renderAnalytics() {
  const current = monthTx();

  const income = sum(
    current.filter(t => t.type === "income"),
    t => t.amount
  );

  const expenses = sum(
    current.filter(t => t.type === "expense"),
    t => t.amount
  );

  const net = income - expenses;
  const dayOfMonth = new Date().getDate();
  const dailyAverage = expenses / Math.max(1, dayOfMonth);
  const savingsRate = income > 0 ? net / income * 100 : 0;

  $("insightIncome").textContent = money(income);
  $("insightExpense").textContent = money(expenses);
  $("insightDaily").textContent = money(dailyAverage);
  $("insightSavings").textContent = savingsRate.toFixed(1) + "%";

  $("insightSavings").className =
    "metric " + (savingsRate < 0 ? "negative" : "positive");

  drawIncomeExpenseChart();

  const previousDate = new Date();
  previousDate.setDate(1);
  previousDate.setMonth(previousDate.getMonth() - 1);

  const previousMonth = previousDate.getFullYear() + "-" +
    String(previousDate.getMonth() + 1).padStart(2, "0");

  const previousItems = monthTx(previousMonth);

  const previousExpenses = sum(
    previousItems.filter(t => t.type === "expense"),
    t => t.amount
  );

  const difference = expenses - previousExpenses;

  let comparisonText;

  if (previousExpenses === 0 && expenses > 0) {
    comparisonText = "No expenses in the previous month";
  } else if (previousExpenses === 0) {
    comparisonText = "No expenses in either month";
  } else {
    const change = difference / previousExpenses * 100;

    comparisonText =
      (difference > 0 ? "Up " : difference < 0 ? "Down " : "No change ") +
      Math.abs(change).toFixed(1) + "% compared with last month";
  }

  $("monthComparison").innerHTML = `
    <div class="item">
      <span>This month</span><b>${money(expenses)}</b>
    </div>
    <div class="item">
      <span>Last month</span><b>${money(previousExpenses)}</b>
    </div>
    <div class="item">
      <span>Difference</span>
      <b class="${difference > 0 ? "negative" : difference < 0 ? "positive" : ""}">
        ${difference > 0 ? "+" : difference < 0 ? "−" : ""}${money(Math.abs(difference))}
      </b>
    </div>
    <div class="small muted" style="margin-top:8px">
      ${comparisonText}
    </div>`;

  $("periodSummary").innerHTML = `
    <div class="item">
      <span>Income</span>
      <b class="positive">${money(income)}</b>
    </div>
    <div class="item">
      <span>Expenses</span>
      <b class="negative">${money(expenses)}</b>
    </div>
    <div class="item">
      <span>Net savings</span>
      <b class="${net < 0 ? "negative" : "positive"}">${money(net)}</b>
    </div>
    <div class="item">
      <span>Transactions</span><b>${current.length}</b>
    </div>`;
}


function openGoal() {
  $("goalName").value = "";
  $("goalTarget").value = "";
  $("goalSaved").value = "0";
  $("goalDate").value = "";
  $("goalDialog").showModal();
}

async function saveGoal() {
  let name = $("goalName").value.trim();
  let target = Number($("goalTarget").value);
  if (!name || !(target > 0)) {
    alert("Enter a goal name and target amount.");
    return;
  }
  state.goals.push({
    id: crypto.randomUUID(), name, target,
    saved: Number($("goalSaved").value) || 0,
    date: $("goalDate").value
  });
  await persist();
  $("goalDialog").close();
  render();
}

function renderGoals() {
  $("goalList").innerHTML = state.goals.length
    ? state.goals.map(g => `
      <div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div class="row"><b>${escapeHTML(g.name)}</b>
          <span class="pill">${Math.min(100, Math.round(g.saved / g.target * 100))}%</span>
        </div>
        <div class="row small muted" style="margin-top:8px">
          <span>${money(g.saved)} saved</span><span>Target ${money(g.target)}</span>
        </div>
        <div class="bar"><i style="width:${Math.min(100, g.saved / g.target * 100)}%"></i></div>
        <div class="actions">
          <button class="btn" onclick="addGoalMoney('${g.id}')">＋ Add savings</button>
          <button class="btn danger" onclick="deleteGoal('${g.id}')">Delete</button>
        </div>
      </div>`).join("")
    : '<div class="empty">Create your first savings goal.</div>';
}

async function addGoalMoney(id) {
  let g = state.goals.find(x => x.id === id);
  let v = Number(prompt("How much did you save?", "1000"));
  if (g && v > 0) {
    g.saved += v;
    await persist();
    render();
  }
}

async function deleteGoal(id) {
  if (confirm("Delete this goal?")) {
    state.goals = state.goals.filter(g => g.id !== id);
    await persist();
    render();
  }
}

function renderCalendar() {
  let m = $("calMonth").value || month();
  let [y, mo] = m.split("-").map(Number);
  let first = new Date(y, mo - 1, 1);
  let days = new Date(y, mo, 0).getDate();
  let offset = (first.getDay() + 6) % 7;

  let html = "<div style='display:grid;grid-template-columns:repeat(7,1fr);text-align:center;gap:5px'>" +
    ["M","T","W","T","F","S","S"].map(x =>
      `<b class="muted small">${x}</b>`).join("");

  for (let i = 0; i < offset; i++) html += "<span></span>";

  for (let d = 1; d <= days; d++) {
    let date = `${m}-${String(d).padStart(2, "0")}`;
    let count = state.transactions.filter(t => t.date === date).length;
    html += `<button class="btn" style="padding:10px 0"
      onclick="selectDay('${date}')">${d}
      ${count ? `<span style="display:block;color:var(--accent);font-size:9px">● ${count}</span>` : ""}
    </button>`;
  }

  $("calendarGrid").innerHTML = html + "</div>";
}

function selectDay(date) {
  $("selectedDayTitle").textContent = date;
  let list = state.transactions.filter(t => t.date === date);
  $("selectedDayList").innerHTML = list.length
    ? list.map(txHTML).join("")
    : "No transactions on this date.";
}

$("calMonth").value = month();
$("calMonth").onchange = renderCalendar;


function setRecurringType(type) {
  $("recType").value = type;

  $("recExpenseBtn").classList.toggle(
    "primary", type === "expense"
  );

  $("recIncomeBtn").classList.toggle(
    "primary", type === "income"
  );
}

function openRecurring(r = null) {
  $("recId").value = r?.id || "";

  setRecurringType(r?.type || "expense");

  $("recAmount").value = r?.amount || "";
  $("recStart").value = r?.start || today();
  $("recNote").value = r?.note || "";
  $("recFreq").value = r?.frequency || "monthly";

  $("recDialogTitle").textContent =
    r ? "Edit recurring transaction" : "Recurring transaction";

  $("recSaveBtn").textContent =
    r ? "Update recurring item" : "Save recurring item";

  $("recDialog").showModal();
}

async function saveRecurring() {
  const amount = Number($("recAmount").value);
  const start = $("recStart").value;
  const id = $("recId").value;

  if (!(amount > 0) || !start) {
    alert("Enter a valid amount and start date.");
    return;
  }

  const existing = state.recurring.find(r => r.id === id);

  const item = {
    id: id || crypto.randomUUID(),
    type: $("recType").value,
    amount,
    frequency: $("recFreq").value,
    start,
    note: $("recNote").value.trim(),
    active: existing ? existing.active : true
  };

  if (existing) {
    Object.assign(existing, item);
  } else {
    state.recurring.push(item);
  }

  await persist();
  $("recDialog").close();

  await processRecurring();
  render();
}

function advanceRecurringDate(date, frequency) {
  const next = new Date(date);
  const originalDay = next.getDate();

  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    const months = frequency === "quarterly" ? 3 :
      frequency === "yearly" ? 12 : 1;

    next.setDate(1);
    next.setMonth(next.getMonth() + months);

    const lastDay = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0
    ).getDate();

    next.setDate(Math.min(originalDay, lastDay));
  }

  return next;
}

function formatLocalDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getNextRecurringDate(r) {
  if (!r.start) return "—";

  let due = new Date(r.start + "T12:00:00");
  const now = new Date(today() + "T12:00:00");
  let guard = 0;

  while (due <= now && guard++ < 500) {
    due = advanceRecurringDate(due, r.frequency);
  }

  return formatLocalDate(due);
}

async function processRecurring() {
  let changed = false;

  for (const r of state.recurring) {
    if (!r.active || !r.start) continue;

    const last = state.recurringRuns[r.id] || "";
    let due = new Date(r.start + "T12:00:00");
    const now = new Date(today() + "T12:00:00");
    let guard = 0;

    while (due <= now && guard++ < 500) {
      const ds = formatLocalDate(due);

      if (
        ds > last &&
        !state.transactions.some(t =>
          t.recurringId === r.id && t.date === ds
        )
      ) {
        state.transactions.push({
  id: crypto.randomUUID(),
  type: r.type,
  amount: r.amount,
  note: r.note || "Recurring",
  date: ds,
  recurringId: r.id
});

        state.recurringRuns[r.id] = ds;
        changed = true;
      }

      due = advanceRecurringDate(due, r.frequency);
    }
  }

  if (changed) await persist();
}

function renderRecurring() {
  $("recurringList").innerHTML = state.recurring.length
    ? state.recurring.map(r => `
      <div class="item">
        <div style="min-width:0">
          <b>${escapeHTML(r.note || (r.type === "income" ? "Recurring income" : "Recurring expense"))}</b>

          <div class="small muted">
            ${escapeHTML(r.frequency)} ·
            ${escapeHTML(r.type)} ·
            ${money(r.amount)}
          </div>

          <div class="small muted">
            Next due: ${getNextRecurringDate(r)}
          </div>

          <div class="small">
            <span class="pill">
              ${r.active ? "Active" : "Paused"}
            </span>
          </div>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn"
            onclick="openRecurring(state.recurring.find(x => x.id === '${r.id}'))">
            Edit
          </button>

          <button class="btn"
            onclick="toggleRecurring('${r.id}')">
            ${r.active ? "Pause" : "Resume"}
          </button>

          <button class="btn danger"
            onclick="removeRecurring('${r.id}')">
            ×
          </button>
        </div>
      </div>
    `).join("")
    : '<div class="empty">No recurring items yet.</div>';
}

async function toggleRecurring(id) {
  let r = state.recurring.find(x => x.id === id);
  r.active = !r.active;
  await persist();
  render();
}

async function removeRecurring(id) {
  if (confirm("Remove this recurring item?")) {
    state.recurring = state.recurring.filter(x => x.id !== id);
    await persist();
    render();
  }
}

function openDebt() {
  $("debtName").value = "";
  ["debtOriginal", "debtBalance", "debtEmi"].forEach(id => $(id).value = "");
  $("debtDue").value = "";
  $("debtDialog").showModal();
}

async function saveDebt() {
  let name = $("debtName").value.trim();
  let original = Number($("debtOriginal").value);
  let balance = Number($("debtBalance").value);

  if (!name || !(original > 0) || balance < 0) {
    alert("Enter a name, original amount and valid balance.");
    return;
  }

  state.debts.push({
    id: crypto.randomUUID(), name, original, balance,
    emi: Number($("debtEmi").value) || 0,
    due: $("debtDue").value
  });

  await persist();
  $("debtDialog").close();
  render();
}

function renderDebts() {
  let total = sum(state.debts, d => d.balance);
  $("debtSummary").innerHTML = `
    <div class="metric">${money(total)}</div>
    <div class="muted small">Total outstanding balance · ${state.debts.length} account(s)</div>`;

  $("debtList").innerHTML = state.debts.length
    ? state.debts.map(d => `
      <div class="item">
        <div><b>${escapeHTML(d.name)}</b>
          <div class="small muted">Outstanding ${money(d.balance)} · EMI ${money(d.emi)}
          ${d.due ? " · Due " + d.due : ""}</div>
        </div>
        <div>
          <button class="btn" onclick="payDebt('${d.id}')">Record payment</button>
          <button class="btn danger" onclick="removeDebt('${d.id}')">×</button>
        </div>
      </div>`).join("")
    : '<div class="empty">No debts or EMIs added.</div>';
}

async function payDebt(id) {
  let d = state.debts.find(x => x.id === id);
  let v = Number(prompt("Payment amount", String(d.emi || 0)));

  if (d && v > 0) {
    d.balance = Math.max(0, d.balance - v);
    state.transactions.push({
  id: crypto.randomUUID(),
  type: "expense",
  amount: v,
  date: today(),
  note: "Debt payment: " + d.name
});
    await persist();
    render();
  }
}

async function removeDebt(id) {
  if (confirm("Remove this debt record?")) {
    state.debts = state.debts.filter(d => d.id !== id);
    await persist();
    render();
  }
}

function saveCurrency() {
  state.currency = $("currency").value;
  persist().then(render);
}

function download(name, content, type) {
  let a = document.createElement("a");
  let url = URL.createObjectURL(new Blob([content], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function exportCSV() {
  let rows = [
    ["Date", "Type", "Amount", "Currency", "Note"],
    ...state.transactions.map(t => [
      t.date,
      t.type,
      t.amount,
      state.currency,
      t.note || ""
    ])
  ];

  let csv = rows.map(r =>
    r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(",")
  ).join("\r\n");

  download(
    "my-money-transactions.csv",
    "\uFEFF" + csv,
    "text/csv;charset=utf-8"
  );
}

function exportJSON() {
  download("my-money-backup-" + today() + ".json",
    JSON.stringify({ ...state, backupCreated: new Date().toISOString() }, null, 2),
    "application/json");
}

async function restoreJSON() {
  let f = $("restoreFile").files[0];
  if (!f) {
    alert("Choose a JSON backup file.");
    return;
  }

  try {
    let data = JSON.parse(await f.text());
    if (!Array.isArray(data.transactions)) throw Error();

    if (!confirm("Restore will replace the current app data. Continue?")) return;

    state = { ...state, ...data };
    delete state.backupCreated;
    await persist();
    setTheme();
    render();
    alert("Backup restored.");
  } catch (e) {
    alert("This file does not look like a valid My Money backup.");
  }
}

async function clearData() {
  if (confirm("Permanently delete all app records? Export a backup first.")) {
    state = {
      transactions: [], budget: 0, categoryBudgets: {},
      goals: [], recurring: [], debts: [],
      currency: "INR", theme: state.theme, recurringRuns: {}
    };
    await persist();
    render();
  }
}

function render() {
  renderDashboard();
  renderTransactions();
  renderBudget();
  renderAnalytics();
  renderGoals();
  renderCalendar();
  renderRecurring();
  renderDebts();
  $("currency").value = state.currency;
}

async function updateCloudStatus(message) {
  $("cloudStatus").textContent = message;
}

async function initCloudAuth() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    updateCloudStatus("Unable to check cloud account: " + error.message);
    return;
  }

  cloudUser = data.session?.user || null;

  updateCloudStatus(
    cloudUser
      ? "Signed in as " + cloudUser.email
      : "Not signed in. Sign in or create an account."
  );

  supabaseClient.auth.onAuthStateChange((event, session) => {
    cloudUser = session?.user || null;

    updateCloudStatus(
      cloudUser
        ? "Signed in as " + cloudUser.email
        : "Not signed in. Sign in or create an account."
    );
  });
}

async function signUpCloud() {
  const email = $("cloudEmail").value.trim();
  const password = $("cloudPassword").value;

  if (!email || password.length < 6) {
    alert("Enter a valid email and a password with at least 6 characters.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: "https://arvindkittu.github.io/My-money-tracker/"
  }
});

  if (error) {
    alert("Account creation failed: " + error.message);
    return;
  }

  if (data.session) {
    alert("Account created and signed in successfully.");
  } else {
    alert("Account created. Please check your email for the confirmation link.");
  }
}

async function signInCloud() {
  const email = $("cloudEmail").value.trim();
  const password = $("cloudPassword").value;

  if (!email || !password) {
    alert("Enter your email and password.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("Sign-in failed: " + error.message);
    return;
  }

  alert("Signed in successfully.");
}

async function signOutCloud() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert("Sign-out failed: " + error.message);
    return;
  }

  alert("Signed out successfully.");
}

async function testSupabaseConnection() {
  try {
    const response = await fetch(
      SUPABASE_URL + "/auth/v1/settings",
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY
        }
      }
    );

    const result = await response.json();

    if (response.ok) {
      alert("Supabase connection successful! API key is valid.");
    } else {
      alert(
        "Supabase connection failed. HTTP " +
        response.status + ": " +
        (result.message || result.msg || JSON.stringify(result))
      );
    }
  } catch (error) {
    alert("Connection error: " + error.message);
  }
}

async function checkCloudData() {
  try {
    alert("Checking Supabase database...");

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      alert("Session error: " + sessionError.message);
      return;
    }

    const user = sessionData.session?.user;

    if (!user) {
      cloudUser = null;
      updateCloudStatus("Not signed in.");
      alert("No active login session. Please sign in again.");
      return;
    }

    cloudUser = user;

    const { data, error } = await supabaseClient
      .from("user_app_state")
      .select("user_id, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      alert(
        "Database error: " +
        error.message +
        "\nCode: " + (error.code || "Not available")
      );
      return;
    }

    if (!data) {
      alert(
        "SUCCESS: Supabase database is accessible.\n\n" +
        "No cloud backup exists yet.\n" +
        "Your existing records remain safely on this device."
      );
      return;
    }

    alert(
      "SUCCESS: Cloud backup found.\n\n" +
      "Last updated: " + data.updated_at
    );

  } catch (error) {
    alert("Unexpected error: " + error.message);
  }
}

async function uploadLocalDataToCloud() {
  try {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      alert("Login check failed: " + sessionError.message);
      return;
    }

    const user = sessionData.session?.user;

    if (!user) {
      alert("Please sign in before uploading.");
      return;
    }

    cloudUser = user;

    const { data: existing, error: checkError } =
      await supabaseClient
        .from("user_app_state")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (checkError) {
      alert("Cloud check failed: " + checkError.message);
      return;
    }

    if (existing) {
      alert(
        "A cloud backup already exists. Upload stopped to protect your data."
      );
      return;
    }

    const transactionCount = state.transactions.length;

    if (!confirm(
      "Upload your current local financial data to Supabase?\n\n" +
      "Transactions: " + transactionCount + "\n" +
      "Your local records will remain unchanged."
    )) {
      return;
    }

    const cloudData = JSON.parse(JSON.stringify(state));

    const { error: uploadError } = await supabaseClient
      .from("user_app_state")
      .insert({
        user_id: user.id,
        data: cloudData,
        updated_at: new Date().toISOString()
      });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    alert(
      "SUCCESS! Your local data has been uploaded to Supabase.\n\n" +
      "Transactions uploaded: " + transactionCount
    );

  } catch (error) {
    alert("Unexpected upload error: " + error.message);
  }
}

async function init() {
  await openDB();
  await load();
  setTheme();
  $("currency").value = state.currency;
    await processRecurring();
  render();
  await initCloudAuth();

  if ("serviceWorker" in navigator &&
      location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }
}

init();
