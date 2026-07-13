import fs from 'fs';
import readline from 'readline';
import path from 'path';
import logger from './src/utils/logger.js';

const logFile = process.argv[2];

if (!logFile) {
    logger.error('Usage: node process-log.js <path-to-bigfile.log>');
    process.exit(1);
}

const resolvedPath = path.resolve(logFile);

if (!fs.existsSync(resolvedPath)) {
    logger.error({ resolvedPath }, 'Targeted log file does not exist at path');
    process.exit(1);
}

const fileStream = fs.createReadStream(resolvedPath, { encoding: 'utf-8' });

const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
});

let linecount = 0;

rl.on('line', (line) => {
    linecount++;
  
    if (linecount % 500000 === 0) {
        const memoryMB = parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2));
        logger.info({ linecount, memoryMB }, 'Stream processing tracking interval status metrics');
    }
});

rl.on('close', () => {
    const finalMemoryMB = parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2));
    logger.info({ totalLines: linecount, finalMemoryMB }, 'Stream analysis processing pipeline execution complete');
});
