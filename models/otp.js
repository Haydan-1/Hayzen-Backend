// 📁 models/OTP.js
const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    type: {
        type: String,
        // ✨ FIX: Added 'enable2fa' and 'disable2fa' to the enum list
        enum: ["signup", "login", "forgot", "reset", "enable2fa", "disable2fa"],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

// Auto-delete expired OTPs using TTL index
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.OTP || mongoose.model("OTP", OTPSchema);