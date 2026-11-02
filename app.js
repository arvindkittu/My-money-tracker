const $ = id => document.getElementById(id);

const SUPABASE_URL = "https://qmqwzhfkvykvdkdurtdh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtcXd6aGZrdnlrdmRrZHVydGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDk4MjcsImV4cCI6MjEwOTAyNTgyN30.PHhMIjvOHIAokPdoede5ZVfglaUC0QxOGu6spw_4cXU";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let cloudUser = null;
let cloudReady = false;
let cloudSyncQueue = Promise.resolve();
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
let activeStateKey = null;
let activeStateUserId = null;

function createEmptyState() {
  return {
    transactions: [],
    budget: 0,
    categoryBudgets: {},
    goals: [],
    recurring: [],
    debts: [],
    currency: "INR",
    theme: "dark",
    recurringRuns: {}
  };
}

let state = createEmptyState();

function openDB() {
  return new Promise((resolve, reject) => {
    let r = indexedDB.open(DBNAME, 2);

    r.onupgradeneeded = () => {
      const database = r.result;

      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }

      if (!database.objectStoreNames.contains("syncQueue")) {
        database.createObjectStore("syncQueue");
      }
    };

    r.onsuccess = () => {
      db = r.result;
      resolve();
    };

    r.onerror = () => reject(r.error);
  });
}
function getAccountStateKey(userId) {
  return "account:" + userId;
}

function readLocalState(key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE)
      .objectStore(STORE).get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function writeLocalState(key, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");

    transaction.objectStore(STORE).put(data, key);

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readLegacyOwner() {
  return new Promise((resolve, reject) => {
    const request = db.transaction("syncQueue")
      .objectStore("syncQueue").get("__legacy_owner__");

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function saveLegacyOwner(userId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("syncQueue", "readwrite");

    transaction.objectStore("syncQueue").put(
      userId,
      "__legacy_owner__"
    );

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function loadAccountState(userId) {
  if (!userId) {
    throw new Error("A signed-in user is required.");
  }

  const accountKey = getAccountStateKey(userId);

  let accountData = await readLocalState(accountKey);
  let legacyOwner = await readLegacyOwner();

  // Claim legacy data for the first account that initializes storage.
  if (!legacyOwner) {
    const legacyData = await readLocalState("app");

    if (legacyData && !accountData) {
      accountData = legacyData;
      await writeLocalState(accountKey, accountData);
    }

    await saveLegacyOwner(userId);
    legacyOwner = userId;
  }

  // Never copy legacy data when another account already owns it.
  if (!accountData) {
    accountData = createEmptyState();
    await writeLocalState(accountKey, accountData);
  }

  state = {
    ...createEmptyState(),
    ...accountData
  };

  activeStateKey = accountKey;
  activeStateUserId = userId;

  return state;
}
async function load() {
  state = createEmptyState();
}

function savePendingSync(snapshot, userId = cloudUser?.id) {
  if (!userId) return Promise.resolve(false);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("syncQueue", "readwrite");

    transaction.objectStore("syncQueue").put({
      userId,
      data: snapshot,
      createdAt: Date.now() + "-" + crypto.randomUUID()
    }, userId);

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function getPendingSync(userId = cloudUser?.id) {
  if (!userId) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = db.transaction("syncQueue")
      .objectStore("syncQueue").get(userId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function clearPendingSyncIfCurrent(createdAt, userId = cloudUser?.id) {
  if (!userId) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("syncQueue", "readwrite");
    const store = transaction.objectStore("syncQueue");
    const request = store.get(userId);

    request.onsuccess = () => {
      if (request.result?.createdAt === createdAt) {
        store.delete(userId);
      }
    };

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function processPendingSync() {
  const userId = cloudUser?.id;

  if (!userId || !cloudReady || !navigator.onLine) {
    return false;
  }

  let syncSucceeded = true;

  cloudSyncQueue = cloudSyncQueue.then(async () => {
    if (!cloudUser || cloudUser.id !== userId ||
        !cloudReady || !navigator.onLine) {
      syncSucceeded = false;
      return;
    }

    const pending = await getPendingSync(userId);

    if (!pending) return;

    const { error } = await supabaseClient
      .from("user_app_state", {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store" })
      })
      .upsert({
        user_id: userId,
        data: pending.data,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

    if (error) throw error;

    await clearPendingSyncIfCurrent(
      pending.createdAt,
      userId
    );

    if (cloudUser?.id === userId) {
      updateCloudStatus(
        "Logged in as " + getCloudDisplayName() + " · Synced"
      );
    }
  }).catch(error => {
    syncSucceeded = false;
    updateCloudStatus("Cloud sync pending: " + error.message);
  });

  await cloudSyncQueue;

  return syncSucceeded;
}

function persist() {
  const snapshot = JSON.parse(JSON.stringify(state));
  const userId = cloudUser?.id;

  if (!userId || activeStateUserId !== userId) {
    return Promise.reject(
      new Error("Account storage is not initialized.")
    );
  }

  const localSave = writeLocalState(
    getAccountStateKey(userId),
    snapshot
  );

  return localSave.then(async () => {
    await savePendingSync(snapshot, userId);

    if (!cloudUser || cloudUser.id !== userId) {
      updateCloudStatus("Saved locally · Pending account sync");
      return;
    }

    if (!cloudReady || !navigator.onLine) {
      updateCloudStatus("Saved locally · Pending cloud sync");
      return;
    }

    await processPendingSync();
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
    p.classList.toggle("active", p.id === id)
  );

  document.querySelectorAll("nav button").forEach(b =>
    b.classList.toggle("active", b.dataset.page === id)
  );

  // Hide bottom navigation while Settings is open.
  document.body.classList.toggle(
    "profile-page-open",
    id === "settings"
  );

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

function formatTransactionDate(value) {
  if (!value) return "Date not set";

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return String(value);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
function txHTML(t) {
  const isIncome = t.type === "income";

  const typeLabel = isIncome
    ? "Income"
    : "Expense";

  const typeClass = isIncome
    ? "income"
    : "expense";

  const amountSign = isIncome ? "+" : "−";

  return `
    <div class="transaction-item">

      <div class="transaction-main">

        <span class="transaction-title">
          ${escapeHTML(t.note || "Unnamed transaction")}
        </span>

        <div class="transaction-meta">

          <span class="transaction-date">
            ${escapeHTML(formatTransactionDate(t.date))}
          </span>

          <span class="transaction-type ${typeClass}">
            ${typeLabel}
          </span>

        </div>

      </div>

      <div class="transaction-side">

        <div class="transaction-amount ${typeClass === "income" ? "positive" : "negative"}">
          ${amountSign}${money(t.amount)}
        </div>

        <div class="transaction-actions">

          <button
            type="button"
            class="transaction-action"
            onclick="editTx('${t.id}')"
            aria-label="Edit transaction">
            Edit
          </button>

          <button
            type="button"
            class="transaction-action delete"
            onclick="deleteTx('${t.id}')"
            aria-label="Delete transaction">
            Delete
          </button>

        </div>

      </div>

    </div>
  `;
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
function compareTransactionsNewestFirst(a, b, order) {
  const dateOrder = String(b.date || "")
    .localeCompare(String(a.date || ""));

  if (dateOrder !== 0) {
    return dateOrder;
  }

  // For transactions on the same date,
  // show the most recently added one first.
  return (order.get(b) ?? -1) - (order.get(a) ?? -1);
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

  const transactionOrder = new Map(
    state.transactions.map((t, index) => [t, index])
  );

  let recent = [...state.transactions]
    .sort((x, y) =>
      compareTransactionsNewestFirst(x, y, transactionOrder)
    )
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

  const transactionOrder = new Map(
    state.transactions.map((t, index) => [t, index])
  );

  list.sort((a, b) => {

    if (sort === "oldest") {
      const dateOrder = String(a.date || "")
        .localeCompare(String(b.date || ""));

      if (dateOrder !== 0) return dateOrder;

      return (transactionOrder.get(a) ?? -1) -
             (transactionOrder.get(b) ?? -1);
    }

    if (sort === "high") {
      return Number(b.amount) - Number(a.amount) ||
        compareTransactionsNewestFirst(a, b, transactionOrder);
    }

    if (sort === "low") {
      return Number(a.amount) - Number(b.amount) ||
        compareTransactionsNewestFirst(a, b, transactionOrder);
    }

    return compareTransactionsNewestFirst(
      a,
      b,
      transactionOrder
    );
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
  const cv = $(id);
  const ctx = cv.getContext("2d");
  const w = cv.width;
  const h = cv.height;

  ctx.clearRect(0, 0, w, h);

  const labels = [];
  const vals = [];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);

    const m = d.toLocaleDateString("en-CA").slice(0, 7);

    labels.push(
      d.toLocaleDateString(undefined, { month: "short" })
    );

    vals.push(
      sum(
        monthTx(m).filter(t => t.type === "expense"),
        t => t.amount
      )
    );
  }

  const max = Math.max(1, ...vals);

  const left = 30;
  const right = 30;
  const top = 28;
  const bottom = 40;

  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const slotW = plotW / n;
  const barW = Math.min(54, slotW * 0.58);
  const baseline = top + plotH;

  const styles = getComputedStyle(document.body);

  const accent = styles.getPropertyValue("--accent").trim();
  const muted = styles.getPropertyValue("--muted").trim();
  const line = styles.getPropertyValue("--line").trim();

  // Horizontal guide lines
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;

  for (let i = 0; i <= 3; i++) {
    const y = top + (plotH / 3) * i;

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();
  }

  // Bars, spending labels and month labels
  for (let i = 0; i < n; i++) {
    const center = left + slotW * (i + 0.5);
    const barH = plotH * vals[i] / max;
    const barTop = baseline - barH;

    if (vals[i] > 0) {
      ctx.fillStyle = accent;
      ctx.fillRect(
        center - barW / 2,
        barTop,
        barW,
        Math.max(2, barH)
      );

      let amountLabel;

      if (vals[i] >= 10000000) {
        amountLabel = "₹" + (vals[i] / 10000000).toFixed(1) + "Cr";
      } else if (vals[i] >= 100000) {
        amountLabel = "₹" + (vals[i] / 100000).toFixed(1) + "L";
      } else if (vals[i] >= 1000) {
        amountLabel = "₹" + (vals[i] / 1000).toFixed(1) + "k";
      } else {
        amountLabel = "₹" + Math.round(vals[i]);
      }

      ctx.fillStyle = muted;
      ctx.font = "600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        amountLabel,
        center,
        Math.max(16, barTop - 8)
      );
    }

    ctx.fillStyle = muted;
    ctx.font = "600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], center, h - 12);
  }

  ctx.textAlign = "left";
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

async function downloadCloudCSV() {
  try {
    if (!cloudUser) {
      alert("Please sign in first.");
      return;
    }

    const { data, error } = await supabaseClient
      .from("user_app_state")
      .select("user_id, data, updated_at")
      .eq("user_id", cloudUser.id)
      .single();

    if (error) throw error;

    const transactions = Array.isArray(data.data?.transactions)
      ? data.data.transactions
      : [];

    alert(
      "CLOUD DIAGNOSTICS\n\n" +
      "Logged-in user ID:\n" + cloudUser.id +
      "\n\nDatabase record user ID:\n" + data.user_id +
      "\n\nTransactions returned: " + transactions.length +
      "\n\nLast updated:\n" + data.updated_at
    );

  } catch (error) {
    alert("Cloud diagnostic failed: " + error.message);
  }
}

async function diagnoseTransactions() {
  try {
    if (!cloudUser) {
      alert("Please sign in before checking transaction counts.");
      return;
    }

    const userId = cloudUser.id;

    // Verify the locally stored Supabase session.
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    // Verify the signed-in user against Supabase Auth.
    const { data: verifiedData, error: verifiedError } =
      await supabaseClient.auth.getUser();

    // Read this account's IndexedDB record.
    const localRecord = await readLocalState(
      getAccountStateKey(userId)
    );

    // Inspect pending offline changes without modifying them.
    const pending = await getPendingSync(userId);

    // Read the cloud record.
    const {
      data: cloudRecord,
      error: cloudError,
      status: cloudStatusCode
    } = await supabaseClient
      .from("user_app_state", {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store" })
      })
      .select("user_id, data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (cloudError) throw cloudError;

    const sessionUserId =
      sessionData?.session?.user?.id || "No session";

    const verifiedUserId =
      verifiedData?.user?.id || "Not verified";

    const localCount =
      localRecord?.transactions?.length ?? 0;

    const appCount =
      state.transactions?.length ?? 0;

    const cloudCount =
      cloudRecord?.data?.transactions?.length ?? 0;

    const pendingCount =
      pending?.data?.transactions?.length ?? 0;

    const message =
      "SYNC DIAGNOSTICS\n\n" +

      "Signed-in ID: " + userId + "\n" +
      "Session ID: " + sessionUserId + "\n" +
      "Verified Auth ID: " + verifiedUserId + "\n" +
      "Active local user: " +
        (activeStateUserId || "None") + "\n\n" +

      "Project: " + new URL(SUPABASE_URL).host + "\n" +
      "Online: " + navigator.onLine + "\n" +
      "Cloud ready: " + cloudReady + "\n\n" +

      "Cloud row: " +
        (cloudRecord ? "Found" : "Not found") + "\n" +
      "Cloud HTTP status: " + cloudStatusCode + "\n" +
      "Cloud user ID: " +
        (cloudRecord?.user_id || "No record") + "\n" +
      "Supabase transactions: " + cloudCount + "\n\n" +

      "IndexedDB transactions: " + localCount + "\n" +
      "App memory transactions: " + appCount + "\n\n" +

      "Pending sync: " + (pending ? "Yes" : "No") + "\n" +
      "Pending transactions: " + pendingCount + "\n\n" +

      "Session error: " +
        (sessionError?.message || "None") + "\n" +
      "Auth verification error: " +
        (verifiedError?.message || "None") + "\n" +
      "Last cloud update: " +
        (cloudRecord?.updated_at || "No record");

    alert(message);

  } catch (error) {
    alert("Diagnostic failed: " + error.message);
  }
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
function showAuthenticatedApp() {
  document.body.classList.remove("auth-locked");
  updateProfileMenu();
}

function showLoginGate(message) {
  document.body.classList.add("auth-locked");
  document.body.classList.remove("profile-page-open");
  const profileMenu = $("profileMenu");

if (profileMenu) {
  profileMenu.open = false;
}

  // Clear the previous account from application memory.
  state = createEmptyState();
  activeStateKey = null;
  activeStateUserId = null;
  cloudReady = false;

  $("loginGateStatus").textContent = message;

  [
    "gateEmail",
    "gatePassword",
    "cloudEmail",
    "cloudPassword"
  ].forEach(id => {
    if ($(id)) $(id).value = "";
  });
}
function getCloudDisplayName() {
  const fullName =
    cloudUser?.user_metadata?.full_name?.trim();

  return fullName || cloudUser?.email || "Account";
}
function updateProfileMenu() {
  const name = getCloudDisplayName();
  const email = cloudUser?.email || "";
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  $("profileAvatar").textContent = initial;
  $("profilePanelAvatar").textContent = initial;

  $("profileTriggerName").textContent = name;
  $("profilePanelName").textContent = name;
  $("profilePanelEmail").textContent = email;
}

function showProfilePage(id) {
  const menu = $("profileMenu");

  if (menu) {
    menu.open = false;
  }

  showPage(id);
}
document.addEventListener("click", event => {
  const menu = $("profileMenu");

  if (
    menu &&
    menu.open &&
    !menu.contains(event.target)
  ) {
    menu.open = false;
  }
});
async function updateCloudStatus(message) {
  $("cloudStatus").textContent = message;
}

async function loadCloudData() {
  const userId = cloudUser?.id;

  if (!userId) {
    cloudReady = false;
    return;
  }

  cloudReady = false;

  try {
    // Load this account's local data first.
    await loadAccountState(userId);

    if (cloudUser?.id !== userId) return;

    // Upload pending offline changes before downloading cloud data.
    const pending = await getPendingSync(userId);

    if (pending) {
      cloudReady = true;

      const synced = await processPendingSync();

      if (!synced) {
        cloudReady = false;

        updateCloudStatus(
          "Pending local changes could not be uploaded. Local data is preserved."
        );

        setTheme();
        render();
        return;
      }

      cloudReady = false;
    }

    updateCloudStatus("Downloading cloud data...");

    const { data, error } = await supabaseClient
      .from("user_app_state", {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store" })
      })
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data || !data.data) {
      cloudReady = true;

      setTheme();
      render();

      updateCloudStatus(
        "Logged in as " + getCloudDisplayName() +
        " · Local data loaded · No cloud backup yet"
      );

      return;
    }

    if (cloudUser?.id !== userId) return;

    const cloudData = data.data;

    if (!Array.isArray(cloudData.transactions)) {
      throw new Error("Cloud transaction data is invalid.");
    }

    // Replace the active account's state with its cloud data.
    state = {
      ...createEmptyState(),
      ...cloudData,
      transactions: cloudData.transactions
    };

    // Save only under this account's local storage key.
    const accountKey = getAccountStateKey(userId);

    await writeLocalState(accountKey, state);

    // Verify the account-specific local save.
    const localData = await readLocalState(accountKey);

    const localCount = localData?.transactions?.length ?? 0;
    const cloudCount = cloudData.transactions.length;

    if (localCount !== cloudCount) {
      throw new Error(
        "Local verification failed. Cloud: " +
        cloudCount + ", Local: " + localCount
      );
    }

    if (cloudUser?.id !== userId) return;

    setTheme();
    render();

    cloudReady = true;

    updateCloudStatus(
      "Logged in as " + getCloudDisplayName() +
      " · Cloud data loaded · " + cloudCount +
      " transactions"
    );

  } catch (error) {
    cloudReady = false;

    updateCloudStatus(
      "Cloud download failed: " + error.message
    );
  }
}

async function initCloudAuth() {
  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) {
    cloudReady = false;

    showLoginGate(
      "Unable to check your account: " + error.message
    );

    return;
  }

  cloudUser = data.session?.user || null;

  if (cloudUser) {
    const userId = cloudUser.id;

    // Keep the dashboard locked until this account's data is loaded.
    showLoginGate("Loading your account data...");

    $("cloudEmail").value = cloudUser.email || "";
    $("cloudFullName").value =
      cloudUser.user_metadata?.full_name || "";

    updateCloudStatus("Loading cloud data...");

    await loadCloudData();

    if (
      cloudUser?.id === userId &&
      activeStateUserId === userId
    ) {
      showAuthenticatedApp();
      render();
    } else {
      showLoginGate(
        "Unable to load your account's local data. Please refresh and sign in again."
      );
    }
  } else {
    cloudReady = false;

    showLoginGate(
      "Sign in to access your personal finance dashboard."
    );
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    cloudUser = session?.user || null;

    if (event === "SIGNED_OUT" || !cloudUser) {
      cloudReady = false;

      showLoginGate(
        "You have signed out. Sign in to continue."
      );
    }

    if (event === "USER_UPDATED" && cloudUser) {
  $("cloudFullName").value =
    cloudUser.user_metadata?.full_name || "";

  updateProfileMenu();
}
  });
}

async function signUpCloud() {
  const fromGate =
    document.body.classList.contains("auth-locked");

  const fullName = $(
    fromGate ? "gateFullName" : "cloudFullName"
  ).value.trim();

  const email = $(
    fromGate ? "gateEmail" : "cloudEmail"
  ).value.trim();

  const password = $(
    fromGate ? "gatePassword" : "cloudPassword"
  ).value;

  if (!fullName) {
    alert("Please enter your full name.");
    return;
  }

  if (!email || password.length < 6) {
    alert("Enter a valid email and a password with at least 6 characters.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        "https://arvindkittu.github.io/My-money-tracker/",
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    alert("Account creation failed: " + error.message);
    return;
  }

  if (data.session && data.user) {
    // Lock the dashboard before changing accounts.
    showLoginGate("Loading your new account data...");

    cloudUser = data.user;
    const userId = cloudUser?.id;

    if (!userId) {
      showLoginGate("Unable to identify the new account.");
      return;
    }

    $("cloudEmail").value = email;
    $("cloudFullName").value = fullName;

    await loadCloudData();

    // Unlock only after this account's local data is initialized.
    if (
      cloudUser?.id !== userId ||
      activeStateUserId !== userId
    ) {
      $("loginGateStatus").textContent =
        "Unable to load the new account's local data. Please refresh and try again.";
      return;
    }

    showAuthenticatedApp();

    await processRecurring();
    render();

    alert("Account created successfully.");
  } else {
    if (fromGate) {
      $("gateEmail").value = email;
      $("gatePassword").value = "";
      $("loginGateStatus").textContent =
        "Account created. Please verify your email, then sign in.";
    } else {
      alert(
        "Account created. Please check your email for confirmation."
      );
    }
  }
}
async function saveCloudProfileName() {
  if (!cloudUser) {
    alert("Please sign in first.");
    return;
  }

  const fullName = $("cloudFullName").value.trim();

  if (!fullName) {
    alert("Please enter your full name.");
    return;
  }

  const { data, error } = await supabaseClient.auth.updateUser({
    data: {
      full_name: fullName
    }
  });

  if (error) {
    alert("Profile update failed: " + error.message);
    return;
  }

  cloudUser = data.user || cloudUser;
  updateProfileMenu();

  updateCloudStatus("Profile updated: " + fullName);

  alert("Your profile name has been updated successfully.");
}
async function changeCloudPassword() {
  if (!cloudUser) {
    alert("Please sign in before changing your password.");
    return;
  }

  const newPassword = $("newCloudPassword").value;
  const confirmPassword = $("confirmCloudPassword").value;

  if (newPassword.length < 6) {
    alert("Your new password must contain at least 6 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("The new passwords do not match.");
    return;
  }

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert("Password update failed: " + error.message);
      return;
    }

    $("newCloudPassword").value = "";
    $("confirmCloudPassword").value = "";

    alert("Your password has been updated successfully.");

  } catch (error) {
    alert("Password update failed: " + error.message);
  }
}
async function signInCloud() {
  const fromGate =
    document.body.classList.contains("auth-locked");

  const email = $(fromGate ? "gateEmail" : "cloudEmail")
    .value.trim();

  const password = $(fromGate ? "gatePassword" : "cloudPassword")
    .value;

  if (!email || !password) {
    alert("Enter your email and password.");
    return;
  }

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    if (fromGate) {
      $("loginGateStatus").textContent =
        "Sign-in failed: " + error.message;
    } else {
      alert("Sign-in failed: " + error.message);
    }
    return;
  }

  // Lock and clear the previous account before loading the new one.
  showLoginGate("Loading your account data...");

  cloudUser = data.user || data.session?.user;
  const userId = cloudUser?.id;

  if (!userId) {
    showLoginGate("Unable to identify the signed-in account.");
    return;
  }

  $("cloudEmail").value = email;
  $("cloudFullName").value =
    cloudUser.user_metadata?.full_name || "";

  await loadCloudData();

  if (
    cloudUser?.id !== userId ||
    activeStateUserId !== userId
  ) {
    $("loginGateStatus").textContent =
      "Your account's local data could not be loaded. Please refresh and try again.";
    return;
  }

  showAuthenticatedApp();

  await processRecurring();
  render();

  alert("Signed in successfully.");
}

async function signOutCloud() {
  if (cloudUser) {
    const pending = await getPendingSync(cloudUser.id);

    if (pending) {
      if (navigator.onLine && cloudReady) {
        await processPendingSync();
      }

      const remaining = await getPendingSync(cloudUser.id);

      if (remaining && !confirm(
        "Some changes are still waiting to sync.\n\n" +
        "They will remain saved locally for this account.\n\n" +
        "Do you still want to sign out?"
      )) {
        return;
      }
    }
  }

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert("Sign-out failed: " + error.message);
    return;
  }

  cloudUser = null;
  cloudReady = false;

  showLoginGate(
    "You have signed out successfully. Sign in to continue."
  );
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


window.uploadLocalDataToCloud = async function() {
  try {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      alert("Login check failed: " + sessionError.message);
      return;
    }

    const user = sessionData.session?.user;

    if (!user) {
      alert("Please sign in first.");
      return;
    }

    const transactionCount = state.transactions.length;

    if (!confirm(
      "Update your cloud backup with the latest local data?\n\n" +
      "Transactions: " + transactionCount +
      "\nYour existing cloud backup will be updated."
    )) return;

    const cloudData = JSON.parse(JSON.stringify(state));

    const { error: uploadError } = await supabaseClient
      .from("user_app_state")
      .upsert({
        user_id: user.id,
        data: cloudData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

    if (uploadError) {
      alert("Cloud update failed: " + uploadError.message);
      return;
    }

    alert(
      "SUCCESS! Your cloud backup has been updated.\n" +
      "Transactions: " + transactionCount
    );

  } catch (error) {
    alert("Unexpected error: " + error.message);
  }
};
let cloudRetryInProgress = false;

async function retryPendingSync() {
  if (
    cloudRetryInProgress ||
    !cloudUser ||
    !navigator.onLine
  ) {
    return;
  }

  cloudRetryInProgress = true;

  try {
    if (!cloudReady) {
      await loadCloudData();
    } else {
      await processPendingSync();
    }
  } finally {
    cloudRetryInProgress = false;
  }
}

async function init() {
  await openDB();
  await load();
  setTheme();
  $("currency").value = state.currency;

 await initCloudAuth();

window.addEventListener("online", retryPendingSync);

window.addEventListener("offline", () => {
  if (cloudUser) {
    updateCloudStatus(
      "Offline · Changes will sync when connection returns"
    );
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    retryPendingSync();
  }
});

if (cloudUser && activeStateUserId === cloudUser.id) {
  await processRecurring();
}

  render();

  if ("serviceWorker" in navigator &&
      location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }
}

init();

