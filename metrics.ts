import { Counter, register, Registry, Histogram , Gauge} from 'prom-client';

const registry = new Registry();

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total requests handled, labeled by route and status code',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry]
});

const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'How long each request took',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
    registers: [register]
})

const cacheHitTotal = new Counter({
    name: 'cache_hits_total',
    help: 'How often the redis cache actually helping',
    registers: [registry]
});

const cacheMissTotal = new Counter({
    name: 'chache_misses_total',
    help: 'How often the redis cache lacks requested data',
    registers: [register]
});

const queueJobWaiting = new Gauge({
    name: 'queue_jobs_waiting',
    help: 'How How many image-resize jobs are currently sitting in the BullMQ queue',
    registers: [register]
});

const queueDurationSeconds = new Histogram({
    name: 'queue_job_duration_seconds',
    help: 'How long the worker actually takes to resize an image',
    buckets: [0.5, 1, 2, 5, 10, 30],
    registers: [register]
});

function recordRequest(
    method: string,
    route: string,
    statusCode: number
): void {
    const statutsClass = `${Math.floor(statusCode/100)}xx`

    httpRequestTotal.inc({
        method: method.toUpperCase(),
        route: route,
        status_code: statutsClass,
    });
}

export { registry , recordRequest , httpRequestDurationSeconds , cacheHitTotal , cacheMissTotal , queueJobWaiting , queueDurationSeconds };