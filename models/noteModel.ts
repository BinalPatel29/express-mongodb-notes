import { Schema, model } from 'mongoose';

interface INote {
  text: string;
  userId: Schema.Types.ObjectId;
  imageUrl?: string;
}

const notesSchema = new Schema<INote>({
  text: { 
    type: String, 
    required: true, 
    trim: true, 
    minlength: 2 
  },
  userId: { 
    type: Schema.Types.ObjectId, 
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

notesSchema.index({ userId: 1, createdAt: -1 });

const Note = model<INote>('Note', notesSchema);
export default Note;