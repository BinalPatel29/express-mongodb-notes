import joi from 'joi';
import { Schema } from 'mongoose';

export function validateRegister(user){
    const registerSchema = joi.object ({

        email: joi.string()
                  .email()
                  .min(5)
                  .max(50)
                  .required(),
        
        password: joi.string()
                     .min(6)
                     .required()
    });
    return registerSchema.validate(user);
}

export function validateLogin(user){
    const loginSchema = joi.object ({

         email: joi.string()
                   .email()
                   .required(),
        
        password: joi.string()
                     .required()
    });
    return validateLogin.validate(user);
}