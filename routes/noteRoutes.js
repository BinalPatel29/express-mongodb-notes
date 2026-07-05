import express, { Router } from 'express';
import Note from '../models/noteModel.js';
import { validateNote } from '../validators/noteValidator.js';
import logger from '../src/utils/logger.js';

const router = Router();

router.get('/', async(req, res, next) => {
    const notes = await Note.find({ userId : req.userId });
    res.json(notes);
});

router.get('/:id', async (req, res, next) => {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) {
        const error = new Error("Note not found");
        error.statusCode = 404;
        throw error;
    } 
     res.json(note);
});

router.post('/', async(req, res, next) => {
    const logContext = { path: '/notes', method: 'POST', userId: req.userId };
    const payload = {
            text: req.body.text,
            userId: req.userId
    };
    const { error } = validateNote(payload);
       
    if(error) {
        const errorMsg = error.details?.[0]?.message || error.message;
        logger.warn({ ...logContext, validationError: errorMsg }, "Note creation validation failed");

        const validationError = new Error(errorMsg);
        validationError.statusCode = 400;
        throw validationError;
       }
    
       const note = new Note({ text : req.body.text, userId : req.userId });
       await note.save();

       logger.info({ ...logContext, noteId: note._id }, "Note written to database successfully");
       res.status(201).json(note);
});

router.patch('/:id', async(req, res, next) => {
    const logContext = { path: `/notes/${req.params.id}`, method: 'PATCH', userId: req.userId, noteId: req.params.id };
    const payload = {
            text: req.body.text,
            userId: req.userId
    };
    const { error } = validateNote(payload);

    if(error) {
        const errorMsg = error.details?.[0]?.message || error.message;
        logger.warn({ ...logContext, validationError: errorMsg }, "Note modification validation failed");

        const validationError = new Error(errorMsg);
        validationError.statusCode = 400;
        throw validationError;
    }

    const note = await Note.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId }, 
        req.body, 
        { new: true }
    );

    if(!note){
        logger.warn({ ...logContext }, "Note patch rejected: Target document record not found or unauthorized");
        const notFoundError = new Error('Note not found');
        notFoundError.statusCode = 404;
        throw notFoundError;
    } 
    logger.info({ ...logContext }, "Note record updated successfully");
    res.json({ message : 'Note updated successfully', note });
});

router.delete('/:id', async(req, res, next) => {
    const logContext = { path: `/notes/${req.params.id}`, method: 'DELETE', userId: req.userId, noteId: req.params.id };
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if(!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }
    logger.info({ ...logContext }, "Note record deleted successfully");
    res.json({ message : 'Note deleted successfully' });
});

export default router;