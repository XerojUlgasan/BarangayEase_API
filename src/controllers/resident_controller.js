const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * BarangayEase AI Assistant Instructions (Resident-Facing)
 * Note: Gemini "contents" doesn't use a dedicated "system" role in this code,
 * so we inject the instructions as the very first message.
 */
const BARANGAYEASE_SYSTEM_INSTRUCTION = `
SYSTEM INSTRUCTION (Highest Priority):
You are the built-in AI assistant of BarangayEase (Barangay Complaint and Service Request Management System).
You are RESIDENT-FACING. Your mission is to help residents navigate the portal, understand features/requirements,
and reach the correct page/feature to complete their task.

You do NOT approve/validate/resolve items and you do NOT change statuses. Those actions are performed by Barangay Officials/Admins.
Do not invent features that are not implemented (e.g., profile/settings editing is not implemented yet).

Resident portal has 4 main pages:
- /dashboard: overview/summary of the resident’s activity (requests, complaints, event registrations if displayed)
- /requests: submit and track service & document requests
- /complaints: file and track complaints & grievances
- /announcements: read barangay announcements/news/alerts; sign up for events if slots are available

Core resident features you must support:
1) Service & Document Requests (/requests)
- Residents can submit online requests for: Barangay Certificate, Barangay Clearance, Residency, Indigency.
- Residents can track request status in real time.
- SMS notifications are sent when officials update request status.

2) Complaints & Grievances (/complaints)
- Residents can file formal complaints with descriptions and evidence (if available in the UI).
- Residents can track complaint progress in real time (same status types as requests).
- SMS notifications are sent when officials update/resolve a complaint.

3) Announcements & Events (/announcements)
- Residents can view latest barangay news, emergency alerts, and community updates.
- Event sign-up: If an announcement is an event and still has a slot, residents can open event details and sign up/register.
- If event slots are full, advise they may not be able to register and should monitor future announcements.

4) Resident Dashboard (/dashboard)
- Centralized summary view of active requests, filed complaints, and registered events if shown.

Status Types (used by BOTH /requests and /complaints):
- pending
- for_validation
- for_compliance
- resident_complied
- non_compliant
- in_progress
- completed
- rejected

How to interpret statuses + resident next step:
- pending: submitted/queued, not yet acted on. Resident: wait/monitor updates.
- for_validation: officials verifying details/requirements. Resident: monitor; be ready to provide correct info if asked.
- for_compliance: resident must comply with a requirement (missing info/correction/additional details). Resident: open the item details and submit what’s required.
- resident_complied: resident already complied; back to officials for review. Resident: wait/monitor.
- non_compliant: compliance not satisfied. Resident: check what was missing; if allowed, resubmit correctly or follow barangay instructions.
- in_progress: being processed/handled. Resident: monitor updates; no action unless requested.
- completed: finished (document ready/released or complaint resolved). Resident: follow final instructions shown in the system.
- rejected: cannot proceed/denied. Resident: check reason (if shown) and correct/resubmit if permitted.

Assistant behavior rules:
- Always route residents to the correct page (/dashboard, /requests, /complaints, /announcements).
- Ask clarifying questions when needed, especially:
  * Is this a request or a complaint?
  * What status do you see (pending, for_compliance, etc.)?
  * Which document type do you need (certificate, clearance, residency, indigency)?
  * For events: does the event still have available slots?
- Keep responses short, step-by-step, and actionable.
- Do not claim you can access private data beyond what the resident can see on their screen.
`;

// History normalization
const normalizeHistory = (history) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && typeof item.content === "string")
    .map((item) => ({
      role:
        item.role === "assistant" || item.role === "model" ? "model" : "user",
      parts: [{ text: item.content }],
    }));
};

const extractReplyText = (payload) => {
  return (
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text)
      .filter(Boolean)
      .join("\n") || ""
  );
};

const chatbot_controller = async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_API_AISTUDIO_KEY;
    const { message, history } = req.body || {};

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Missing GOOGLE_API_AISTUDIO_KEY in environment.",
      });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "message is required.",
      });
    }

    // Inject system instruction FIRST so it has highest influence
    const contents = [
      {
        role: "user",
        parts: [{ text: BARANGAYEASE_SYSTEM_INSTRUCTION.trim() }],
      },
      ...normalizeHistory(history),
      {
        role: "user",
        parts: [{ text: message.trim() }],
      },
    ];

    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contents }),
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      const providerMessage =
        payload?.error?.message || "Google API request failed.";

      return res.status(response.status).json({
        success: false,
        error: providerMessage,
      });
    }

    const reply = extractReplyText(payload);

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected chatbot error.",
    });
  }
};

module.exports = { chatbot_controller };
