import pino from 'pino'     // writes super-fast server logs

const logger = pino ({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin(){
        return { service: 'note-api-service' };
    }
});
export default logger;