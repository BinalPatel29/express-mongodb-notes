import mongoose from 'mongoose';

const notesSchema = new mongoose.Schema({
  text: { type: String, required: true ,minlength: 2, trim: true },
  userId : {  type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
},{
    timestamps: true
});

const Note = mongoose.model('Note', notesSchema);
export default Note;