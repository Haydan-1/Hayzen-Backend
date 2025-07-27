// jwtController.js
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// Load secrets and settings
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = "15m"; // Industry standard short session
const REFRESH_TOKEN_EXPIRES_IN = "30d";
const REFRESH_INACTIVITY_LIMIT_DAYS = 7; // Hybrid model setting

// 1. 🔐 Generate Access Token
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

// 2. 🔐 Generate Refresh Token
function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

// 3. 🚀 Send Tokens to Client + Save Refresh Data
async function sendTokens(user, res) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token and usage timestamp in DB
  user.refreshToken = refreshToken;
  user.refreshTokenLastUsed = new Date();
  await user.save();

  // Send refresh token in HttpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Send access token in JSON
  return res.status(200).json({ accessToken });
}

// 4. ✅ Middleware: Verify Access Token
function verifyAccessToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access token missing or malformed" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired access token" });
  }
}

// 5. 🔄 Refresh Token Route Handler
async function refreshTokenHandler(req, res) {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ message: "Refresh token not found" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // 6. 🕓 Check refresh token inactivity (7-day limit)
    const lastUsed = user.refreshTokenLastUsed;
    const now = new Date();
    const diffDays = (now - lastUsed) / (1000 * 60 * 60 * 24);

    if (diffDays > REFRESH_INACTIVITY_LIMIT_DAYS) {
      // Clear refresh token
      user.refreshToken = null;
      user.refreshTokenLastUsed = null;
      await user.save();
      return res.status(403).json({ message: "Session expired. Please log in again." });
    }

    // ✅ Update usage timestamp
    user.refreshTokenLastUsed = now;
    await user.save();

    // 🔄 Issue new access token
    const newAccessToken = generateAccessToken(user);
    return res.status(200).json({ accessToken: newAccessToken });

  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired refresh token" });
  }
}

// 7. 🚪 Logout helper (optional)
function clearTokens(res) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  sendTokens,
  verifyAccessToken,
  refreshTokenHandler,
  clearTokens
};
