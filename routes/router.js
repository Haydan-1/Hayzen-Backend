// 📁 Backend/routes/router.js

// ✅ Imports
const jwt = require("jsonwebtoken");
const { callOpenRouterAI } = require("../clients/openrouterClient");
const {
    handleSignup,
    handleLogin,
    handleForgotPassword,
    handleResetPassword,
    handleVerifyOTP,
    handleResendOTP,
    handleChangePassword,
    handleToggle2FA // ✨ CORRECTED: Ensure handleToggle2FA is imported
} = require("../otp-Controller/otp-Controller");
const bodyParser = require("../utils/bodyParser");
const ChatHistory = require("../models/chatHistory");
const User = require("../models/User"); // Import User model to fetch user status

// ✨ NEW - Our Security Guard Middleware ✨
// This function checks the JWT and adds the user's info to the request.
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format is "Bearer TOKEN"

    if (token == null) {
        res.writeHead(401); // Unauthorized
        return res.end(JSON.stringify({ success: false, message: "Error: No token provided." }));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            res.writeHead(403); // Forbidden
            return res.end(JSON.stringify({ success: false, message: "Error: Token is not valid." }));
        }
        req.user = user; // Attach user payload (e.g., { userId: '...', email: '...' }) to the request
        next(); // Proceed to the actual route logic
    });
}


// ✅ Central Router
async function router(req, res) {
    const { method, url } = req;

    // --- CORS Headers ---
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }
    
    res.setHeader("Content-Type", "application/json");

    // --- Public Routes (No token needed) ---
    if (url === "/signup" && method === "POST") return handleSignup(req, res, bodyParser);
    if (url === "/login" && method === "POST") return handleLogin(req, res, bodyParser);
    if (url === "/forgot" && method === "POST") return handleForgotPassword(req, res, bodyParser);
    if (url === "/reset" && method === "POST") return handleResetPassword(req, res, bodyParser);
    if (url === "/verify-otp" && method === "POST") return handleVerifyOTP(req, res, bodyParser);
    if (url === "/resend-otp" && method === "POST") return handleResendOTP(req, res, bodyParser);


    // --- Protected Routes (Token IS required) ---
    // We wrap the logic for protected routes inside our authenticateToken function.
    
    // UPDATED - Secure /askAI Route
    if (url === "/askAI" && method === "POST") {
        return authenticateToken(req, res, async () => {
            try {
                const body = await bodyParser(req);
                const { prompt, engine, option } = body;
                if (!prompt) return res.end(JSON.stringify({ success: false, message: "Prompt is required." }));
                
                const reply = await callOpenRouterAI(prompt, option);
                if (!reply || typeof reply !== "string") {
                    return res.end(JSON.stringify({ success: false, message: "AI did not return a valid response." }));
                }

                // Now we save the chat with the user's ID from the token!
                await ChatHistory.create({
                    userId: req.user.userId,
                    prompt,
                    reply,
                    engine: engine || "openrouter"
                });

                return res.end(JSON.stringify({ success: true, reply: reply }));
            } catch (err) {
                console.error("❌ Error in /askAI:", err);
                return res.end(JSON.stringify({ success: false, message: "Internal server error." }));
            }
        });
    }

    // NEW - Secure /get-history Route
    if (url === "/get-history" && method === "GET") {
        return authenticateToken(req, res, async () => {
            try {
                const history = await ChatHistory.find({ userId: req.user.userId }).sort({ createdAt: -1 });
                return res.end(JSON.stringify({ success: true, history }));
            } catch (err) {
                console.error("❌ Error fetching chat history:", err);
                return res.end(JSON.stringify({ success: false, message: "Failed to fetch chat history." }));
            }
        });
    }

    // NEW: Secure /change-password Route
    if (url === "/change-password" && method === "POST") {
        return authenticateToken(req, res, async () => {
            await handleChangePassword(req, res, bodyParser);
        });
    }

    // NEW: Secure /toggle-2fa Route
    if (url === "/toggle-2fa" && method === "POST") {
        return authenticateToken(req, res, async () => {
            await handleToggle2FA(req, res, bodyParser);
        });
    }

    // NEW: Secure /get-user-status Route
    if (url === "/get-user-status" && method === "GET") {
        return authenticateToken(req, res, async () => {
            try {
                const user = await User.findById(req.user.userId).select('is2FAEnabled email');
                if (!user) {
                    res.writeHead(404);
                    return res.end(JSON.stringify({ success: false, message: "User not found." }));
                }
                return res.end(JSON.stringify({ success: true, userStatus: { is2FAEnabled: user.is2FAEnabled, email: user.email } }));
            } catch (err) {
                console.error("❌ Error fetching user status:", err);
                res.writeHead(500);
                return res.end(JSON.stringify({ success: false, message: "Failed to fetch user status." }));
            }
        });
    }


    // --- Not Found ---
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: "Route not found" }));
}

module.exports = router;