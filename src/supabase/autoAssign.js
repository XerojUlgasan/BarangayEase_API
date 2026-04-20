const { supabase } = require("./client");

const ACTIVE_REQUEST_STATUSES = [
  "pending",
  "in_progress",
  "for_compliance",
  "for_validation",
  "resident_complied",
];

const ACTIVE_COMPLAINT_STATUSES = [
  "for review",
  "rejected",
  "resolved",
  "recorded",
  "pending",
];

let requestsChannel = null;
let complaintsChannel = null;

const autoAssignListeners = () => {
  autoAssignComplaints();
  autoAssignRequests();
};

const autoAssignComplaints = () => {
  if (complaintsChannel) return complaintsChannel;

  complaintsChannel = supabase
    .channel("realtime:public:autoassign:complaint_tbl")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "complaint_tbl" },
      async (payload) => {
        // console.log("[auto-assign][complaint_tbl][INSERT]", payload);

        const complaintId = payload?.new?.id;
        const assignedOfficialId = payload?.new?.assigned_official_id;

        if (!complaintId || assignedOfficialId) return;
        await assignToComplaint(complaintId);
      },
    )
    .subscribe((status) => {
      console.log("Auto-assign complaints status: " + status);
    });

  return complaintsChannel;
};

const autoAssignRequests = () => {
  if (requestsChannel) return requestsChannel;

  requestsChannel = supabase
    .channel("realtime:public:autoassign:request_tbl")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "request_tbl" },
      async (payload) => {
        // console.log("[auto-assign][request_tbl][INSERT]", payload);

        const requestId = payload?.new?.id;
        const assignedOfficialId = payload?.new?.assigned_official_id;

        if (!requestId || assignedOfficialId) return;
        await assignToRequest(requestId);
      },
    )
    .subscribe((status) => {
      console.log("Auto-assign requests status: " + status);
    });

  return requestsChannel;
};

module.exports = { autoAssignListeners };

//#region
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPresentActiveOfficials = async () => {
  const today = getTodayDateString();

  const { data, error } = await supabase
    .from("attendance_records")
    .select("official_id, barangay_officials!inner(uid,status)")
    .eq("attendance_date", today)
    .not("time_in", "is", null)
    .is("time_out", null)
    .eq("barangay_officials.status", "ACTIVE");

  if (error) {
    console.log("getPresentActiveOfficials error:", error);
    return [];
  }

  return (data || [])
    .map((row) => row?.barangay_officials?.uid)
    .filter(Boolean);
};

const pickLeastBusyUid = async (
  tableName,
  statusColumnName,
  activeStatuses,
) => {
  const presentUids = await getPresentActiveOfficials();
  if (!presentUids.length) return null;

  const countsByUid = Object.fromEntries(presentUids.map((uid) => [uid, 0]));

  const { data, error } = await supabase
    .from(tableName)
    .select("assigned_official_id")
    .in("assigned_official_id", presentUids)
    .in(statusColumnName, activeStatuses);

  if (error) {
    console.log(`pickLeastBusyUid error (${tableName}):`, error);
    return null;
  }

  for (const row of data || []) {
    const uid = row?.assigned_official_id;
    if (uid && countsByUid[uid] !== undefined) {
      countsByUid[uid] += 1;
    }
  }

  const entries = Object.entries(countsByUid);
  if (!entries.length) return null;

  const minCount = Math.min(...entries.map(([, count]) => count));
  const tied = entries
    .filter(([, count]) => count === minCount)
    .map(([uid]) => uid);

  const randomIndex = Math.floor(Math.random() * tied.length);
  return tied[randomIndex] || null;
};

const assignToComplaint = async (complaintId) => {
  const selectedUid = await pickLeastBusyUid(
    "complaint_tbl",
    "status",
    ACTIVE_COMPLAINT_STATUSES,
  );

  if (!selectedUid) {
    console.log(
      "No present ACTIVE official available for complaint assignment.",
    );
    return;
  }

  const { error } = await supabase
    .from("complaint_tbl")
    .update({ assigned_official_id: selectedUid })
    .eq("id", complaintId)
    .is("assigned_official_id", null);

  if (error) {
    console.log("assignToComplaint error:", error);
    return;
  }

  console.log(
    `Complaint ${complaintId} assigned to official uid ${selectedUid}`,
  );
};

const assignToRequest = async (requestId) => {
  const selectedUid = await pickLeastBusyUid(
    "request_tbl",
    "request_status",
    ACTIVE_REQUEST_STATUSES,
  );

  if (!selectedUid) {
    console.log("No present ACTIVE official available for request assignment.");
    return;
  }

  const { error } = await supabase
    .from("request_tbl")
    .update({ assigned_official_id: selectedUid })
    .eq("id", requestId)
    .is("assigned_official_id", null);

  if (error) {
    console.log("assignToRequest error:", error);
    return;
  }

  console.log(`Request ${requestId} assigned to official uid ${selectedUid}`);
};

//#endregion
