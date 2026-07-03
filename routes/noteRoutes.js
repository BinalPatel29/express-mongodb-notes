import express, { Router } from 'express';
import Note from '../models/noteModel.js';
import { validateNote } from '../validators/noteValidator.js';
import logger from '../src/utils/logger.js';

const router = Router();

router.get('/', async(req, res, next) => {
    const logContext = { path: '/notes', method: 'GET', userId: req.userId };

    try {
        const notes = await Note.find({ userId : req.userId });
        res.json(notes);
    }
    catch(error) {
        logger.error({ ...logContext, error: error.message, stack: error.stack }, "Internal crash during notes retrieval");
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    const logContext = { path: `/notes/${req.params.id}`, method: 'GET', userId: req.userId, noteId: req.params.id };

    try {
        const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
        if (!note) return res.status(404).json({ error: 'Note not found' });
        res.json(note);
    }
    catch (error) {
        logger.error({ ...logContext, error: error.message, stack: error.stack }, "Internal crash during single note retrieval");
        next(error);
    }
});

router.post('/', async(req, res, next) => {
    const logContext = { path: '/notes', method: 'POST', userId: req.userId };

    try {
       const payload = {
            text: req.body.text,
            userId: req.userId
       };
       
       const { error } = validateNote(payload);
       if(error) {
            const errorMsg = error.details?.[0]?.message || error.message;
            logger.warn({ ...logContext, validationError: errorMsg }, "Note creation validation failed");
            return res.status(400).json({ error: errorMsg });
       }

       const note = new Note({ text : req.body.text, userId : req.userId });
       await note.save();
       logger.info({ ...logContext, noteId: note._id }, "Note written to database successfully");
       res.status(201).json(note);
    }
    catch(error){
        logger.error({ ...logContext, error: error.message, stack: error.stack }, "Internal crash during note creation");
        next(error);
    }
});

router.patch('/:id', async(req, res, next) => {
    const logContext = { path: `/notes/${req.params.id}`, method: 'PATCH', userId: req.userId, noteId: req.params.id };
    
    try {
       const payload = {
            text: req.body.text,
            userId: req.userId
       };
       
       const { error } = validateNote(payload);
       if(error) {
            const errorMsg = error.details?.[0]?.message || error.message;
            logger.warn({ ...logContext, validationError: errorMsg }, "Note modification validation failed");
            return res.status(400).json({ error: errorMsg });
       }

        const note = await Note.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId }, 
            req.body, 
            { new: true }
        );

        if(!note){
            logger.warn({ ...logContext }, "Note patch rejected: Target document record not found or unauthorized");
            return res.status(404).json({ error: 'Note not found' });
        } 
        logger.info({ ...logContext }, "Note record updated successfully");
        res.json({ message : 'Note updated successfully', note });
    }
    catch(error){
        logger.error({ ...logContext, error: error.message, stack: error.stack }, "Internal crash during note modification");
        next(error);
    }
});

// DELETE NOTE (SECURED)
router.delete('/:id', async(req, res, next) => {
    const logContext = { path: `/notes/${req.params.id}`, method: 'DELETE', userId: req.userId, noteId: req.params.id };

    try {
        const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if(!note) return res.status(404).json({ error: 'Note not found' });

        logger.info({ ...logContext }, "Note record deleted successfully");
        res.json({ message : 'Note deleted successfully' });
    }
    catch(error){
        logger.error({ ...logContext, error: error.message, stack: error.stack }, "Internal crash during note deletion");
        next(error);
    }
});

export default router;
