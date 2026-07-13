import joi from 'joi';
import joiObjectId from 'joi-objectid';

joi.objectId = joiObjectId(joi);

export const validateNote = (note) => {
  const notesSchema = joi.object({
    text: joi.string()
      .min(2)
      .required()
      .trim()
      .messages({
        'string.empty': 'Note text field cannot be left blank.',
        'string.min': 'Note text must be at least 2 characters long.'
      }),
    userId: joi.objectId().required(),
    createdAt: joi.date().iso(),
    imageUrl: joi.string().allow('').optional()
  });

  const { error, value } = notesSchema.validate(note, { abortEarly: false });
  if (error) {
    const errorMap = error.details.reduce((acc, detail) => {
      acc[detail.path.join('.')] = detail.message;
      return acc;
    }, {});
    return { error: errorMap, value };
  }
  return { error: null, value };
};
