const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  conversationCounter: { type: Number, required: true },
  messages: [
    {
      role: { type: String, enum: ['assistant', 'user', 'system'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  conversationHistory: { type: String, required: true }
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;