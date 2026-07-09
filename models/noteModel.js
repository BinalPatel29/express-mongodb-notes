import mongoose from 'mongoose';

const notesSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true, // FIXED: Re-enforced mandatory text fields
    trim: true,
    minlength: 2 // FIXED: Enforces at least a 2-character note text signature
  },
  userId: {  
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  imageUrl: {
    type: String,
    default: ""
  }
}, {
    timestamps: true 
});

notesSchema.index({ userId: 1, createdAt: -1});

const Note = mongoose.model('Note', notesSchema);
export default Note;
