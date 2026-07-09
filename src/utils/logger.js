import pino from 'pino'; // writes super-fast server logs

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
        return { service: 'note-api-service' };
    },
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,          
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', 
            ignore: '',             
            singleLine: false,       
            messageFormat: '{msg}'   
        }
    }
});

export default logger;
