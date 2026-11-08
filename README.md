# My Money

A private, offline-first money tracker that runs in your phone's browser and installs to the Home Screen like an app. Pitch-black, minimal, built for the iPhone.

> Open the site in Safari, tap **Share → Add to Home Screen**, then open it from the new icon.

## What it does

- **Track** expenses and income with a number pad, a description, five one-line category pills and a date.
- **See** each month as a chart and a list. Switch between **Expense**, **Income** and **Net** (income minus expenses). Change month with the arrows or by swiping the chart; use 1M / 1Y / All for longer views.
- **Budget** a monthly amount, and set a limit per category. You get a message at 80% and again when you go over.
- **Search and filter** by description, category or amount, by type, by period and by category (magnifier next to 1M / 1Y / All).
- **Plan**: recurring entries (rent, salary, EMI), savings goals, and loans with a "Pay EMI" button.
- **Move fast**: tap a frequent shortcut (for example *Tea · ₹20*) to fill a whole entry, copy any transaction, and let the app suggest a category as you type.
- **Stay safe**: swipe a transaction right to edit or left to delete, with a 6-second **Undo**. Swipe the add sheet down to close it.
- **Insights**: spent, income, net saved, daily average, month-end projection and spending by category.
- **Take your data with you**: backup and restore as JSON, export CSV for Excel or Sheets.
- **Reminders**: a daily "log your expenses" alert, added to your Calendar.
- **Works offline** after the first visit.

## Privacy

- Your data is stored **in your browser on your phone**. Nothing is sent anywhere unless you sign in.
- **Signing in is optional.** If you do, a copy of your transactions, budgets, categories, recurring entries, goals and loans is saved to a Supabase database so your devices stay in sync. A database rule (Row Level Security) lets each account read and write **only its own row**.
- There are **no ads, no analytics and no trackers**. The only outside requests are the sync library from jsDelivr and your Supabase project (when signed in).
- Backups, CSV files and calendar reminders are created on your device only when you tap them.
- The Supabase "anon" key in `app.js` is public by design. Row Level Security is what protects the data, so keep it switched on.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page and styles |
| `app.js` | All app logic |
| `sw.js` | Offline support (service worker) |
| `manifest.webmanifest` | Home Screen app details |
| `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Icons |
| `.github/workflows/check.yml` | Automatic check on every upload |

## Publish it yourself (GitHub Pages)

1. Upload all the files above to a repository.
2. **Settings → Pages**, choose your branch and the root folder, then save.
3. Open the address GitHub shows, in Safari on your iPhone, and add it to the Home Screen.

To update, upload the new files over the old ones. If the app looks old, close it fully and reopen, or remove it from the Home Screen and add it again.

## Set up your own sync (optional)

1. Create a free project at supabase.com.
2. **Authentication → Providers**: keep **Email** enabled. For "Forgot password?" add your site address under **URL Configuration**.
3. In the **SQL Editor**, run:

```sql
create table public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_app_state enable row level security;

create policy "Read own money tracker data" on public.user_app_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own money tracker data" on public.user_app_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own money tracker data" on public.user_app_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on table public.user_app_state to authenticated;
```

4. In `app.js`, replace `SB_URL` and `SB_KEY` with your project's URL and anon (public) key from **Project Settings → API**.

## Good to know

- iPhone web apps cannot send notifications on their own, so reminders are repeating Calendar events.
- Browsers can clear local data if a site is unused for a long time. Sign in to sync, or use **Backup Data** now and then.
- The automatic check runs when you upload files. A red ✗ next to a commit in the **Actions** tab means something is broken, such as a typo in `app.js` or a missing icon. It warns you; it does not stop GitHub Pages from publishing.
