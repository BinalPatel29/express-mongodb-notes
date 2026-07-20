import { Transform, TransformCallback } from 'stream';

interface SystemError extends Error {
  code?: string;
}

const uppercaseTransform: Transform = new Transform({
  highWaterMark: 16 * 1024,
  transform(this: Transform, chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      const upperText: string = chunk.toString('utf8').toUpperCase();
      this.push(upperText);

      const mem: NodeJS.MemoryUsage = process.memoryUsage();
      console.error(
        `\n[Memory Profile] RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB | ` +
        `Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB | ` +
        `Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`
      );
      callback(null);
    } catch (error: unknown) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }
});

process.stdin.on('error', (err: SystemError) => console.error('Input Stream Error:', err.message));
uppercaseTransform.on('error', (err: SystemError) => console.error('Transform Error:', err.message));

process.stdout.on('error', (err: SystemError) => {
  if (err.code === 'EPIPE') process.exit(0);
  console.error('Output Stream Error:', err.message);
});

process.stdin.pipe(uppercaseTransform).pipe(process.stdout);
