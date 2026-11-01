# SURYAMIT: Team Setup and Spec Assignments

## Everyone: one-time setup

```bash
git clone https://github.com/its-mahi/Claude-WorkShop.git
cd Claude-WorkShop
npm install
```

Create `.env.local` in the `Claude-WorkShop` folder and paste in the contents of the `.env.team` file Bhavin sends you.

```bash
npm run dev        # open http://localhost:3000 and try a demo button
```

If a different app shows up, open http://127.0.0.1:3000 instead.

**Before every work session and every push:**

```bash
git pull origin main
```

**To save and share your work:**

```bash
git add -A
git commit -m "feat(00X): what you built"
git pull origin main
git push origin main
```

---

## Member 1 — Bhavin: spec 003, Solar financial engine

```bash
echo '{"feature_directory": "specs/003-solar-financial-engine"}' > .specify/feature.json
claude
```

Inside Claude:

```
/speckit-implement 003-solar-financial-engine
```

- **Start with:** the subsidy, net-cost and payback functions with their unit tests, then the rules and sources page. Saving estimates to the database waits until Member 2 pushes the 002 migration.
- **Next:** spec 007, Quote acceptance.

---

## Member 2 — Household: spec 002, Household solar request ⚡ others wait on you

```bash
echo '{"feature_directory": "specs/002-household-solar-request"}' > .specify/feature.json
claude
```

Inside Claude:

```
/speckit-implement 002-household-solar-request — do the Setup and Foundational phases first (household_requests migration, storage bucket, plus seed tasks T063–T064 for the Sharma demo request) and push them to main before building the wizard UI
```

- **Priority:** push the migration and seed to `main` **within the first hour**. Members 1, 3 and 4 need that table.
- **Next:** spec 006, Quote comparison and scoring.

---

## Member 3 — Vendor: spec 004, Vendor discovery, then 005, Quote submission

```bash
echo '{"feature_directory": "specs/004-vendor-request-discovery"}' > .specify/feature.json
claude
```

Inside Claude:

```
/speckit-implement 004-vendor-request-discovery — until the 002 household_requests migration is on main, build the vendor dashboard UI with sample data and the tests first
```

**After 004:**

```bash
echo '{"feature_directory": "specs/005-vendor-quote-submission"}' > .specify/feature.json
```

```
/speckit-implement 005-vendor-quote-submission
```

---

## Member 4 — AI: spec 008, Roof analysis, then 010, 009, 011

```bash
echo '{"feature_directory": "specs/008-roof-photo-analysis"}' > .specify/feature.json
claude
```

Inside Claude:

```
/speckit-implement 008-roof-photo-analysis — start with the shared AI client in src/lib/ai/ and its tests using the mock provider; build the roof-analysis endpoint after the 002 migration is on main
```

- Add a Gemini key to `.env.local`: `GEMINI_API_KEY=...`. Get one from https://aistudio.google.com/apikey.
- **Then, in order:** `010-voice-requirement-entry` → `009-quote-extraction-injection-defense` → `011-ai-solar-advisor`. For each one, set `feature.json` the same way, then run `/speckit-implement <spec name>`.

---

## Rules for everyone

- **Edit only your own spec folder** and your feature's section in `supabase/seed.sql`.
- **Database changes:** add a migration file, push it to `main`, and tell Bhavin. He applies it to the shared database with `npx supabase db push --linked`.
- **Tests run on a local database, not the shared one.** Before running them, start Docker and run `npx supabase start`, then `npm run db:reset`.
- **Stuck on another member's work?** Build that part with sample data and keep going.

Who owns what is in `docs/team-board.html`.

## Common problems

| Problem | Fix |
|---|---|
| Another app shows instead of SURYAMIT | Open `http://127.0.0.1:3000` |
| "Demo account is unavailable" | Check that `.env.local` has the demo lines from `.env.team` |
| Sign-up fails | Tell Bhavin: the "Confirm email" setting in Supabase needs to be off |
| `npm install` errors | Run `node -v` and update Node.js to 20.9 or newer |
