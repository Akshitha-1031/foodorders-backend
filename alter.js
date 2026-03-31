const db = require('./config/db');
async function runAlter() {
    try {
        await db.query("ALTER TABLE users ADD COLUMN address TEXT");
        console.log("Added address to users");
    } catch (e) { console.log("Address column might already exist"); }

    try {
        await db.query(`
        CREATE TABLE IF NOT EXISTS delivery_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            delivery_boy_id INT NOT NULL,
            owner_id INT NOT NULL,
            status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (delivery_boy_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unq_del_own (delivery_boy_id, owner_id)
        )`);
        console.log("Created delivery_requests table");
    } catch (e) { console.log(e.message); }
    process.exit();
}
runAlter();
