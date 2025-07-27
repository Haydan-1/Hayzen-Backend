// 📁 Backend/models/chathistory.js

const mongoose = require("mongoose");

// This is the schema that defines the structure of a chat history document.
const ChatHistorySchema = new mongoose.Schema({
    // We are adding the user reference. This is the "new good" part.
    userId: {
        type: mongoose.Schema.Types.ObjectId, // The user's unique database ID
        ref: 'User',                         // Links to our 'User' model
        required: true,                      // A chat MUST belong to a user
        index: true                          // Makes searching by user faster
    },
    // All the "good old features" are staying exactly the same.
    prompt: {
        type: String,
        required: true,
        trim: true
    },
    reply: {
        type: String,
        required: true,
        trim: true
    },
    engine: {
        type: String,
        default: "openrouter"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// This creates the model from the schema.
// It prevents Mongoose from creating the model more than once.
const ChatHistory = mongoose.models.ChatHistory || mongoose.model("ChatHistory", ChatHistorySchema);

module.exports = ChatHistory;