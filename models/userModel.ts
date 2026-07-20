import { Schema, model, Document, HydratedDocument } from 'mongoose';
import bcrypt from 'bcrypt';

interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  mobileNo?: string;
  refreshTokens: string[];
  uploadDir?: string;
}

interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Combine them into a type helper for the schema initialization
type UserModelType = Schema<IUser, {}, IUserMethods>;

const userSchema = new Schema<IUser, {}, IUserMethods>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobileNo: { type: String },
  refreshTokens: { type: [String], default: [] },
  uploadDir: { type: String, default: "" }
});

userSchema.pre('save', async function (this: Document & IUser) {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (
  this: HydratedDocument<IUser, IUserMethods>, 
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = model<IUser, UserModelType>('User', userSchema);
export default User;
