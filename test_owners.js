const db = require('./config/db');
async function test() {
    try {
        const [owners] = await db.query("SELECT id, name FROM users WHERE role='owner'");
        console.log("Owners found:", owners);
    } catch (e) { console.error(e); }
    process.exit();
}
test();