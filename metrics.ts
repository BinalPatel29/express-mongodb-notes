import { Counter, Registry, Histogram, Gauge } from 'prom-client';
import { Queue } from 'bullmq'; // Ensure you have bullmq types installed

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
  registers: [registry]
});

const cacheHitTotal = new Counter({
  name: 'cache_hits_total',
  help: 'How often the redis cache actually helping',
  registers: [registry]
});

const cacheMissTotal = new Counter({
  name: 'cache_misses_total', // Maintained your original typo to keep continuity with existing dashboards
  help: 'How often the redis cache lacks requested data',
  registers: [registry]
});

const queueJobDurationSeconds = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'How long the worker actually takes to resize an image',
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [registry]
});

const queueActiveWorkers = new Gauge({
  name: 'queue_active_workers',
  help: 'The exact count of active worker threads processing resizing tasks',
  registers: [registry]
});

let targetQueue: Queue | null = null;

const queueJobsWaiting = new Gauge({
  name: 'queue_jobs_waiting',
  help: 'How many image-resize jobs are currently sitting in the BullMQ queue',
  registers: [registry],
  async collect() {
    if (targetQueue) {
      try {
        const count = await targetQueue.getWaitingCount();
        this.set(count);
      } catch (err) {
        console.error('Failed to fetch BullMQ waiting count in metric collect:', err);
      }
    }
  }
});

function registerQueueReference(queueInstance: Queue): void {
  targetQueue = queueInstance;
}

function recordRequest(
  method: string,
  route: string,
  statusCode: number
): void {
  const statusClass = `${Math.floor(statusCode / 100)}xx`;

  httpRequestTotal.inc({
    method: method.toUpperCase(),
    route: route,
    status_code: statusClass,
  });
}

export { 
  registry, 
  recordRequest, 
  registerQueueReference,
  httpRequestDurationSeconds, 
  cacheHitTotal, 
  cacheMissTotal, 
  queueJobsWaiting, 
  queueActiveWorkers,
  queueJobDurationSeconds 
};
