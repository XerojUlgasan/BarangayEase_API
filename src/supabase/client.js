require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Create a single supabase client for interacting with your database
const supabase = createClient(
  "https://qcnljiogxnmfugcaqxge.supabase.co",
  process.env.SUPABASE_SERVICE_API,
);

const household_supabase = createClient(
  "https://tqcjrhrjykisuldsxwye.supabase.co",
  process.env.SUPABASE_HOUSEHOLD_API,
);

module.exports = { supabase, household_supabase };
