import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

console.log("1. start");
fs.readFile(__filename, () => {
    
    // Timer Phase (will run in the next loop iteration)
    setTimeout(() => console.log("5. Timeout"), 0);
    
    // Check Phase (will run immediately after current phases/microtasks)
    setImmediate(() => console.log("4. Immediate"));
    
    // Microtask Queue (High priority)
    Promise.resolve().then(() => console.log("3. Promise"));
    
    // NextTick Queue (Highest priority)
    process.nextTick(() => console.log("2. next tick"));
});
console.log("6. End");