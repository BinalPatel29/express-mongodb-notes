import { Transform } from 'stream';

const uppercaseTransform = new Transform({
    highWaterMark: 16 * 1024, 
    
    transform(chunk, encoding, callback) {
        try {
            const upperText = chunk.toString('utf8').toUpperCase();
            
            const canContinue = this.push(upperText);
            
            if (!canContinue) {
            }
            
            callback(null); 
            
        } catch (error) {
            callback(error);
        }
    }
});

process.stdin.on('error', (err) => console.error('Input Stream Error:', err.message));
uppercaseTransform.on('error', (err) => console.error('Transform Error:', err.message));
process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE') process.exit(0);
    console.error('Output Stream Error:', err.message);
});

process.stdin.pipe(uppercaseTransform).pipe(process.stdout);
