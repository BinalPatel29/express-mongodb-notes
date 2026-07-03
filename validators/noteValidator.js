import joi from 'joi';
import joiObjectId from 'joi-objectid';

joi.objectId = joiObjectId(joi);

export function validateNote(note) {
    const notesSchema = joi.object ({

        text: joi.string()
                 .min(2)
                 .required()
                 .trim(),

        userId: JoiObjectId()
                   .required(),

        createAt:  joi.date()
                      .iso()
    });
    return notesSchema.validate(note);
}