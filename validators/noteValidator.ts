import joi from 'joi';
import joiObjectId from 'joi-objectid';

(joi as any).objectId = joiObjectId(joi);

interface INoteInput {
  text: string;
  userId: string;
  createdAt?: string;
  imageUrl?: string;
}

interface IValidationSuccess{
  success: true;
  value: INoteInput;
  error: null;
}

interface IValidationFailure{
  success: false;
  value: any;
  error: Record<string, string>;
}

type validationResult = IValidationSuccess | IValidationFailure;

export const validateNote = (note: unknown): validationResult  => {
  const notesSchema = joi.object({
    text: joi.string()
      .min(2)
      .required()
      .trim()
      .messages({
        'string.empty': 'Note text field cannot be left blank.',
        'string.min': 'Note text must be at least 2 characters long.'
      }),
    userId: (joi as any).objectId().required(),
    createdAt: joi.date().iso(),
    imageUrl: joi.string().allow('').optional()
  });

  const { error, value } = notesSchema.validate(note, { abortEarly: false });
  if (error) {
    const errorMap: Record<string, string> = error.details.reduce((acc: Record<string,string>, detail: joi.ValidationErrorItem) => {
      acc[detail.path.join('.')] = detail.message;
      return acc;
    }, {} as Record<string, string>);
    return { 
      success: false,
      error: errorMap,
      value
    };
  }
  return { 
    success: true,
    error: null,
    value: value as INoteInput
  };
};
