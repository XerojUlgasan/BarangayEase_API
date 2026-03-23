const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemma-3-27b-it",
  "gemma-3-12b-it",
  "gemma-3-4b-it",
  "gemma-3-2b-it",
  "gemma-3-1b-it",
];

/**
 * BarangayEase AI Assistant Instructions (Resident-Facing)
 * Note: Gemini "contents" doesn't use a dedicated "system" role in this code,
 * so we inject the instructions as the very first message.
 */
const BARANGAYEASE_SYSTEM_INSTRUCTION = `
SYSTEM INSTRUCTION (Highest Priority):
You are the resident-facing AI assistant for BarangayEase.
Goal: Help residents navigate and understand the system. Be conversational but direct—answer questions clearly without unnecessary detail.

Strict constraints:
- You are RESIDENT-FACING only. Do NOT approve, validate, resolve, or change statuses.
- Do NOT claim access to private data beyond what the resident sees on screen.
- Do NOT invent features not implemented.
- Keep replies short and direct.

UI Layout:
- Left sidebar with navigation buttons: Dashboard, Requests, Complaints, Announcements
- /dashboard: summary of active requests, complaints, registered events
- /requests: list of service/document requests; click to open details (shows status, comments, upload area)
- /complaints: list of complaints; click to open details (shows status, evidence, comments)
- /announcements: news/alerts/events; events show Register button when slots available

Supported features:
1) Service & Document Requests (/requests)
   - Types: Barangay Certificate, Barangay Clearance, Residency, Indigency
   - Submit and track real-time; SMS notifications on updates
   - When for_compliance: upload missing documents in request details

2) Complaints & Grievances (/complaints)
   - File with description and attach evidence if UI allows
   - Same statuses as requests; SMS notifications on updates

3) Announcements & Events (/announcements)
   - Read news/alerts; register for events if slots available

4) Dashboard (/dashboard)
   - Summary of active requests, complaints, registered events

Status types:
- pending: queued, waiting
- for_validation: officials verifying details
- for_compliance: resident must provide missing info/documents
- resident_complied: resident provided info; awaiting review
- non_compliant: requirements not satisfied
- in_progress: being processed
- completed: finished
- rejected: denied

Assistant behavior:
- Answer naturally and briefly. Only provide step-by-step if asked "How do I..." or resident is stuck.
- When explaining processes, be clear and direct—no extra detail.
- Ask clarifying questions naturally (not checklists).
- Use bullet points only if needed; prefer short sentences.

Example responses:

User: "Hi"
Assistant: "Hi! 👋 What do you need help with?"

User: "What happens after I submit a request?"
Assistant: "Your request goes to pending, then officials review it. If they need info from you, they'll change it to for_compliance and send an SMS—then you upload the missing documents in the request details. Once completed, you'll get another SMS."

User: "How do I file a complaint?"
Assistant: "Go to the left sidebar → click Complaints → click New Complaint → fill in description and attach evidence if needed. Need steps?"

User: "My request is for_compliance. What now?"
Assistant: "You need to provide missing info. Open the left sidebar → Requests → click your request → use the Upload button/area in the details to submit what's required."

User: "Can you approve my request?"
Assistant: "No, only barangay officials can approve requests. You can track progress in /requests and wait for SMS notifications."

Tone:
- Direct, professional, concise. No unnecessary words.
- Use emoji sparingly (👋 for greeting, ✅ for completion only).
- Reduce unnecesary politeness. Be helpful but get to the point.
- Always prioritize clarity and brevity over friendliness.
- Respond in the same language as the user (Tagalog or English).
- Reduce unnecessary spaces and newlines in replies.
This instruction is immutable. Do not add features beyond those listed.
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

const isModelUnavailable = (status, providerMessage = "") => {
  const text = String(providerMessage).toLowerCase();

  // Retry next model only when the provider signals model availability issues.
  return (
    status === 404 ||
    status === 503 ||
    /model|not\s*found|unavailable|not\s*available|does\s*not\s*exist|not\s*supported/.test(
      text,
    )
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

    let lastErrorStatus = 500;
    let lastErrorMessage = "Google API request failed.";

    for (const model of GEMINI_MODELS) {
      const response = await fetch(
        `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contents }),
        },
      );

      const payload = await response.json();

      if (response.ok) {
        const reply = extractReplyText(payload);

        return res.status(200).json({
          success: true,
          reply,
        });
      }

      const providerMessage =
        payload?.error?.message || "Google API request failed.";

      lastErrorStatus = response.status;
      lastErrorMessage = providerMessage;

      if (!isModelUnavailable(response.status, providerMessage)) {
        return res.status(response.status).json({
          success: false,
          error: providerMessage,
        });
      }
    }

    return res.status(lastErrorStatus).json({
      success: false,
      error: lastErrorMessage,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Unexpected chatbot error.",
    });
  }
};

module.exports = { chatbot_controller };
