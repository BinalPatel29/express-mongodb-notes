import mongoose from 'mongoose';

const notesSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true,
    minLength: 2, 
    trim: true 
  },
  userId: {  
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, {
    timestamps: true 
});
notesSchema.index({ userId: 1, createdAt: -1});

const Note = mongoose.model('Note', notesSchema);
export default Note;
