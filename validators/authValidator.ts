import joi from 'joi';

interface IRegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  mobileNo?: string;
}

interface ILoginInput {
  email: string;
  password: string;
}

interface IValidationSuccess<T> {
  success: true;
  value: T;
  error: null;
}

interface IValidationFailure {
  success: false;
  value: unknown;
  error: Record<string, string>;
}

type RegisterValidationResult = IValidationSuccess<IRegisterInput> | IValidationFailure;
type LoginValidationResult = IValidationSuccess<ILoginInput> | IValidationFailure;

export function validateRegister(user: unknown): RegisterValidationResult {
  const registerSchema = joi.object({
    firstName: joi.string().min(3).required(),
    lastName: joi.string().min(3).required(),
    email: joi.string().email().min(5).max(50).required(),
    password: joi.string().min(6).required(),
    mobileNo: joi.string().length(10).pattern(/^[0-9]+$/),
  });

  const { error, value } = registerSchema.validate(user, { abortEarly: false });

  if (error) {
    const errorMap = error.details.reduce((acc: Record<string, string>, detail: joi.ValidationErrorItem) => {
      acc[detail.path.join('.')] = detail.message;
      return acc;
    }, {} as Record<string, string>);
    return { success: false, error: errorMap, value };
  }
  return { success: true, error: null, value: value as IRegisterInput };
}

export function validateLogin(user: unknown): LoginValidationResult {
  const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().required()
  });

  const { error, value } = loginSchema.validate(user, { abortEarly: false });

  if (error) {
    const errorMap = error.details.reduce((acc: Record<string, string>, detail: joi.ValidationErrorItem) => {
      acc[detail.path.join('.')] = detail.message;
      return acc;
    }, {} as Record<string, string>);
    return {
       success: false, error: errorMap, value 
    };
  }
  return { 
    success: true, error: null, value: value as ILoginInput 
  }; 
}
