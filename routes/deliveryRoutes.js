const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isOwner, isDeliveryBoy } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// Add a delivery boy (Owner)
router.post('/add', verifyToken, isOwner, async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password || !phone) return res.status(400).json({ message: 'Missing fields' });

        // 1. Create User
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const [userResult] = await db.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'delivery']
        );

        // 2. Add to delivery_boys
        const [delResult] = await db.query(
            'INSERT INTO delivery_boys (user_id, name, phone, owner_id) VALUES (?, ?, ?, ?)',
            [userResult.insertId, name, phone, req.user.id]
        );

        res.status(201).json({ message: 'Delivery boy added', id: delResult.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get owner's delivery boys (Owner)
router.get('/', verifyToken, isOwner, async (req, res) => {
    try {
        const [boys] = await db.query('SELECT id, user_id, name, phone FROM delivery_boys WHERE owner_id = ?', [req.user.id]);
        res.json(boys);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get Assigned Orders for Delivery Boy (Delivery Boy)
router.get('/myorders', verifyToken, isDeliveryBoy, async (req, res) => {
    try {
        // Find delivery_boy id for this user
        const [delBoy] = await db.query('SELECT id FROM delivery_boys WHERE user_id = ?', [req.user.id]);
        if (delBoy.length === 0) return res.status(403).json({ message: 'Not a valid delivery profile' });
        const boyId = delBoy[0].id;

        const [orders] = await db.query('SELECT * FROM orders WHERE delivery_boy_id = ? ORDER BY created_at DESC', [boyId]);

        for (let order of orders) {
            // customer info
            const [cust] = await db.query('SELECT name, email, phone FROM users WHERE id = ?', [order.user_id]);
            if (cust.length > 0) order.customer = cust[0];

            // items info
            const [items] = await db.query(`
                SELECT oi.quantity, f.name
                FROM order_items oi
                JOIN food_items f ON oi.food_id = f.id
                WHERE oi.order_id = ?
            `, [order.id]);
            order.items = items;
        }

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Order Status (Delivery Boy)
router.put('/orders/:id/status', verifyToken, isDeliveryBoy, async (req, res) => {
    try {
        const { status } = req.body;
        // Verify this order belongs to this delivery boy
        const [delBoy] = await db.query('SELECT id FROM delivery_boys WHERE user_id = ?', [req.user.id]);
        if (delBoy.length === 0) return res.status(403).json({ message: 'Unauthorized' });

        const [result] = await db.query('UPDATE orders SET status = ? WHERE id = ? AND delivery_boy_id = ?',
            [status, req.params.id, delBoy[0].id]);

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found or unauthorized' });

        res.json({ message: `Order marked as ${status}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all restaurant owners (Delivery Boy)
router.get('/owners', verifyToken, isDeliveryBoy, async (req, res) => {
    try {
        const [owners] = await db.query("SELECT id, name FROM users WHERE role='owner'");
        res.json(owners);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Send Join Request to Owner (Delivery Boy)
router.post('/request', verifyToken, isDeliveryBoy, async (req, res) => {
    try {
        const { ownerId } = req.body;
        // Check if already requested
        const [existing] = await db.query('SELECT * FROM delivery_requests WHERE delivery_boy_id = ? AND owner_id = ?', [req.user.id, ownerId]);
        if (existing.length > 0) return res.status(400).json({ message: 'Request already sent or processed' });

        await db.query('INSERT INTO delivery_requests (delivery_boy_id, owner_id) VALUES (?, ?)', [req.user.id, ownerId]);
        res.json({ message: 'Request sent to restaurant owner' });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get Pending Requests (Owner)
router.get('/requests', verifyToken, isOwner, async (req, res) => {
    try {
        const [reqs] = await db.query(`
            SELECT r.id as request_id, u.name, u.email, u.phone, u.id as delivery_boy_id
            FROM delivery_requests r
            JOIN users u ON r.delivery_boy_id = u.id
            WHERE r.owner_id = ? AND r.status = 'pending'
        `, [req.user.id]);
        res.json(reqs);
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Accept Request (Owner)
router.post('/requests/:id/accept', verifyToken, isOwner, async (req, res) => {
    try {
        const reqId = req.params.id;
        const [requests] = await db.query('SELECT * FROM delivery_requests WHERE id = ? AND owner_id = ? AND status = "pending"', [reqId, req.user.id]);
        if (requests.length === 0) return res.status(404).json({ message: 'Request not found' });

        const r = requests[0];
        // Mark as accepted
        await db.query('UPDATE delivery_requests SET status = "accepted" WHERE id = ?', [reqId]);
        // Insert into delivery_boys
        // need name and phone from users
        const [users] = await db.query('SELECT name, phone FROM users WHERE id = ?', [r.delivery_boy_id]);
        await db.query('INSERT IGNORE INTO delivery_boys (user_id, name, phone, owner_id) VALUES (?, ?, ?, ?)',
            [r.delivery_boy_id, users[0].name, users[0].phone || 'N/A', req.user.id]);

        res.json({ message: 'Delivery boy accepted' });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Reject Request (Owner)
router.post('/requests/:id/reject', verifyToken, isOwner, async (req, res) => {
    try {
        const reqId = req.params.id;
        const [requests] = await db.query('SELECT * FROM delivery_requests WHERE id = ? AND owner_id = ? AND status = "pending"', [reqId, req.user.id]);
        if (requests.length === 0) return res.status(404).json({ message: 'Request not found' });

        await db.query('UPDATE delivery_requests SET status = "rejected" WHERE id = ?', [reqId]);
        res.json({ message: 'Delivery boy request rejected' });
    } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
