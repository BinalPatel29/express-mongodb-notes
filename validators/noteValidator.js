import joi from 'joi';
import joiObjectId from 'joi-objectid';

joi.objectId = joiObjectId(joi);

export const validateNote = (note) => {
    const notesSchema = joi.object({
        text: joi.string()
                 .min(2)
                 .required()
                 .trim(),

        userId: joi.objectId()
                   .required(),

        createdAt: joi.date()
                      .iso(),

        imageUrl: joi.string()
                     .allow('')
                     .optional()
    });
    
    return notesSchema.validate(note);
};
