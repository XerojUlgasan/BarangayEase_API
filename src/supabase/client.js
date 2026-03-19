require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Create a single supabase client for interacting with your database
const supabase = createClient(
  "https://qcnljiogxnmfugcaqxge.supabase.co",
  process.env.SUPABASE_SERVICE_API,
  // "https://qcnljiogxnmfugcaqxge.supabase.co",
  // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbmxqaW9neG5tZnVnY2FxeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ2MzU1MCwiZXhwIjoyMDg2MDM5NTUwfQ.mMmAs5OW8t09GhgkiL8VlMfOQt2ze8yW6VQHtUqRFJ8",
);

const household_supabase = createClient(
  "https://tqcjrhrjykisuldsxwye.supabase.co",
  process.env.SUPABASE_HOUSEHOLD_API,
);

module.exports = { supabase, household_supabase };
