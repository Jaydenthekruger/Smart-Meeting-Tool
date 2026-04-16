// aiService.js (NO API - works offline / free)

// Generate simple summary + action items from transcript
export async function generateSummary(transcript) {
  if (!transcript) return { summary: "", actions: "" };

  // Split sentences
  const sentences = transcript.split(".").filter(s => s.trim() !== "");

  // Summary = first 3 sentences
  const summary = sentences
    .slice(0, 3)
    .map(s => "• " + s.trim())
    .join("\n");

  // Action items = sentences with keywords
  const actions = sentences
    .filter(s =>
      s.toLowerCase().includes("will") ||
      s.toLowerCase().includes("should") ||
      s.toLowerCase().includes("need") ||
      s.toLowerCase().includes("must")
    )
    .map(s => "☑ " + s.trim())
    .join("\n");

  return {
    summary: summary || "No summary available.",
    actions: actions || "No action items detected.",
  };
}

// Generate assistive response (FREE logic)
export async function generateAssistiveResponse(transcript) {
  if (!transcript) return { explanation: "", reply: "" };

  const sentences = transcript.split(".").filter(s => s.trim() !== "");

  const explanation = sentences
    .slice(0, 2)
    .map(s => "• " + s.trim())
    .join("\n");

  const reply = "Suggested reply:\n" +
    sentences
      .slice(0, 1)
      .map(s => "• Okay, " + s.trim().toLowerCase())
      .join("\n");

  return {
    explanation: explanation || "No explanation.",
    reply: reply || "No reply suggestion.",
  };
}