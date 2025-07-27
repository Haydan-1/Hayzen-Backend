const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Helpers (put these in jwtController if split)
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d', // access token lifetime
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Login Controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid email or password.' });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token in DB and update usage timestamp
    user.refreshToken = refreshToken;
    user.refreshTokenLastUsed = new Date();
    await user.save();

    // Set tokens in cookies (HTTP-only)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({
      message: 'Login successful.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// Refresh Token Handler
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token found.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== token) {
      return res.status(403).json({ message: 'Refresh token is invalid.' });
    }

    // Hybrid expiry logic: re-auth if inactive for >7 days
    const now = new Date();
    const lastUsed = new Date(user.refreshTokenLastUsed);
    const daysInactive = (now - lastUsed) / (1000 * 60 * 60 * 24);

    if (daysInactive > 7) {
      user.refreshToken = null;
      user.refreshTokenLastUsed = null;
      await user.save();
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    // Valid usage: generate new access token, update usage
    const newAccessToken = generateAccessToken(user._id);
    user.refreshTokenLastUsed = now;
    await user.save();

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: 'Token refreshed successfully.' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Error refreshing token.' });
  }
};

// Logout Controller
exports.logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        user.refreshToken = null;
        user.refreshTokenLastUsed = null;
        await user.save();
      }
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error during logout.' });
  }
};
