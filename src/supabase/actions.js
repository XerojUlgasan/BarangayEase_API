const { getDataByUid, buildFullName, toTitle } = require("./utils");
const { sendMessage } = require("../telerivet/sms_controller");
const { household_supabase, supabase } = require("./client");

const statusGuidance = {
  pending: "Please wait for the next update.",
  approved: "You may coordinate with the barangay office for release steps.",
  rejected: "Please check remarks and contact the barangay office if needed.",
  completed: "Your request is completed and ready for release/claim.",
  cancelled: "This request has been cancelled.",
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
    const oldStatus = payload?.old?.status || null;
    const newStatus = payload?.new?.status || null;
    const oldRemarks = payload?.old?.remarks || null;
    const newRemarks = payload?.new?.remarks || null;

    const statusChanged = Boolean(
      oldStatus && newStatus && oldStatus !== newStatus,
    );
    const remarksChanged = oldRemarks !== newRemarks;

    if (!statusChanged && !remarksChanged) return;

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
    const complaintType =
      payload?.new?.complaint_type ||
      payload?.old?.complaint_type ||
      "complaint";
    const priorityLevel =
      payload?.new?.priority_level || payload?.old?.priority_level || "pending";
    const incidentLocation =
      payload?.new?.incident_location ||
      payload?.old?.incident_location ||
      "N/A";
    const incidentDate =
      payload?.new?.incident_date || payload?.old?.incident_date || null;
    const updatedAt =
      payload?.new?.updated_at || payload?.new?.created_at || null;

    const incidentDateLine = incidentDate
      ? `Incident Date: ${new Date(incidentDate).toLocaleString("en-PH")}`
      : null;
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
      `Hi ${fullName}, update on your barangay complaint (#${complaintId}):`,
      `Type: ${toTitle(complaintType)}`,
      `Priority: ${toTitle(priorityLevel)}`,
      statusLine,
      incidentDateLine,
      `Location: ${incidentLocation}`,
      remarksLine,
      updatedLine,
      guidance,
    ].filter(Boolean);

    const message = messageParts.join("\n");

    sendMessage(residentData.contact_number, message);
  } catch (error) {
    console.log("complaint_actions error:", error);
  }
};

const announcement_actions = async (payload) => {
  try {
    const announcement = payload?.new;
    if (!announcement) return;

    if (
      announcement.category !== "event" ||
      announcement.audience !== "residents" ||
      announcement.send_sms === false
    ) {
      return;
    }

    console.log("Starting resident query!");

    let query = supabase
      .from("vw_residents_summary")
      .select("resident_fullname, contact_number, email");

    if (announcement.purok && announcement.purok.length > 0) {
      query = query.in("purok_name", announcement.purok);
    }

    if (announcement.sex) {
      query = query.eq("sex", announcement.sex);
    }

    if (announcement.civil_status && announcement.civil_status.length > 0) {
      query = query.in("civil_status", announcement.civil_status);
    }

    if (announcement.religion && announcement.religion.length > 0) {
      query = query.in("religion", announcement.religion);
    }

    if (announcement.occupation) {
      if (announcement.occupation === "Unemployed") {
        query = query.or(
          `occupation.eq.${announcement.occupation},occupation.is.null`,
        );
      } else if (announcement.occupation === "Retired") {
        query = query.eq("occupation", announcement.occupation);
      } else if (announcement.occupation === "Employed") {
        query = query.not("occupation", "in", ["Retired", "Unemployed"]);
      }
    }

    if (announcement.voter_status && announcement.voter_status.length > 0) {
      if (announcement.voter_status == "not-registered") {
        query = query.eq("voter_status", false);
      } else {
        query = query.eq("voter_status", true);
      }
    }

    if (announcement.min_age && announcement.max_age) {
      query = query.gte("age", announcement.min_age);
      query = query.lte("age", announcement.max_age);
    }

    if (announcement.minimum_year_of_stay != null) {
      const min = announcement.minimum_year_of_stay || 0;
      query = query.gte("years_of_stay", min);
    }

    if (announcement.maximum_year_of_stay != null) {
      const max = announcement.maximum_year_of_stay || 0;
      query = query.lte("years_of_stay", max);
    }

    const { data, error } = await query;

    if (error) {
      console.log("announcement_actions query error:", error);
      return;
    }

    const recipientMap = new Map();

    for (const resident of data || []) {
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

module.exports = { request_actions, complaint_actions, announcement_actions };
