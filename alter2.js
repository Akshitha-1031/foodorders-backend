const db = require('./config/db');
async function runAlter() {
    try {
        await db.query("ALTER TABLE users ADD COLUMN phone VARCHAR(20)");
        console.log("Added phone to users");
    } catch (e) { console.log("Phone column might already exist"); }
    process.exit();
}
runAlter();
