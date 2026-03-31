const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isOwner } = require('../middleware/authMiddleware');

// Get all food items
router.get('/', async (req, res) => {
    try {
        const [items] = await db.query('SELECT * FROM food_items');
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get food items by owner
router.get('/owner', verifyToken, isOwner, async (req, res) => {
    try {
        const [items] = await db.query('SELECT * FROM food_items WHERE owner_id = ?', [req.user.id]);
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add new food item (Owner only)
router.post('/', verifyToken, isOwner, async (req, res) => {
    try {
        const { name, price, description, category, type, image } = req.body;

        if (!name || !price || !category || !type) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const [result] = await db.query(
            'INSERT INTO food_items (name, price, description, category, type, image, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, price, description, category, type, image || '', req.user.id]
        );

        res.status(201).json({ message: 'Food item added successfully', itemId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a food item (Owner only)
router.delete('/:id', verifyToken, isOwner, async (req, res) => {
    try {
        // Ensure owner owns this item before deleting
        const [result] = await db.query('DELETE FROM food_items WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Item not found or unauthorized' });
        }
        res.json({ message: 'Food item deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
