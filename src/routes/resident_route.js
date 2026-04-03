const express = require("express");
const { chatbot_controller } = require("../controllers/resident_controller");
const { supabase_resident_auth } = require("../middlewares/auth_checker");
const { supabase } = require("../supabase/client");

const resident_route = express.Router();

resident_route.get("/checkIdendity", async (req, res) => {
  const {
    house_id = null,
    fname = null,
    lname = null,
    mname = null,
    bdate = null,
  } = req.body;

  if (!house_id || !fname || !lname || !bdate) {
    return res.status(400).json({
      result: false,
      message:
        "Missing required fields: house_id, fname, lname, and bdate are required",
    });
  }

  let query = supabase
    .from("residents_tbl_view")
    .select("id, is_activated")
    .eq("household_id", house_id)
    .ilike("first_name", fname)
    .ilike("last_name", lname)
    .eq("date_of_birth", bdate);

  if (mname) {
    query = query.ilike("middle_name", mname);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    return res.status(500).json({
      result: false,
      message: "Failed to check resident identity",
      debug: error.message,
    });
  }

  if (!data) {
    return res.status(200).json({
      result: false,
      message: "No resident record found",
    });
  }

  if (data.is_activated === true) {
    return res.status(200).json({
      result: false,
      message: "Resident already registered",
    });
  }

  const { data: tokenData, error: tokenError } = await supabase
    .from("activation_token")
    .insert({
      id: data.id,
    })
    .select("token")
    .limit(1)
    .maybeSingle();

  return res.status(200).json({
    result: true,
    message: "Resident found and not yet activated",
    token: tokenData.token,
  });
});

resident_route.post("/activateAccount", async (req, res) => {
  // add listener to auth.user if last sign in is null, then changed, update the email of the app_metadata.id = residents_tbl_view.id

  const {
    house_id = null,
    fname = null,
    lname = null,
    mname = null,
    bdate = null,
    token = null,
    email = null,
  } = req.body;

  //#region body validation
  if (!house_id || !fname || !lname || !bdate || !token || !email) {
    return res.status(400).json({
      result: false,
      message: "Missing required fields",
    });
  }
  //#endregion

  let query = supabase
    .from("residents_tbl_view")
    .select("id, is_activated, email, resident_no, first_name, last_name")
    .eq("household_id", house_id)
    .ilike("first_name", fname)
    .ilike("last_name", lname)
    .eq("date_of_birth", bdate);

  if (mname) {
    query = query.ilike("middle_name", mname);
  }

  const { data: userData, error: userError } = await query
    .limit(1)
    .maybeSingle();

  //#region validation
  if (userError) {
    return res.status(500).json({
      result: false,
      message: "Failed to check resident identity",
      debug: userError.message,
    });
  }
  if (!userData) {
    return res.status(200).json({
      result: false,
      message: "No resident record found",
    });
  }
  if (userData.is_activated === true) {
    return res.status(200).json({
      result: false,
      message: "Resident already registered",
    });
  }
  if (userData?.email && email != userData.email) {
    return res.status(200).json({
      result: false,
      message: "Email does not match ",
    });
  }
  //#endregion

  //#region TOKEN VALIDATOR
  const { data: tokenResult, error: tokenError } = await supabase
    .rpc("use_activation_token", {
      p_token: token,
      p_id: userData.id,
    })
    .single();

  if (tokenError) {
    return res.status(400).json({
      result: false,
      message: "Failed to validate activation token",
      debug: tokenError.message,
    });
  }

  if (!tokenResult?.is_valid) {
    return res.status(200).json({
      result: false,
      message: tokenResult?.message || "Token is invalid",
    });
  }
  //#endregion

  //#region CREATING USER
  const { data: signupData, error: signupError } =
    await supabase.auth.admin.createUser({
      email: userData.email ? userData.email : email,
      password: userData.resident_no,
      email_confirm: true,
      user_metadata: {
        fullname: `${userData.first_name} ${userData.last_name}`,
      },
      app_metadata: {
        role: "resident",
        position: null,
        id: userData.id,
      },
    });

  if (signupError) {
    return res.status(400).json({
      result: false,
      message: signupError.message,
      //   debug: signupError,
    });
  }
  //#endregion

  //#region Update email to barangay link if no email is retrieved
  if (!userData.email && email) {
    const { error: emailUpdateError } = await supabase
      .schema("barangaylink")
      .from("residents")
      .update({ email: email })
      .eq("id", userData.id);

    if (emailUpdateError) {
      console.log(emailUpdateError);
      return res.status(200).json({
        result: false,
        message: "Failed to update email from barangaylink.",
      });
    }
  }
  //#endregion

  //#region record registered resident
  const auth_uid = signupData.user.id;
  const resident_id = userData.id;

  const is_activated = true;
  const resident_email = signupData.user.email;

  const { data: recordRegisteredData, error: recordRegisteredError } =
    await supabase.from("registered_residents").insert({
      id: resident_id,
      auth_uid: auth_uid,
      is_activated: is_activated,
      email: resident_email,
    });

  if (recordRegisteredError) {
    console.log(recordRegisteredError);
    res.status(400).json({
      result: false,
      message: recordRegisteredError.message,
    });
  }
  //#endregion

  return res.status(200).json({
    result: true,
    message: `Account is registered to ${userData.email ? userData.email : email}. The password is your RESIDENT NUMBER itself.`,
    // debug: signupData,
  });
});

// Auth Middleware
resident_route.use(supabase_resident_auth);

resident_route.post("/chatbot", chatbot_controller);

module.exports = { resident_route };
