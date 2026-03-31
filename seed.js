const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function seed() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('password123', salt);

        // Add Owner
        const [ownerRes] = await db.query(
            "INSERT INTO users (name, email, password, role) VALUES ('Admin Owner', 'owner@foodie.com', ?, 'owner') ON DUPLICATE KEY UPDATE id=id", [hash]
        );
        const ownerQuery = await db.query("SELECT id FROM users WHERE email='owner@foodie.com'");
        const ownerId = ownerQuery[0][0].id;

        // Add Customer
        await db.query(
            "INSERT INTO users (name, email, password, role) VALUES ('John Customer', 'customer@foodie.com', ?, 'customer') ON DUPLICATE KEY UPDATE id=id", [hash]
        );

        // Add Delivery
        const [delRes] = await db.query(
            "INSERT INTO users (name, email, password, role) VALUES ('Fast Delivery Boy', 'delivery@foodie.com', ?, 'delivery') ON DUPLICATE KEY UPDATE id=id", [hash]
        );
        const delQuery = await db.query("SELECT id FROM users WHERE email='delivery@foodie.com'");
        const delId = delQuery[0][0].id;

        await db.query(
            "INSERT IGNORE INTO delivery_boys (user_id, name, phone, owner_id) VALUES (?, 'Fast Delivery Boy', '9998887776', ?)", [delId, ownerId]
        );

        // Add Food
        await db.query(
            "INSERT INTO food_items (name, price, description, category, type, image, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ['Spicy Chicken Burger', 8.99, 'Delicious pulled chicken with spicy mayo', 'Non-Veg', 'Main Course', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', ownerId]
        );
        await db.query(
            "INSERT INTO food_items (name, price, description, category, type, image, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ['Veggie Supreme Pizza', 12.50, 'Loaded with fresh veggies and cheese', 'Veg', 'Main Course', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80', ownerId]
        );
        await db.query(
            "INSERT INTO food_items (name, price, description, category, type, image, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ['Chocolate Lava Cake', 6.00, 'Warm gooey chocolate inside', 'Veg', 'Dessert', 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&w=400&q=80', ownerId]
        );

        console.log("Database seeded successfully with food and test accounts (password123 for all)!");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
