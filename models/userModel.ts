import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';        // securely hashing and storing user passwords

interface IUser {
  firstName : string;
  lastName : string;
  email : string;
  password: string;
  mobileNo?: string;
  refreshTokens: string[];
  uploadDir?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobileNo: { type: String },
  refreshTokens: {type: [String] , default: []},
  uploadDir : {type: String, default: ""}
});

userSchema.pre('save', async function (this:any) {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (this:any, candidatePassword:string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = model<IUser>('User', userSchema);
export default User;