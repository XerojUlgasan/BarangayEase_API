const { supabase } = require("./client");

let officialsChannel = null;

const autoUpdateOfficialMetadata = () => {
  listenToBarangayOfficials();
};

const listenToBarangayOfficials = () => {
  if (officialsChannel) return officialsChannel;

  officialsChannel = supabase
    .channel("realtime:public:autoupdate:barangay_officials")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "barangay_officials" },
      async (payload) => {
        // console.log(payload);
        const newRow = payload?.new || {};
        const oldRow = payload?.old || {};

        if (!newRow.uid) return;
        if (!hasMetadataRelevantChanges(oldRow, newRow)) return;

        await syncOfficialMetadata(newRow);
      },
    )
    .subscribe((status) => {
      console.log("Auto-update official metadata status: " + status);
    });

  return officialsChannel;
};

module.exports = { autoUpdateOfficialMetadata };

//#region
const toFullname = (firstName, lastName) =>
  `${firstName || ""} ${lastName || ""}`.trim();

const hasMetadataRelevantChanges = (oldRow = {}, newRow = {}) => {
  return (
    oldRow.first_name !== newRow.first_name ||
    oldRow.last_name !== newRow.last_name ||
    oldRow.position !== newRow.position ||
    oldRow.uid !== newRow.uid
  );
};

const syncOfficialMetadata = async (officialRow) => {
  const uid = officialRow?.uid;
  if (!uid) return;

  const fullname = toFullname(officialRow.first_name, officialRow.last_name);

  const { data: authUserData, error: getUserError } =
    await supabase.auth.admin.getUserById(uid);

  if (getUserError) {
    console.log("autoUpdateOfficialMetadata getUserById error:", getUserError);
    return;
  }

  const existingMetadata = authUserData?.user?.user_metadata || {};
  const nextMetadata = {
    ...existingMetadata,
    fullname,
    role: "official",
    position: officialRow.position,
  };

  const { error: updateError } = await supabase.auth.admin.updateUserById(uid, {
    user_metadata: nextMetadata,
  });

  if (updateError) {
    console.log(
      "autoUpdateOfficialMetadata updateUserById error:",
      updateError,
    );
    return;
  }

  console.log(`Synced official metadata for uid ${uid}`);
};
//#endregion
