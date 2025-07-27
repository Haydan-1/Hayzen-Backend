// 📁 otp-Controller/otp-Controller.js (Corrected for Brevo/Email OTP 2FA)
const { sendOTPEmail } = require("../utils/sendEmail");
const { generateAndStoreOTP } = require("../utils/generateOTP");
const User = require("../models/User");
const OTP = require("../models/otp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// Removed speakeasy and qrcode imports as we are using email OTP for 2FA toggle

async function handleSignup(req, res, bodyParser) {
    const { fullName, email, password } = await bodyParser(req);
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.end(JSON.stringify({ success: false, message: "Email already exists." }));
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ name: fullName, email, password: hashedPassword });
        const result = await generateAndStoreOTP(email, "signup");
        if (!result.success) return res.end(JSON.stringify({ success: false, message: result.message }));
        await sendOTPEmail(email, result.otp);
        return res.end(JSON.stringify({ success: true, message: "Signup successful. OTP sent!" }));
    } catch (err) {
        console.error("Signup Error:", err);
        return res.end(JSON.stringify({ success: false, message: "Server error during signup." }));
    }
}

async function handleLogin(req, res, bodyParser) {
    const { email, password } = await bodyParser(req);
    try {
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.end(JSON.stringify({ success: false, message: "Invalid credentials." }));
        }

        // If 2FA is enabled, prompt for OTP (sent via email during login)
        if (user.is2FAEnabled) {
            const result = await generateAndStoreOTP(email, "login"); // Generate OTP for login
            if (!result.success) return res.end(JSON.stringify({ success: false, message: result.message }));
            await sendOTPEmail(email, result.otp); // Send OTP via Brevo
            return res.end(JSON.stringify({ success: true, requires2FA: true, message: "Password correct. Please enter OTP." }));
        } else {
            // No 2FA, directly log in
            const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
            return res.end(JSON.stringify({ success: true, requires2FA: false, token: token, message: "Login Successful!" }));
        }
    } catch (err) {
        console.error("Login Error:", err);
        return res.end(JSON.stringify({ success: false, message: "Server error during login." }));
    }
}

async function handleResendOTP(req, res, bodyParser) {
    const { email, type } = await bodyParser(req);
    try {
        const user = await User.findOne({ email });
        if (!user) return res.end(JSON.stringify({ success: false, message: "Email not registered." }));
        const result = await generateAndStoreOTP(email, type);
        if (!result.success) return res.end(JSON.stringify({ success: false, message: result.message }));
        await sendOTPEmail(email, result.otp);
        return res.end(JSON.stringify({ success: true, message: "A new OTP has been sent." }));
    } catch (err) {
        console.error("Resend OTP Error:", err);
        return res.end(JSON.stringify({ success: false, message: "Server error during resend." }));
    }
}

async function handleForgotPassword(req, res, bodyParser) {
    const { email } = await bodyParser(req);
    try {
        const user = await User.findOne({ email });
        if (!user) return res.end(JSON.stringify({ success: false, message: "Email not registered." }));
        const result = await generateAndStoreOTP(email, "forgot");
        if (!result.success) return res.end(JSON.stringify({ success: false, message: result.message }));
        await sendOTPEmail(email, result.otp);
        return res.end(JSON.stringify({ success: true, message: "OTP sent to email for password reset." }));
    } catch (err) {
        console.error("Forgot Password Error:", err);
        return res.end(JSON.stringify({ success: false, message: "Server error during forgot password." }));
    }
}

async function handleResetPassword(req, res, bodyParser) {
    const { email, newPassword } = await bodyParser(req);
    try {
        const user = await User.findOne({ email });
        if (!user) return res.end(JSON.stringify({ success: false, message: "User not found." }));
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ email }, { $set: { password: hashedPassword } });
        return res.end(JSON.stringify({ success: true, message: "Password reset successful." }));
    } catch (err) {
        console.error("Reset Password Error:", err);
        return res.end(JSON.stringify({ success: false, message: "Server error during reset password." }));
    }
}

async function handleVerifyOTP(req, res, bodyParser) {
    const { email, otp, type } = await bodyParser(req);
    try {
        const records = await OTP.find({ email, type }).sort({ createdAt: -1 });
        if (records.length === 0) return res.end(JSON.stringify({ success: false, message: "No OTP found. Request again." }));
        const latest = records[0];
        if (Date.now() > new Date(latest.expiresAt).getTime()) {
            return res.end(JSON.stringify({ success: false, message: "OTP expired." }));
        }
        const isMatch = await bcrypt.compare(otp, latest.otp);
        if (!isMatch) return res.end(JSON.stringify({ success: false, message: "Invalid OTP." }));
        
        // Specific handling for 2FA toggle verification
        if (type === 'enable2fa' || type === 'disable2fa') {
            const user = await User.findOne({ email });
            if (!user) return res.end(JSON.stringify({ success: false, message: "User not found for 2FA verification." }));

            user.is2FAEnabled = (type === 'enable2fa'); // Set 2FA status based on type
            await user.save();
            await OTP.deleteMany({ email, type }); // Clear OTPs after successful verification
            return res.end(JSON.stringify({ success: true, message: `2FA ${user.is2FAEnabled ? 'enabled' : 'disabled'} successfully!`, is2FAEnabled: user.is2FAEnabled }));
        }

        // Existing login OTP verification
        if (type === 'login') {
            const user = await User.findOne({ email });
            const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
            await OTP.deleteMany({ email, type });
            return res.end(JSON.stringify({ success: true, token: token, message: "Login Successful!" }));
        }

        // Generic OTP verification (e.g., signup, forgot password)
        await OTP.deleteMany({ email, type });
        return res.end(JSON.stringify({ success: true, message: "OTP Verified!" }));
    } catch (err) {
        console.error("Verify OTP Error:", err);
        return res.end(JSON.stringify({ success: false, message: "OTP verification failed." }));
    }
}

async function handleChangePassword(req, res, bodyParser) {
    const { currentPassword, newPassword } = await bodyParser(req);
    const userId = req.user.userId; 

    if (!currentPassword || !newPassword) {
        return res.end(JSON.stringify({ success: false, message: "Current and new passwords are required." }));
    }
    if (newPassword.length < 6) {
        return res.end(JSON.stringify({ success: false, message: "New password must be at least 6 characters long." }));
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.end(JSON.stringify({ success: false, message: "User not found." }));
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.end(JSON.stringify({ success: false, message: "Current password is incorrect." }));
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        await user.save();

        return res.end(JSON.stringify({ success: true, message: "Password updated successfully!" }));

    } catch (err) {
        console.error("Change Password Error:", err);
        return res.end(JSON.stringify({ success: false, message: "Server error during password change." }));
    }
}

// Function to handle 2FA toggle request (sends OTP for confirmation)
async function handleToggle2FA(req, res, bodyParser) {
    const { enable } = await bodyParser(req); // 'enable' will be true to enable, false to disable
    const userId = req.user.userId; // Get userId from authenticated token

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.end(JSON.stringify({ success: false, message: "User not found." }));
        }

        const otpType = enable ? "enable2fa" : "disable2fa";
        const result = await generateAndStoreOTP(user.email, otpType);
        if (!result.success) {
            return res.end(JSON.stringify({ success: false, message: result.message }));
        }
        await sendOTPEmail(user.email, result.otp);

        return res.end(JSON.stringify({
            success: true,
            message: `OTP sent to ${user.email} to confirm 2FA ${enable ? 'enable' : 'disable'}.`,
            action: otpType // Indicate what action is pending confirmation
        }));

    } catch (err) {
        console.error("Toggle 2FA Error:", err);
        return res.end(JSON.stringify({ success: false, message: "Server error during 2FA toggle request." }));
    }
}


module.exports = {
    handleSignup,
    handleLogin,
    handleForgotPassword,
    handleResetPassword,
    handleVerifyOTP,
    handleResendOTP,
    handleChangePassword,
    handleToggle2FA // Export the 2FA toggle function
};