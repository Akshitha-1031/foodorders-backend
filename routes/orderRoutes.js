const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isOwner, isDeliveryBoy } = require('../middleware/authMiddleware');

// Place an order (Customer)
router.post('/', verifyToken, async (req, res) => {
    try {
        const { items, totalPrice } = req.body;
        // items should be [{ food_id, quantity, price }, ...]
        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Order cannot be empty' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Insert Order
            const [orderResult] = await connection.query(
                'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, ?)',
                [req.user.id, totalPrice, 'Pending']
            );
            const orderId = orderResult.insertId;

            // Insert Order Items
            for (let item of items) {
                await connection.query(
                    'INSERT INTO order_items (order_id, food_id, quantity) VALUES (?, ?, ?)',
                    [orderId, item.food_id, item.quantity]
                );
            }

            await connection.commit();
            res.status(201).json({ message: 'Order placed successfully', orderId });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error placing order' });
    }
});

// View My Orders (Customer)
router.get('/myorders', verifyToken, async (req, res) => {
    try {
        const [orders] = await db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);

        // fetch items for each order
        for (let order of orders) {
            const [items] = await db.query(`
                SELECT oi.quantity, f.name, f.price, f.image
                FROM order_items oi
                JOIN food_items f ON oi.food_id = f.id
                WHERE oi.order_id = ?
            `, [order.id]);
            order.items = items;

            if (order.delivery_boy_id) {
                const [boy] = await db.query('SELECT name, phone FROM delivery_boys WHERE id = ?', [order.delivery_boy_id]);
                if (boy.length > 0) order.delivery_boy = boy[0];
            }
        }

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// View all orders (Owner) - fetching orders containing owner's food
router.get('/owner-orders', verifyToken, isOwner, async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT DISTINCT o.* 
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN food_items f ON oi.food_id = f.id
            WHERE f.owner_id = ?
            ORDER BY o.created_at DESC
        `, [req.user.id]);

        for (let order of orders) {
            const [items] = await db.query(`
                SELECT oi.quantity, f.name, f.price
                FROM order_items oi
                JOIN food_items f ON oi.food_id = f.id
                WHERE oi.order_id = ? AND f.owner_id = ?
            `, [order.id, req.user.id]);
            order.items = items;

            // fetch customer info
            const [cust] = await db.query('SELECT name, email, phone FROM users WHERE id = ?', [order.user_id]);
            if (cust.length > 0) order.customer = cust[0];

            if (order.delivery_boy_id) {
                const [boy] = await db.query('SELECT name, phone FROM delivery_boys WHERE id = ?', [order.delivery_boy_id]);
                if (boy.length > 0) order.delivery_boy = boy[0];
            }
        }
        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign delivery boy (Owner)
router.put('/:id/assign', verifyToken, isOwner, async (req, res) => {
    try {
        const { deliveryBoyId } = req.body;
        await db.query('UPDATE orders SET delivery_boy_id = ?, status = "Preparing" WHERE id = ?', [deliveryBoyId, req.params.id]);
        res.json({ message: 'Delivery boy assigned and status updated to Preparing' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Status Generic (Owner)
router.put('/:id/status', verifyToken, isOwner, async (req, res) => {
    try {
        const { status } = req.body;
        await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: `Order status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Cancel Order (User/Customer)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        // Can only cancel if Pending or Accepted
        const [orders] = await db.query('SELECT status FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });

        if (orders[0].status !== 'Pending' && orders[0].status !== 'Accepted') {
            return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
        }

        await db.query('UPDATE orders SET status = "Cancelled" WHERE id = ?', [req.params.id]);
        res.json({ message: 'Order cancelled successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
