import joi from 'joi';
import { Schema } from 'mongoose';

export function validateRegister(user){
    const registerSchema = joi.object ({
        
        firstName: joi.string()
                      .min(3)
                      .required(),

        lastName: joi.string()
                      .min(3)
                      .required(),

        email: joi.string()
                  .email()
                  .min(5)
                  .max(50)
                  .required(),
        
        password: joi.string()
                     .min(6)
                     .required(),
                    
        mobileNo: joi.string()
                     .length(10)
                     .pattern(/^[0-9]+$/),
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
    return loginSchema.validate(user);
}