
async function test() {
  try {
    console.log("Testing /api/health...");
    const healthRes = await fetch('http://localhost:3000/api/health');
    console.log("Health Status:", healthRes.status);
    console.log("Health Body:", await healthRes.text());

    console.log("\nTesting /api/extract-pdf (empty)...");
    const extractRes = await fetch('http://localhost:3000/api/extract-pdf', {
      method: 'POST'
    });
    console.log("Extract Status:", extractRes.status);
    console.log("Extract Body:", await extractRes.text());
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
