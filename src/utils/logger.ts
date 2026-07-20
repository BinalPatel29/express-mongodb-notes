import pino from 'pino'; // writes super-fast server logs

export interface ILiveNotificationPayload {
    text: string;
    filename: string;
}

export interface IJobDonePayload {
    jobId: string;
    imageUrl: string;
    noteId: string;
}

export interface ServerClientEvents {
    liveNotification: (data: ILiveNotificationPayload) => void;
    done: (data: IJobDonePayload) => void;
}

const logger = pino({
    level: process.env['LOG_LEVEL'] || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
        return { service: 'note-api-service' };
    },
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,          
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', 
            ignore: '',             
            singleLine: false,       
            messageFormat: '{msg}'   
        }
    } : undefined
});

export default logger;
