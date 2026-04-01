const express = require("express");
const { supabase } = require("../supabase/client");
const { sendUserInvitation } = require("../helpers/superadmin_helper");
const { supabase_superadmin_auth } = require("../middlewares/auth_checker");

const superadmin_route = express.Router();

// Auth middleware for all superadmin endpoints
superadmin_route.use(supabase_superadmin_auth);

superadmin_route.post("/activateOfficial", async (req, res) => {
  const { official_code } = req.body;

  if (official_code == null)
    return res.status(400).json({
      success: false,
      message: "Official code is not provided.",
    });

  const { data, error } = await supabase
    .from("barangay_officials")
    .select("email, contact_number, position, first_name, last_name, uid")
    .eq("official_code", official_code)
    .limit(1)
    .maybeSingle();

  if (error)
    return res.status(400).json({
      message: error,
    });

  if (data?.uid != null)
    return res.status(400).json({
      success: false,
      message: "Official already activated.",
    });

  if (data) {
    const isCreated = await sendUserInvitation(
      data.email,
      data.contact_number,
      data.position,
      `${data.first_name} ${data.last_name}`,
      official_code,
    );

    return isCreated
      ? res.status(201).json({
          // CREATED SUCCESSFULLY
          success: isCreated,
          email: data.email,
          contact_number: data.contact_number,
          message: "Official successfully activated.",
        })
      : res.status(400).json({
          // CREATE FAILED
          success: isCreated,
          email: data.email,
          contact_number: data.contact_number,
          message: "Official activation failed.",
        });
  } else {
    return res.status(204).json({
      success: false,
      message: "Official Not Found",
    });
  }
});

module.exports = superadmin_route;
