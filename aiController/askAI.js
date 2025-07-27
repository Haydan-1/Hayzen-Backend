// ✅ For chat history saving
const chatHistories = require("../models/chatHistory");

// ✅ This function sends prompt to AI and saves reply
async function askAI(prompt, engine = "openrouter", imageBase64 = null) {
  try {
    const response = await fetch("http://localhost:3000/askAI", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        engine,
        imageBase64, // null if not using image
      }),
    });

    const data = await response.json();

    // 🔁 Validate backend structure
    if (!response.ok || !data.success) {
      console.warn("❌ Backend response error:", data);
      return `❌ Error: ${data.message || "Something went wrong."}`;
    }

    // 💬 Text response + save history
    if (data.reply) {
      const reply = data.reply; // ✅ FIX: define before use
      return reply;
    }

    return "⚠️ No reply from AI.";

  } catch (error) {
    console.error("❌ askAI() fetch error:", error);
    return "❌ Network error or server offline.";
  }
}

module.exports = askAI;
