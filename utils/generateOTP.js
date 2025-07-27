// utils/generateOTP.js
const OTP = require("../models/otp");
const bcrypt = require("bcryptjs"); // ✨ THE ONLY CHANGE IS HERE! We are now using the correct tool!

// Config
const OTP_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const COOLDOWN_BASE = 1 * 60 * 1000; // 1 minute

function generateRandomOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

async function generateAndStoreOTP(email, type) {
    try {
        // 🗑 Clean up old expired OTPs
        await OTP.deleteMany({
            email,
            type,
            expiresAt: { $lt: new Date() }
        });

        // 🧾 Fetch all recent OTPs
        const previousOTPs = await OTP.find({ email, type });

        const now = Date.now();

        // ⏳ Cooldown logic starts after 2 tries
        if (previousOTPs.length >= 2) {
            const lastAttempt = previousOTPs[previousOTPs.length - 1];
            const retryNumber = previousOTPs.length - 1; // After 2
            const cooldownTime = COOLDOWN_BASE * retryNumber; // 1 min, 2 min, ...

            const nextAllowedTime = new Date(lastAttempt.createdAt).getTime() + cooldownTime;

            if (now < nextAllowedTime) {
                const waitSecs = Math.ceil((nextAllowedTime - now) / 1000);
                return {
                    success: false,
                    message: `Please wait ${waitSecs} seconds before trying again.`
                };
            }
        }

        // ✅ Generate OTP & hash
        const otp = generateRandomOTP();
        const hashedOTP = await bcrypt.hash(otp, 10);

        const expiresAt = new Date(now + OTP_EXPIRY_MS);

        // 💾 Store OTP
        await OTP.create({
            email,
            otp: hashedOTP,
            type,
            createdAt: new Date(now),
            expiresAt
        });

        return {
            success: true,
            otp, // 🔐 Plain OTP to send via email
        };

    } catch (err) {
        console.error("OTP Generation Error:", err);
        return {
            success: false,
            message: "Error generating OTP. Try again later."
        };
    }
}

module.exports = {
    generateAndStoreOTP
};
