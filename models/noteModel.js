import mongoose from 'mongoose';

const notesSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2 
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