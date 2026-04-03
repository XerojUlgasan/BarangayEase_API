const { supabase, household_supabase } = require("./client");

const getDataByUid = async (uid) => {
  return await getResidentData(await residentUidToId(uid));
};

const residentUidToId = async (uid) => {
  const { data, err } = await supabase
    .from("registered_residents")
    .select("id")
    .eq("auth_uid", uid)
    .limit(1)
    .maybeSingle();

  if (err) {
    console.log(err);
    return null;
  } else {
    console.log("ID : " + data.id);
    return data?.id || null;
  }
};

const getResidentData = async (id) => {
  if (!id) return null;

  const { data: byIdData, error: byIdError } = await supabase
    .from("residents_tbl")
    .select("contact_number, first_name, last_name, middle_name")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (byIdError) {
    console.log(byIdError);
    return null;
  }

  return byIdData;
};

const toTitle = (value = "") => {
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const buildFullName = (resident = {}) => {
  const first = resident.first_name || "Resident";
  const middle = resident.middle_name ? ` ${resident.middle_name}` : "";
  const last = resident.last_name ? ` ${resident.last_name}` : "";
  return `${first}${middle}${last}`.trim();
};

module.exports = { getDataByUid, toTitle, buildFullName };
