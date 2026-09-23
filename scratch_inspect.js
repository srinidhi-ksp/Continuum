import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const [k, v] = line.split("=");
  if (k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkTable(table) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    if (!error.message.includes("Could not find the table")) {
      console.log(`Table '${table}': ERROR - ${error.message} (${error.code})`);
    }
  } else {
    console.log(`Table '${table}': EXISTS (${data.length} rows previewed)`);
    if (data.length > 0) {
      console.log(`  Columns: ${Object.keys(data[0]).join(", ")}`);
    } else {
      // Try to insert a dummy row or check structure by selecting non-existent column to see error
      const { error: colErr } = await supabase.from(table).select("non_existent_col").limit(1);
      if (colErr) console.log(`  Structure info from error: ${colErr.message}`);
    }
  }
}

async function main() {
  const candidates = [
    "caregiver", "patient", "caregiver_pat", "emergency_contact",
    "medication", "medication_schedule", "medication_log", "daily_care_log",
    "coordination_metric", "appointment", "timeline", "timeline_event",
    "timeline_comment", "invitation", "invite", "task", "responsibility",
    "alert_preference", "alert", "user", "profile", "profiles"
  ];

  for (const t of candidates) {
    await checkTable(t);
  }
}

main().catch(console.error);
