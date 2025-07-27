const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") }); // ✅ .env is in parent dir

const nodemailer = require("nodemailer");

// Debug SMTP values
console.log("✅ SMTP_USER:", process.env.SMTP_USER);
console.log("✅ SMTP_PASS:", process.env.SMTP_PASS);

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  throw new Error("❌ Missing SMTP credentials");
}

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOTPEmail(to, otp) {
  const html = `<p>Your OTP is: <strong>${otp}</strong></p>`;
  const subject = "Your Hayzen OTP Code";

  console.log("📨 Sending OTP to:", to, "| OTP:", otp);

  try {
    const info = await transporter.sendMail({
      from: process.env.BREVO_SENDER_EMAIL,
      to,
      subject,
      html,
    });
    console.log("📩 OTP Email sent:", info.messageId);
  } catch (error) {
    console.error("❌ Email error:", error);
  }
}

module.exports = { sendOTPEmail };
