import cluster from 'cluster';
import os from 'os';
import { createServer } from 'http';
import { setupMaster } from "@socket.io/sticky";
import { setupPrimary } from "@socket.io/cluster-adapter";
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 3000;
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    logger.info(`Primary cluster master process ${process.pid} is running smoothly.`);
  
    const primaryServer = createServer();
  
    setupMaster(primaryServer, {
        loadBalancingMethod: "least-connection",
    });

    setupPrimary();

    primaryServer.listen(PORT, () => {
        logger.info(`Primary Cluster Proxy balancing incoming traffic on port: ${PORT}`);
     });

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.warn({ workerId: worker.process.pid, code, signal }, 'Cluster worker process exited abruptly. Forking backup worker instance...');
        cluster.fork();
    });

    } else {
        logger.info(`Worker process ${process.pid} spawned. Bootstrapping application...`);
        await import('./server.js');
    }
