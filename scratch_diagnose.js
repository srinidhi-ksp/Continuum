/**
 * Diagnose why PatientContext returns 0 patients.
 * Run: node scratch_diagnose.js
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bfwjycbesjcgxjypfzna.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmd2p5Y2Jlc2pjZ3hqeXBmem5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTIzMzIsImV4cCI6MjEwMjU2ODMzMn0.d193gDaCWYSDXqQVBJTkOnif8fCJYD3lpmlQ_TbnEvc";

// Use the TWO known test accounts
const ACCOUNTS = [
  { email: "srinidhieshp050_bcs28@mepcoeng.ac.in", password: "TEST_PW_1" },
  { email: "srinidhiksp050@gmail.com",              password: "TEST_PW_2" },
];

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function diagnose(email, password) {
  console.log("\n========================================");
  console.log("Account:", email);
  console.log("========================================");

  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    console.log("  ❌ Sign-in failed:", signInErr.message);
    return;
  }
  const authUser = signInData.user;
  console.log("  ✅ Auth user id:", authUser.id);

  // Fetch caregiver row
  const { data: cg, error: cgErr } = await supabase
    .from("caregiver")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (cgErr) {
    console.log("  ❌ caregiver lookup error:", cgErr.message, cgErr.code, cgErr.details);
  } else if (!cg) {
    console.log("  ⚠️  No caregiver row found for auth_user_id:", authUser.id);
    // Try by email
    const { data: cgByEmail, error: eErr } = await supabase
      .from("caregiver")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (eErr) {
      console.log("  ❌ caregiver by-email error:", eErr.message);
    } else if (!cgByEmail) {
      console.log("  ⚠️  No caregiver row found by email either.");
    } else {
      console.log("  ℹ️  Found by email. caregiver_id:", cgByEmail.caregiver_id, "auth_user_id:", cgByEmail.auth_user_id);
    }
  } else {
    console.log("  ✅ caregiver_id:", cg.caregiver_id, " full_name:", cg.full_name);

    // Fetch caregiver_pat memberships
    const { data: links, error: linkErr } = await supabase
      .from("caregiver_pat")
      .select("patient_id, role, status")
      .eq("caregiver_id", cg.caregiver_id);
    if (linkErr) {
      console.log("  ❌ caregiver_pat error:", linkErr.message, linkErr.code, linkErr.hint, linkErr.details);
    } else {
      console.log("  caregiver_pat rows:", JSON.stringify(links));
    }

    // Try active only
    const { data: activeLinks, error: activeLinkErr } = await supabase
      .from("caregiver_pat")
      .select("patient_id, role, status")
      .eq("caregiver_id", cg.caregiver_id)
      .eq("status", "active");
    if (activeLinkErr) {
      console.log("  ❌ caregiver_pat (active) error:", activeLinkErr.message, activeLinkErr.hint);
    } else {
      console.log("  caregiver_pat active rows:", JSON.stringify(activeLinks));
    }
  }

  await supabase.auth.signOut();
}

// Run with placeholder passwords - user must fill these in
console.log("NOTE: Fill in actual passwords in ACCOUNTS array before running.");
// diagnose(ACCOUNTS[0].email, ACCOUNTS[0].password).then(() => diagnose(ACCOUNTS[1].email, ACCOUNTS[1].password));
console.log("Script ready. Uncomment the last line after adding passwords.");
