import joi from 'joi';

export function validateRegister(user) {
  const registerSchema = joi.object({
    firstName: joi.string().min(3).required(),
    lastName: joi.string().min(3).required(),
    email: joi.string().email().min(5).max(50).required(),
    password: joi.string().min(6).required(),
    mobileNo: joi.string().length(10).pattern(/^[0-9]+$/).required(),
  });

  const { error, value } = registerSchema.validate(user, { abortEarly: false });
  if (error) {
    const errorMap = error.details.reduce((acc, detail) => {
      acc[detail.path.join('.')] = detail.message;
      return acc;
    }, {});
    return { error: errorMap, value };
  }
  return { error: null, value };
}

export function validateLogin(user) {
  const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().required()
  });

  const { error, value } = loginSchema.validate(user, { abortEarly: false });
  if (error) {
    const errorMap = error.details.reduce((acc, detail) => {
      acc[detail.path.join('.')] = detail.message;
      return acc;
    }, {});
    return { error: errorMap, value };
  }
  return { error: null, value };
}
