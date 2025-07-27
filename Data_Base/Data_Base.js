// Backend/Data_Base/Data_Base.js

const mongoose = require("mongoose");
require("dotenv").config(); // ✅ Load .env

console.log("DEBUG MONGO_URI:", process.env.MONGO_URI);

async function connectToDB() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected successfully to DB: Hayzen");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

module.exports = connectToDB;
