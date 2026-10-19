import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const [k, v] = line.split("=");
  if (k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  console.log("Testing SQL execution methods...");
  
  // Try calling rpc ('exec_sql' or 'exec' or 'query') if present
  const { data: rpcData, error: rpcErr } = await supabase.rpc("exec_sql", { sql: "SELECT 1" });
  console.log("RPC exec_sql result:", { data: rpcData, error: rpcErr?.message });
}

main().catch(console.error);
