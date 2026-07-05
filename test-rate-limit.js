async function runTest() {
    console.log("Testing auth rate limiter (Max 20 requests)...");

    for (let i = 1; i <= 22; i++) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: "test@test.com", password: "password123" })
    });
    console.log(`request #${i}: status = ${res.status}`);

    if (res.status === 429) {
      const data = await res.json();
      console.log("Blocked by rate limiter:", data);
      break;
    }
    }
}
runTest();