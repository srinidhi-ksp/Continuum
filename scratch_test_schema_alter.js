import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envTextServer = fs.readFileSync("../Continuum_server/.env", "utf8");

function parseEnv(text) {
  const env = {};
  text.split("\n").forEach((line) => {
    const [k, v] = line.split("=");
    if (k && v) env[k.trim()] = v.trim();
  });
  return env;
}

const serverEnv = parseEnv(envTextServer);

const supabaseAdmin = createClient(
  serverEnv.SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Testing inserting extra column or checking caregiver_pat columns...");
  const { data, error } = await supabaseAdmin
    .from("caregiver_pat")
    .select("caregiver_id, patient_id, role, joining_at, removed_at")
    .limit(1);
  console.log("caregiver_pat select:", { data, error: error?.message });
}

main().catch(console.error);
