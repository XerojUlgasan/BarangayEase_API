const { getDataByUid, buildFullName, toTitle } = require("./utils");
const { sendMessage } = require("../telerivet/sms_controller");

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

const announcement_actions = (payload) => {};

module.exports = { request_actions, complaint_actions, announcement_actions };
