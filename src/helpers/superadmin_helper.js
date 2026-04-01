const { supabase } = require("../supabase/client");

const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;

  // Remove any whitespace
  const cleaned = String(phoneNumber).trim();

  // If starts with 0, remove it and prepend +63
  if (cleaned.startsWith("0")) {
    return "+63" + cleaned.slice(1);
  }

  // If already has +, return as is
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Otherwise prepend +63
  return "+63" + cleaned;
};

const sendUserInvitation = async (
  email,
  contact_number,
  position,
  fullname,
  official_code,
) => {
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    phone: formatPhoneNumber(contact_number),
    password: official_code,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      fullname: fullname,
      role: "official",
      position: position,
    },
  });

  if (error) {
    console.log(error);
    return false;
  } else {
    const { data: officialData, error: officialError } = await supabase
      .from("barangay_officials")
      .update({
        uid: data.user.id,
      })
      .eq("official_code", official_code)
      .is("uid", null);

    if (officialError) return false;

    return true;
  }
};

module.exports = { sendUserInvitation, formatPhoneNumber };
