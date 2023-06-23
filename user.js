const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    conversations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
      }]
    
  });

  userSchema.methods.setPassword = async function (password) {
    const saltRounds = 10;
    this.password = await bcrypt.hash(password, saltRounds);
  };

  userSchema.methods.comparePassword = async function (password) {
    try {
      // Compare the provided password with the stored password
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      throw error;
    }
  };

  const User = mongoose.model('User', userSchema);

  module.exports = User;