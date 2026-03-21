const { supabase } = require("../supabase/client");

const extractBearerToken = (authorizationHeader = "") => {
  const [type, token] = String(authorizationHeader).split(" ");
  if (type !== "Bearer" || !token) return null;
  return token.trim();
};

const check_resident_uid = async (req) => {
  try {
    const token = extractBearerToken(req?.headers?.authorization);
    if (!token) return false;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) return false;

    const { data, error } = await supabase.rpc("check_resident_uid", {
      uid: user.id,
    });

    if (error) {
      console.log("check_resident_uid rpc error:", error);
      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.log("check_resident_uid error:", error);
    return false;
  }
};

const supabase_resident_auth = async (req, res, next) => {
  const isResident = await check_resident_uid(req);

  if (!isResident) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized: resident access required.",
    });
  }

  return next();
};

module.exports = { check_resident_uid, supabase_resident_auth };
