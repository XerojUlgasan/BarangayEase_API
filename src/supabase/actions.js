const { getDataByUid, buildFullName, toTitle } = require("./utils");
const { sendMessage } = require("../telerivet/sms_controller");
const { household_supabase, supabase } = require("./client");

const complaintCategoryLabels = {
  uncategorized: "Uncategorized",
  "community concern": "Community Concern",
  "barangay complaint": "Barangay Complaint",
  "community dispute": "Community Dispute",
  "personal complaint": "Personal Complaint",
};

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item != null);
  if (value == null) return [];
  return [value];
};

const toLowerArray = (value) => {
  return toArray(value)
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
};

const normalizeComplaintCategory = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized || "uncategorized";
};

const complaintCategoryKeySet = new Set([
  "uncategorized",
  "community concern",
  "barangay complaint",
  "community dispute",
  "personal complaint",
]);

const isTrackedComplaintCategory = (value) => {
  return complaintCategoryKeySet.has(normalizeComplaintCategory(value));
};

const formatDateTimeLong = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
};

const statusGuidance = {
  pending:
    "Your request has been received and is waiting to be reviewed. Please wait for further updates.",
  "for compliance":
    "Additional documents are required. Please submit the necessary documents to the web application.",
  approved:
    "Your submitted documents have been verified. Your request is now being prepared for processing.",
  processing:
    "Your requested document is currently being processed. Please wait for further updates.",
  "ready for pickup":
    "Your document is ready! Please visit the barangay office to claim it.",
  completed: "Your document has been successfully claimed. Thank you!",
  rejected:
    "Your request was not approved. Please visit the barangay office for more details.",
};

const request_actions = async (payload) => {
  console.log("STARTING REQUEST ACTIONS");
  try {
    const oldStatus = payload?.old?.request_status || null;
    const newStatus = payload?.new?.request_status || null;
    const oldRemarks = payload?.old?.remarks || null;
    const newRemarks = payload?.new?.remarks || null;

    const statusChanged = Boolean(
      oldStatus && newStatus && oldStatus !== newStatus,
    );
    const remarksChanged = oldRemarks !== newRemarks;

    if (!statusChanged && !remarksChanged) return;

    const requesterUid =
      payload?.new?.requester_id || payload?.old?.requester_id;
    if (!requesterUid) return;

    const residentData = await getDataByUid(requesterUid);
    if (!residentData?.contact_number) {
      console.log(
        "No resident contact_number found for requester:",
        requesterUid,
      );
      return;
    }
    console.log("Contact Numner : " + residentData.contact_number);
    const fullName = buildFullName(residentData);
    const subject =
      payload?.new?.subject || payload?.old?.subject || "your request";
    const certificateType =
      payload?.new?.certificate_type ||
      payload?.old?.certificate_type ||
      "document";
    const requestId = payload?.new?.id || payload?.old?.id || "N/A";
    const updatedAt =
      payload?.new?.updated_at || payload?.new?.created_at || null;
    const updatedLine = updatedAt
      ? `Updated: ${new Date(updatedAt).toLocaleString("en-PH")}`
      : null;
    const remarks = newRemarks || "No remarks provided.";
    const guidance =
      statusGuidance[String(newStatus).toLowerCase()] ||
      "For questions, please contact the barangay office.";
    const statusLine = statusChanged
      ? `Status: ${toTitle(oldStatus)} -> ${toTitle(newStatus)}`
      : `Status: ${toTitle(newStatus || oldStatus || "pending")}`;
    const remarksLine = remarksChanged
      ? `Remarks updated: ${remarks}`
      : `Remarks: ${remarks}`;

    const messageParts = [
      `Hi ${fullName}, update on your barangay request (#${requestId}):`,
      `Type: ${toTitle(certificateType)}`,
      `Subject: ${subject}`,
      statusLine,
      remarksLine,
      updatedLine,
      guidance,
    ].filter(Boolean);

    const message = messageParts.join("\n");

    sendMessage(residentData.contact_number, message);
  } catch (error) {
    console.log("request_actions error:", error);
  }
};

const complaint_actions = async (payload) => {
  try {
    const oldCategory = normalizeComplaintCategory(payload?.old?.category);
    const newCategory = normalizeComplaintCategory(payload?.new?.category);

    const categoryChanged = oldCategory !== newCategory;

    if (!categoryChanged) return;

    if (
      !isTrackedComplaintCategory(oldCategory) &&
      !isTrackedComplaintCategory(newCategory)
    ) {
      return;
    }

    const complainantUid =
      payload?.new?.complainant_id || payload?.old?.complainant_id;
    if (!complainantUid) return;

    const residentData = await getDataByUid(complainantUid);
    if (!residentData?.contact_number) {
      console.log(
        "No resident contact_number found for complainant:",
        complainantUid,
      );
      return;
    }

    const fullName = buildFullName(residentData);
    const complaintId = payload?.new?.id || payload?.old?.id || "N/A";
    const categoryLabel =
      complaintCategoryLabels[newCategory] ||
      toTitle(newCategory || oldCategory || "complaint");

    const messageParts = [
      `Hello ${fullName},`,
      newCategory === "personal complaint"
        ? `Regarding your complaint (#${complaintId}), it has been set as ${categoryLabel}.`
        : `Regarding your complaint (#${complaintId}), it has been categorized as ${categoryLabel}.`,
      newCategory === "personal complaint"
        ? `Please file this complaint directly at the barangay hall as it needs further assistance and present your complaint ID number (#${complaintId}) when you visit.`
        : "Please wait for further notice regarding the status.",
      "For questions, please contact the barangay office.",
    ].filter(Boolean);

    const message = messageParts.join("\n");

    sendMessage(residentData.contact_number, message);
  } catch (error) {
    console.log("complaint_actions error:", error);
  }
};

const mediation_actions = async (payload, eventType) => {
  try {
    const mediationRow = payload?.new || payload?.old;
    const mediationStatus = String(mediationRow?.status || "").toLowerCase();
    const complaintId = mediationRow?.complaint_id;

    if (!complaintId) {
      console.log("mediation_actions: missing complaint_id");
      return;
    }

    if (eventType === "INSERT") {
      if (mediationStatus !== "scheduled") return;
    } else if (eventType === "UPDATE") {
      if (
        mediationStatus !== "rescheduled" &&
        mediationStatus !== "unresolved" &&
        mediationStatus !== "resolved" &&
        mediationStatus !== "rejected"
      ) {
        return;
      }
    } else {
      return;
    }

    const { data: complaint, error: complaintError } = await supabase
      .from("complaint_tbl")
      .select("id, complainant_id, respondent_id")
      .eq("id", complaintId)
      .limit(1)
      .maybeSingle();

    if (complaintError) {
      console.log("mediation_actions complaint query error:", complaintError);
      return;
    }

    if (!complaint) {
      console.log(
        "mediation_actions: complaint not found for id:",
        complaintId,
      );
      return;
    }

    const complainantUid = complaint.complainant_id || null;
    const respondentUids = Array.isArray(complaint.respondent_id)
      ? complaint.respondent_id
      : [];

    const recipientUids = [complainantUid, ...respondentUids].filter(Boolean);

    if (recipientUids.length === 0) {
      console.log(
        "mediation_actions: no complainant/respondent recipients for complaint id:",
        complaintId,
      );
      return;
    }

    const uniqueUids = Array.from(new Set(recipientUids));

    const { data: residents, error: residentsError } = await supabase
      .from("residents_summary")
      .select("auth_uid, resident_fullname, contact_number")
      .in("auth_uid", uniqueUids);

    if (residentsError) {
      console.log("mediation_actions residents query error:", residentsError);
      return;
    }

    const residentMap = new Map();
    for (const resident of residents || []) {
      residentMap.set(String(resident?.auth_uid || ""), resident);
    }

    const startLine = formatDateTimeLong(mediationRow?.session_start)
      ? `Session Start: ${formatDateTimeLong(mediationRow?.session_start)}`
      : null;
    const endLine = formatDateTimeLong(mediationRow?.session_end)
      ? `Session End: ${formatDateTimeLong(mediationRow?.session_end)}`
      : null;

    let statusTitle = null;
    let detailLine = null;

    if (eventType === "INSERT" && mediationStatus === "scheduled") {
      statusTitle = "Mediation Scheduled";
      detailLine = "A mediation session has been scheduled for this complaint.";
    }

    if (eventType === "UPDATE" && mediationStatus === "rescheduled") {
      statusTitle = "Mediation Rescheduled";
      detailLine =
        "The mediation session schedule has been updated. Please review the new schedule below.";
    }

    if (eventType === "UPDATE" && mediationStatus === "unresolved") {
      statusTitle = "Mediation Unresolved";
      detailLine =
        "The mediation session is currently unresolved. Please wait for further announcement.";
    }

    if (eventType === "UPDATE" && mediationStatus === "resolved") {
      statusTitle = "Mediation Resolved";
      detailLine =
        "The mediation for this complaint has been marked as resolved.";
    }

    if (eventType === "UPDATE" && mediationStatus === "rejected") {
      statusTitle = "Mediation Rejected";
      detailLine =
        "The mediation update has been marked as rejected. Please go to the barangay office for more details.";
    }

    if (!statusTitle || !detailLine) return;

    for (const uid of recipientUids) {
      const resident = residentMap.get(String(uid));
      const contactNumber = String(resident?.contact_number || "").trim();

      if (!contactNumber) {
        console.log(
          "mediation_actions: skipped recipient with missing contact_number:",
          uid,
        );
        continue;
      }

      const fullName = resident?.resident_fullname || "Resident";

      const messageParts = [
        `Hi ${fullName},`,
        `${statusTitle}`,
        `Complaint ID: #${complaintId}`,
        detailLine,
      ];

      if (
        (eventType === "INSERT" && mediationStatus === "scheduled") ||
        (eventType === "UPDATE" && mediationStatus === "rescheduled")
      ) {
        messageParts.push(startLine, endLine);
      }

      const message = messageParts.filter(Boolean).join("\n");
      sendMessage(contactNumber, message);
    }
  } catch (error) {
    console.log("mediation_actions error:", error);
  }
};

const announcement_actions = async (payload) => {
  try {
    const announcement = payload?.new;
    if (!announcement) return;

    if (
      announcement.category !== "event" ||
      String(announcement.audience || "").toLowerCase() !== "residents" ||
      announcement.send_sms !== true
    ) {
      return;
    }

    console.log("Starting resident query!");

    let query = supabase
      .from("residents_summary")
      .select("resident_fullname, contact_number, email, occupation, age");

    if (announcement.purok && announcement.purok.length > 0) {
      query = query.in("purok_name", announcement.purok);
    }

    if (announcement.sex) {
      query = query.eq("sex", announcement.sex);
    }

    const civilStatusFilters = toArray(announcement.civil_status);
    const normalizedCivilStatusFilters = toLowerArray(
      announcement.civil_status,
    );

    const religionFilters = toArray(announcement.religion);
    if (religionFilters.length > 0) {
      query = query.in("religion", religionFilters);
    }

    // Skip occupation filter in query if special types present
    // We'll handle it after fetching data
    const occupationFilters = toArray(announcement.occupation);
    const normalizedOccupations = occupationFilters
      .map((occ) => String(occ).toLowerCase().trim())
      .filter(Boolean);

    const hasSpecialOccupation =
      normalizedOccupations.includes("unemployed") ||
      normalizedOccupations.includes("employed") ||
      normalizedOccupations.includes("retired");

    if (occupationFilters.length > 0 && !hasSpecialOccupation) {
      query = query.in("occupation", occupationFilters);
    }

    const voterStatusFilters = toLowerArray(announcement.voter_status);
    if (voterStatusFilters.length > 0) {
      const hasRegistered = voterStatusFilters.includes("registered");
      const hasNotRegistered =
        voterStatusFilters.includes("not-registered") ||
        voterStatusFilters.includes("not_registered") ||
        voterStatusFilters.includes("not registered");

      if (hasRegistered && !hasNotRegistered) {
        query = query.eq("voter_status", true);
      } else if (!hasRegistered && hasNotRegistered) {
        query = query.eq("voter_status", false);
      }
    }

    if (announcement.min_age != null) {
      query = query.gte("age", announcement.min_age);
    }

    if (announcement.max_age != null) {
      query = query.lte("age", announcement.max_age);
    }

    if (
      announcement.minimum_year_of_stay != null ||
      announcement.maximum_year_of_stay != null
    ) {
      console.log(
        "announcement_actions: year-of-stay filter was skipped because residents_summary has no years_of_stay column",
      );
    }

    const { data, error } = await query;

    if (error) {
      console.log("announcement_actions query error:", error);
      return;
    }

    const hasCivilStatusFilters = civilStatusFilters.length > 0;
    const includesSingleCivilStatus =
      normalizedCivilStatusFilters.includes("single");

    // Apply occupation-based filtering for special types
    let filteredData = (data || []).filter((resident) => {
      if (!hasCivilStatusFilters) return true;

      const residentCivilStatus = String(resident?.civil_status || "")
        .trim()
        .toLowerCase();

      if (!residentCivilStatus) {
        return includesSingleCivilStatus;
      }

      return normalizedCivilStatusFilters.includes(residentCivilStatus);
    });

    const hasUnemployed = normalizedOccupations.includes("unemployed");
    const hasEmployed = normalizedOccupations.includes("employed");
    const hasRetired = normalizedOccupations.includes("retired");

    if (hasUnemployed || hasEmployed || hasRetired) {
      filteredData = filteredData.filter((resident) => {
        const occupationLower = String(
          resident?.occupation || "",
        ).toLowerCase();
        const age = resident?.age || 0;
        let matches = false;

        if (hasUnemployed) {
          // Unemployed: occupation IS NULL OR occupation = 'student'
          matches =
            matches || !resident?.occupation || occupationLower === "student";
        }

        if (hasEmployed) {
          // Employed: occupation IS NOT NULL AND occupation != 'student' AND age < 65
          matches =
            matches ||
            (resident?.occupation && occupationLower !== "student" && age < 65);
        }

        if (hasRetired) {
          // Retired: occupation = 'retired' AND age <= 65
          matches = matches || (occupationLower === "retired" && age <= 65);
        }

        return matches;
      });
    }

    const recipientMap = new Map();

    for (const resident of filteredData || []) {
      const contactNumber = String(resident?.contact_number || "").trim();
      if (!contactNumber) continue;
      if (!recipientMap.has(contactNumber)) {
        recipientMap.set(contactNumber, {
          contactNumber,
          fullName: resident?.resident_fullname || "Resident",
        });
      }
    }

    const recipients = Array.from(recipientMap.values());

    if (recipients.length === 0) {
      console.log("announcement_actions: no valid recipients found");
      return;
    }

    const eventStartLine = announcement.event_start
      ? `Start: ${new Date(announcement.event_start).toLocaleString("en-PH")}`
      : null;
    const eventEndLine = announcement.event_end
      ? `End: ${new Date(announcement.event_end).toLocaleString("en-PH")}`
      : null;

    for (const recipient of recipients) {
      const message = [
        `Hi ${recipient.fullName},`,
        "Barangay Announcement",
        "You are qualified to join this event.",
        `Title: ${announcement.title || "N/A"}`,
        `Content: ${announcement.content || "N/A"}`,
        "For more information about the event, please click the link below.",
        "URL HERE",
        eventStartLine,
        eventEndLine,
      ]
        .filter(Boolean)
        .join("\n");

      sendMessage(recipient.contactNumber, message);
    }

    console.log(
      `announcement_actions: sent to ${recipients.length} recipient(s)`,
    );
  } catch (error) {
    console.log("announcement_actions error:", error);
  }
};

const settlement_actions = async (payload, eventType) => {
  try {
    const settlementRow = payload?.new || payload?.old;
    const partiesUids = Array.isArray(settlementRow?.parties_uid)
      ? settlementRow.parties_uid
      : [];
    const complaintId = settlementRow?.complaint_id;

    if (partiesUids.length === 0) {
      console.log("settlement_actions: no parties_uid found");
      return;
    }

    if (!complaintId) {
      console.log("settlement_actions: missing complaint_id");
      return;
    }

    const { data: complaint, error: complaintError } = await supabase
      .from("complaint_tbl")
      .select("id, complaint_type")
      .eq("id", complaintId)
      .limit(1)
      .maybeSingle();

    if (complaintError) {
      console.log("settlement_actions complaint query error:", complaintError);
      return;
    }

    if (!complaint) {
      console.log(
        "settlement_actions: complaint not found for id:",
        complaintId,
      );
      return;
    }

    const { data: residents, error: residentsError } = await supabase
      .from("residents_summary")
      .select("auth_uid, resident_fullname, contact_number")
      .in("auth_uid", partiesUids);

    if (residentsError) {
      console.log("settlement_actions residents query error:", residentsError);
      return;
    }

    const residentMap = new Map();
    for (const resident of residents || []) {
      residentMap.set(String(resident?.auth_uid || ""), resident);
    }

    const settlementType = toTitle(settlementRow?.type || "N/A");
    const settlementStatus = String(settlementRow?.status || "").toLowerCase();
    const complaintType = toTitle(complaint?.complaint_type || "N/A");
    const startLine = formatDateTimeLong(settlementRow?.session_start)
      ? `Session Start: ${formatDateTimeLong(settlementRow?.session_start)}`
      : null;
    const endLine = formatDateTimeLong(settlementRow?.session_end)
      ? `Session End: ${formatDateTimeLong(settlementRow?.session_end)}`
      : null;

    for (const uid of partiesUids) {
      const resident = residentMap.get(String(uid));
      const contactNumber = String(resident?.contact_number || "").trim();

      if (!contactNumber) {
        console.log(
          "settlement_actions: skipped party with missing contact_number:",
          uid,
        );
        continue;
      }

      const fullName = resident?.resident_fullname || "Resident";
      let messageParts = [];

      if (settlementStatus === "scheduled") {
        messageParts = [
          `Hi ${fullName},`,
          `A ${settlementType} session has been scheduled for your complaint (#${complaintId}).`,
          `Complaint Type: ${complaintType}`,
          startLine,
          endLine,
          "Please make sure to attend the session. Check your BarangayEase account for more details.",
        ];
      } else if (settlementStatus === "rescheduled") {
        messageParts = [
          `Hi ${fullName},`,
          `Your ${settlementType} session for complaint #${complaintId} has been rescheduled.`,
          `Complaint Type: ${complaintType}`,
          `New Schedule:`,
          startLine,
          endLine,
          "Please take note of the new schedule. Check your BarangayEase account for more details.",
        ];
      } else if (settlementStatus === "resolved") {
        messageParts = [
          `Hi ${fullName},`,
          `Good news! Your ${settlementType} session for complaint #${complaintId} has been resolved.`,
          `Complaint Type: ${complaintType}`,
          "Thank you for your cooperation. You may check your BarangayEase account for the resolution details.",
        ];
      } else if (settlementStatus === "unresolved") {
        messageParts = [
          `Hi ${fullName},`,
          `Your ${settlementType} session for complaint #${complaintId} is currently unresolved.`,
          `Complaint Type: ${complaintType}`,
          "Please wait for further updates from the barangay office. Check your BarangayEase account for more information.",
        ];
      } else if (settlementStatus === "rejected") {
        messageParts = [
          `Hi ${fullName},`,
          `Your ${settlementType} session for complaint #${complaintId} has been rejected.`,
          `Complaint Type: ${complaintType}`,
          "Please visit the barangay office for more details and next steps.",
        ];
      } else {
        messageParts = [
          `Hi ${fullName},`,
          `There's an update on your ${settlementType} session for complaint #${complaintId}.`,
          `Complaint Type: ${complaintType}`,
          `Status: ${toTitle(settlementStatus)}`,
          "Please check your BarangayEase account for more details.",
        ];
      }

      const message = messageParts.filter(Boolean).join("\n");
      sendMessage(contactNumber, message);
    }
  } catch (error) {
    console.log("settlement_actions error:", error);
  }
};

module.exports = {
  request_actions,
  complaint_actions,
  announcement_actions,
  mediation_actions,
  settlement_actions,
};
