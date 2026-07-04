import mongoose from 'mongoose';
import bcrypt from 'bcrypt'; 

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobileNo: { type: String }
});

 userSchema.pre('save', async function (next) {
     if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
            return next();
         this.password = await bcrypt.hash(this.password, salt);
     } catch (error) {
         next(error); 
     }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
