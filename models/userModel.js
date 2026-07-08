import mongoose from 'mongoose';
import bcrypt from 'bcrypt';        

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true }, // Added index optimization
  password: { type: String, required: true },
  mobileNo: { type: String },
  refreshTokens: { type: [String], default: [] } 
});

userSchema.pre('save', async function (next) {     
  if (!this.isModified('password')) {
    return next(); // Explicitly continue if password hasn't changed
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Explicitly continue after successful hashing
  } catch (error) {
    next(error); // Passes the error safely down to Mongoose error handling
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
