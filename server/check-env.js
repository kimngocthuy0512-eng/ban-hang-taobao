
const assert = require("assert");

try {
    assert(process.env.ENCRYPTION_KEY, "ENCRYPTION_KEY is not defined");
    assert.strictEqual(process.env.ENCRYPTION_KEY.length, 32, "ENCRYPTION_KEY is not 32 characters long");
    console.log("ENCRYPTION_KEY is set correctly.");
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}
