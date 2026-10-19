const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET /api/notifications - Get current user notifications
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );

    const unreadCount = result.rows.filter(n => !n.is_read).length;

    res.json({
      success: true,
      unreadCount,
      notifications: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read - Mark single or all notifications as read
router.patch('/:id/read', verifyToken, async (req, res, next) => {
  try {
    if (req.params.id === 'all') {
      await db.query(`UPDATE notifications SET is_read = true WHERE user_id = $1`, [req.user.id]);
    } else {
      await db.query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    }
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
