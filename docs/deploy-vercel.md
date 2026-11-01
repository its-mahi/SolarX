# Deploy SolarX to Vercel (with database and AI keys)

This guide takes you from the code in GitHub to a working public site. Follow the parts in order.
Never paste real keys into this file or into Git. Keys go only into Vercel's environment
variables and your own `.env.local`.

**What runs where**

| Piece | Where | Notes |
|---|---|---|
| The web app and API routes | Vercel | One Next.js project |
| Database, sign-in, photo storage | Supabase (cloud) | Region `ap-south-1` (Mumbai) |
| AI (roof photo, voice, quote extraction, advisor) | Google Gemini, optional Groq | The app works without it and shows "unavailable" |
| Maps | OpenStreetMap tiles | No key needed |

**Time needed:** about 30 minutes, plus waiting for builds.

---

## Part 0 — Before you start

You need accounts on **GitHub** (the repo `its-mahi/Claude-WorkShop`), **Vercel**, **Supabase**,
and **Google AI Studio**. A Groq account is optional.

On your computer: Node.js 20.9 or newer (`node -v`), Git, and the project cloned and installed:

```bash
git clone https://github.com/its-mahi/Claude-WorkShop.git
cd Claude-WorkShop
npm install
```

Make sure the latest code is on GitHub (Vercel deploys from there):

```bash
git pull origin main
git status            # should say "nothing to commit"
git push origin main  # only if you have local commits
```

---

## Part 1 — The database (Supabase)

### Option A — Use the team's existing project (fastest)

The team already has a project, `suryamit` (ref `pcgubmdiewaiitvvnxhd`, region Mumbai) with all
tables, the demo data and the demo roof photo. If you use it:

1. Skip to **Step 1.5** (check the auth settings).
2. Get its keys in **Step 1.4**.

### Option B — Create a new project

**Step 1.1 — Create the project.** Go to <https://supabase.com/dashboard> → **New project**.
Choose a name (for example `solarx`), region **South Asia (Mumbai)**, and a strong database
password. **Save that password in a password manager.** You need it to apply database changes.

(Command-line alternative, run in your own terminal: `npx supabase login`, then
`npx supabase projects create solarx --org-id <your-org-id> --region ap-south-1 --db-password '<password>'`.)

**Step 1.2 — Apply the database structure.** In your own terminal, inside the project folder:

```bash
npx supabase login                                   # opens a browser; approve it
npx supabase link --project-ref <your-project-ref>   # ref = the xxxx in xxxx.supabase.co
npx supabase db push --include-seed
```

When asked for the database password, enter the one from Step 1.1. Answer `y` to both prompts.
This applies migrations `…000100` to `…000900` (tables, security rules, storage buckets) **and**
loads the demo data (4 demo accounts, the Sharma Residence request, 3 demo quotes, a demo roof
assessment).

> **Only run `--include-seed` on a brand-new project.** On a project that already has the demo
> accounts it fails with duplicate-key errors. To apply future changes later, run
> `npx supabase db push` without `--include-seed`.

**Step 1.3 — Upload the demo roof photo.** The seed only inserts the database row; the photo file
goes into storage. Create a file `.env.local` in the project folder with your project's values
(see Step 1.4 for where to find them):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Then run:

```bash
npm run seed:storage
```

You should see `Uploaded demo roof photo to roof-photos/…`.

### Step 1.4 — Find the three Supabase values

In the Supabase dashboard open your project → **Project Settings → API** (or **API Keys**):

| What | Where it appears | Used as |
|---|---|---|
| **Project URL** | `https://<ref>.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon** key (public) | "anon public", or under *Legacy API keys* | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** key (**secret**) | "service_role", or under *Legacy API keys* | `SUPABASE_SERVICE_ROLE_KEY` |

This app uses the **legacy `anon` and `service_role` keys**. If your dashboard shows new
"publishable / secret" keys first, open the *Legacy API keys* tab and use those.

Command-line alternative: `npx supabase projects api-keys --project-ref <ref>`.

### Step 1.5 — Check the sign-in settings

Go to **Authentication → Sign In / Providers → Email** (or **Providers → Email**):

1. Turn **Confirm email** **off**. The sign-up flow expects the account to work immediately.
   (Otherwise sign-up fails or users get stuck.)
2. Set **Minimum password length** to **8** (the app already requires 8).
3. Click **Save**.

You will add the website address to Supabase in Part 4, after Vercel gives you one.

### Step 1.6 — Check that everything is there

In the dashboard:

- **Table Editor** shows `profiles`, `vendors`, `household_requests`, `solar_estimates`, `quotes`,
  `quote_reviews`, `quote_acceptances`, `roof_assessments`.
- **Storage** shows two **private** buckets: `roof-photos` and `quote-documents`.
- `roof-photos` contains the demo photo under `d0000000-…/d0000000-…/clear-roof.jpg`.

---

## Part 2 — The AI keys

The app works without AI. These steps turn on roof photo analysis, voice parsing, quote
extraction and the advisor explanation. **Do this part carefully; AI problems are the most
common surprise.**

### Step 2.1 — Gemini (needed for roof photos; covers everything)

1. Go to <https://aistudio.google.com/apikey> and click **Create API key**.
2. Copy the key. Keep it secret.
3. Find a **model name** your key can use. In your terminal (the `read -s` line asks you to
   paste the key without showing it):

   ```bash
   read -s GEMINI_API_KEY; export GEMINI_API_KEY
   curl -s -H "x-goog-api-key: $GEMINI_API_KEY" \
     "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100" \
     | grep '"name"' | grep -i flash
   ```

   Pick a **flash** model from the list that is current (for example one named `gemini-…-flash`).
   Models marked "no longer available to new users" in an error message cannot be used with a
   new key.
4. **Test that it really generates text** (this is the check that matters):

   ```bash
   curl -s -X POST -H "x-goog-api-key: $GEMINI_API_KEY" -H "content-type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Reply with the single word: ok"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/<MODEL_NAME>:generateContent"
   ```

   You should get JSON containing `"text": "ok"`.

   - **`404` or an empty answer for every model:** during our testing one key could list models
     but returned 404 for generation. If that happens, create a **new API key in a new Google
     Cloud project** at the same AI Studio page and try again, or use Groq (Step 2.2) for the
     text features.
   - **`429`:** you hit the free-tier limit. Wait a minute or pick a lighter model.
   - **`503` "high demand":** temporary. Retry later.

5. Remember the key as `GEMINI_API_KEY` and the model as `GEMINI_MODEL`.

### Step 2.2 — Groq (optional, text only)

Groq covers **voice parsing, quote extraction from pasted text and the advisor**. It cannot read
**roof photos or uploaded quote images and PDFs**, so keep Gemini for those.

1. Create a key at <https://console.groq.com/keys>.
2. Pick a model name from <https://console.groq.com/docs/models> (a current Llama model).
3. Test the key:

   ```bash
   read -s GROQ_API_KEY; export GROQ_API_KEY
   curl -s -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models | head -c 300
   ```

   You should see a list of models, not an error.
4. Remember them as `GROQ_API_KEY` and `GROQ_MODEL`.

### Step 2.3 — Optional AI tuning

| Variable | Default | Meaning |
|---|---|---|
| `AI_TIMEOUT_MS` | `20000` | Time allowed per AI attempt (1000 to 25000) |
| `AI_MAX_RETRIES` | `1` | Extra attempts after a failure (0 to 2) |

On a Vercel plan whose functions are limited to 10 seconds, set `AI_TIMEOUT_MS=8000` and
`AI_MAX_RETRIES=0`, otherwise Vercel cuts the request off before the AI answers. See the note in
Part 5.

---

## Part 3 — Deploy on Vercel

**Step 3.1 — Import the project.** Go to <https://vercel.com/new> and sign in with GitHub.
Choose the repository `its-mahi/Claude-WorkShop`.

- If the repo does not appear: the repo belongs to another GitHub account. Ask its owner to
  import it, or add your account as a collaborator, or fork the repo into your own account and
  import the fork. Alternatively run `npx vercel` in your own terminal inside the project folder.

**Step 3.2 — Settings on the import screen.**

| Setting | Value |
|---|---|
| Framework Preset | **Next.js** (detected automatically) |
| Root Directory | leave empty (the repo root) |
| Build Command | leave the default (`next build`) |
| Install Command | leave the default |
| Node.js version | open **Settings → General** after the import and choose **20.x or newer** (22.x is fine) |

**Step 3.3 — Add the environment variables before the first deploy.** Open **Environment
Variables** on the import screen and add each row for **Production**, **Preview** and
**Development**.

| Name | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key | no (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key | **yes, never share** |
| `DEMO_ACCOUNTS_ENABLED` | `true` (or `false` for a real launch) | no |
| `DEMO_ACCOUNT_PASSWORD` | `suryamit-demo-2026` (must equal the password in `supabase/seed.sql`) | low |
| `GEMINI_API_KEY` | your Gemini key | **yes** |
| `GEMINI_MODEL` | the model from Step 2.1 | no |
| `GROQ_API_KEY` | optional | **yes** |
| `GROQ_MODEL` | optional | no |
| `AI_TIMEOUT_MS` | optional | no |
| `AI_MAX_RETRIES` | optional | no |

Important:

- The two `NEXT_PUBLIC_…` values are **baked into the build**. They must exist before the build
  starts. If you change them later, **redeploy**.
- **Never** put the service_role key or an AI key into a variable starting with `NEXT_PUBLIC_`.
- Mark the secret ones as **Sensitive** if Vercel offers the option.

**Step 3.4 — Click Deploy.** The first build takes a few minutes. When it finishes Vercel shows
your address, for example `https://claude-work-shop.vercel.app`.

**Step 3.5 — Run the app close to the database (optional, recommended).** Your database is in
Mumbai. Add a file named `vercel.json` in the project root:

```json
{
  "regions": ["bom1"]
}
```

Commit and push it. This makes API calls to Supabase noticeably faster.

---

## Part 4 — Tell Supabase about your website

Go to Supabase → **Authentication → URL Configuration**:

1. **Site URL:** your Vercel address, for example `https://claude-work-shop.vercel.app`.
2. **Redirect URLs:** add `https://claude-work-shop.vercel.app/**`. If you use Vercel preview
   deployments, also add a wildcard for them, for example
   `https://*-<your-vercel-team>.vercel.app/**`.
3. Save.

If you later add a custom domain, add it here too.

---

## Part 5 — Check that everything works

Open your Vercel address and go through this list.

| # | Check | Expected |
|---|---|---|
| 1 | Home page | Headline, 4 steps, demo account buttons |
| 2 | **Try as demo household** | Dashboard with "Banjara Hills, Hyderabad", 3 quotes received |
| 3 | Open **Compare quotes** | SolarTech 94.8, SunRise 94.3, GreenVolt 83.1, with score breakdowns |
| 4 | **Rules & sources** (`/rules`) | 10 rules, "Illustrative", the subsidy table |
| 5 | Sign out, **sign up** as a new household | You land on the dashboard (this proves Confirm email is off) |
| 6 | **New request**: pin the map, upload a photo up to 5 MB | Photo preview appears |
| 7 | Tick the AI consent box and press **Analyze roof photo** | Observations and limitations appear. "Analysis unavailable" means the AI is not configured; see below |
| 8 | Usage step: **Start voice input** (use Chrome), say "two hundred fifty units" | Values appear for you to confirm |
| 9 | Publish, then sign in as **Demo vendor — SunRise Energy** | The new request is listed; the detail page shows only an approximate location |
| 10 | As the vendor, submit a quote, then paste a quotation into **Extract from document** | The form fills in (AI) or says "Extraction unavailable" |
| 11 | As the household, accept a quote | Status changes to accepted; the accepted vendor sees the household contact |
| 12 | Phone width (about 360 px) | No sideways scrolling |

**Reading the AI results:** with a working key, steps 7, 8 and 10 give real output. Without one
they show "unavailable" and the rest of the flow keeps working. Do not accept the **demo**
Sharma quotes if you want to keep the demo data intact. Test acceptance on your own new request.

**Function time limit:** the AI routes ask for up to 60 seconds. Check your Vercel plan's maximum
function duration. If it is lower, AI calls that run longer fail and the app shows
"unavailable". Lower `AI_TIMEOUT_MS` as described in Step 2.3 or upgrade the plan.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on `NEXT_PUBLIC_SUPABASE_URL` | Variable missing at build time | Add it in Vercel, then redeploy |
| Pages show a 500 error | A server variable is missing | Vercel → Project → **Logs**; add the missing variable and redeploy |
| Sign-up says it cannot create the account | **Confirm email** still on | Step 1.5 |
| Sign-in redirects loop or fail | Site URL or redirect URLs wrong | Part 4 |
| No demo buttons on the home page | `DEMO_ACCOUNTS_ENABLED` is not `true` | Set it and redeploy |
| Demo sign-in fails with "unavailable" | `DEMO_ACCOUNT_PASSWORD` differs from the seed password, or the seed was not applied | Step 1.2 and Step 3.3 |
| Photo upload fails | File over 5 MB, or storage buckets missing | Step 1.6; the app also shrinks photos in the browser |
| Dashboard empty, queries fail | Migrations not applied | `npx supabase db push` (Step 1.2) |
| "Analysis unavailable" for roof photos | No key, wrong model, or Google returns 404/429 | Step 2.1 tests; check Vercel logs for `ai.call … outcome` |
| Voice input does nothing | Not Chrome, or microphone blocked | Use Chrome and allow the microphone |
| Voice stops after a short pause | Old version | Pull the latest `main` (continuous capture fix) |

To find out what the AI did, open Vercel → **Logs** and search for `ai.call`. The `outcome`
field says `ok`, `not_configured`, `rate_limited`, `timeout` or `provider_error`.

---

## Part 6 — Day-to-day after deployment

- **Every push to `main` deploys automatically.** Branch pushes get preview deployments.
- **Changing environment variables:** Vercel → **Settings → Environment Variables**, then
  **Redeploy** (new values apply only to new deployments).
- **Changing the database:** add a migration file in `supabase/migrations/`, test it locally
  (`npx supabase start`, `npm run db:reset`), push it to `main`, then the project owner runs
  `npx supabase db push` against the cloud project. **Never run `db reset` against the cloud
  project.** Edit tables in migrations, not in the dashboard.
- **Tests stay local.** The integration and browser tests create and delete users. They use the
  local database through `.env.test`, `npm run build:test` and `npm run start:test`. Never point
  them at the cloud project.
- **Backups:** the Supabase free tier has limited backups. Before any risky database change, export
  your data from the dashboard.

## Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` exist only in Vercel and
      your private `.env.local`, never in Git or chat.
- [ ] `.env.local`, `.env.team`, `.env.hosted` are listed in `.gitignore` (they are) and never
      committed.
- [ ] If a secret leaks, rotate it: create a new key in Supabase or the AI console, update
      Vercel, redeploy, and delete the old key.
- [ ] For a real (non-demo) launch set `DEMO_ACCOUNTS_ENABLED=false` and verify the rule values
      against pmsuryaghar.gov.in and mnre.gov.in (they are marked "Illustrative" until then).
- [ ] Keep the Supabase database password in a password manager.
