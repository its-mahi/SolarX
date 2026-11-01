// Uploads the fictional demo roof photo for the Sharma Residence request (seed.sql, 002 section).
// Run after `supabase db reset`: npm run seed:storage. Server-side only (service role).
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const HOUSEHOLD_ID = "d0000000-0000-4000-8000-000000000001";
const REQUEST_ID = "d0000000-0000-4000-8000-000000000201";
const OBJECT_PATH = `${HOUSEHOLD_ID}/${REQUEST_ID}/clear-roof.jpg`;
const BUCKET = "roof-photos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const file = await readFile(new URL("../tests/fixtures/roof/clear-roof.jpg", import.meta.url));

const { error } = await supabase.storage.from(BUCKET).upload(OBJECT_PATH, file, {
  contentType: "image/jpeg",
  upsert: true,
});
if (error) {
  console.error(`Upload failed: ${error.message}`);
  process.exit(1);
}
console.log(`Uploaded demo roof photo to ${BUCKET}/${OBJECT_PATH}`);
