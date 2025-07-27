// clients/openrouterClient.js

require("dotenv").config();

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ✅ Use one of the OpenRouter-supported models
const DEFAULT_MODEL = "mistralai/mistral-7b-instruct"; // or "openai/gpt-4o" if your key supports it

async function callOpenRouterAI(prompt) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",     // Optional: your frontend domain
        "X-Title": "Hayzen-AI-Dashboard"             // Optional: your app's name
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.7, // ✅ Required by OpenRouter
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const raw = await response.text();
    console.log("📡 Status:", response.status);
    console.log("📄 Raw response:", raw);

    if (!response.ok) {
      throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText}`);
    }

    const data = JSON.parse(raw);
    return data?.choices?.[0]?.message?.content || "No response content.";
  } catch (err) {
    console.error("❌ OpenRouter Fatal Error:", err);
    return "❌ Failed to reach OpenRouter AI. Please try again later.";
  }
}

module.exports = { callOpenRouterAI };
