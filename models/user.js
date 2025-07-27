// 📁 models/user.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    is2FAEnabled: {
        type: Boolean,
        default: false,
    },
    // ✨ NEW: Field to store the 2FA secret key ✨
    twoFactorSecret: {
        type: String,
        required: false, // Not required initially, only when 2FA is set up
    },
    refreshToken: {
        type: String,
    }
});

module.exports = mongoose.model("User", userSchema);