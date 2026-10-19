const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET /api/users (Admin & Maintenance / IT Tech)
router.get('/', verifyToken, requireRole('ADMIN', 'MAINTENANCE'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.team_id, t.name as team_name, u.created_at
       FROM users u
       LEFT JOIN maintenance_teams t ON u.team_id = t.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/teams
router.get('/teams', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM maintenance_teams ORDER BY name ASC');
    res.json({ success: true, teams: result.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id/team (Admin & Maintenance assign team to tech)
router.put('/:id/team', verifyToken, requireRole('ADMIN', 'MAINTENANCE'), async (req, res, next) => {
  try {
    const { team_id } = req.body;
    await db.query('UPDATE users SET team_id = $1 WHERE id = $2', [team_id, req.params.id]);
    res.json({ success: true, message: 'User team updated successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
