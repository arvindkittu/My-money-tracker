MY MONEY — PERSONAL IPHONE EXPENSE TRACKER

WHAT'S INCLUDED
- Dashboard with current-month income, expenses, net cash flow and budget remaining
- Income and expense transactions with edit/delete
- Total monthly budget and category budgets
- Six-month spending trend and category analytics
- Savings goals with progress tracking
- Monthly transaction calendar
- Recurring income/expense entries (generated when the app is opened)
- Debt and EMI records; recording a payment reduces outstanding balance and adds an expense
- CSV export (Excel-compatible)
- Full JSON backup and restore
- Dark/light appearance
- IndexedDB local database and offline service worker

IMPORTANT LIMITATIONS
- Data is stored locally in the browser on this device. Export JSON backups regularly.
- This starter version does not sync between devices.
- Recurring items are generated when the app is opened; it does not run in the background.
- CSV export contains transactions. JSON backup includes all app data.
- This app does not connect to banks or automatically import SMS/bank transactions.
- iOS web push notifications and background execution have platform restrictions; this version does not rely on them.

FREE DEPLOYMENT USING GITHUB PAGES
1. On a computer or iPhone browser, sign in to https://github.com/ or create a free account.
2. Create a new repository named my-money-tracker. Choose Public. Do not add a README (optional).
3. Upload index.html, app.js, manifest.webmanifest, sw.js and icon.svg to the repository root.
4. Open repository Settings > Pages.
5. Under Build and deployment, choose Deploy from a branch.
6. Select branch main and folder /(root), then Save.
7. Wait for GitHub Pages to publish. Your site URL will look like:
   https://YOUR-USERNAME.github.io/my-money-tracker/
8. On iPhone, open that HTTPS URL in Safari.
9. Tap Share > Add to Home Screen > Add.
10. Launch My Money from the Home Screen.

USING THE APP
- Start by setting your monthly budget.
- Add income and expenses from the + Add button.
- Add recurring salary, rent, subscriptions or bills. The app catches up due entries when opened.
- Add savings goals and debts/EMIs.
- Open More > Full backup JSON regularly and keep a copy in Files/iCloud Drive.
- Export transactions CSV whenever you want to analyse them in Excel.

PRIVACY
The app does not send financial data to a server. GitHub Pages serves the static app files only. Your entries stay in IndexedDB in the browser profile on your iPhone.
