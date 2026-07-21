import { Request, Response, NextFunction } from 'express';
import { recordRequest, httpRequestDurationSeconds } from '../metrics.js';

export function metricsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    
    const endTimer = httpRequestDurationSeconds.startTimer();

    res.on('finish', () => {
        const route = req.route?.path || req.path;
        recordRequest(req.method, route, res.statusCode);

        const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
        endTimer({
           method: req.method.toUpperCase(),
           route: route,
           status_code: statusClass,
        });
    });
    next();
}