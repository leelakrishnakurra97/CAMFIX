const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/assignments - List assignments
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT ass.*, i.issue_code, i.category, i.priority, i.status as issue_status,
             t.name as team_name, tech.name as technician_name, admin.name as assigned_by_name
      FROM assignments ass
      JOIN issues i ON ass.issue_id = i.id
      LEFT JOIN maintenance_teams t ON ass.team_id = t.id
      LEFT JOIN users tech ON ass.technician_id = tech.id
      LEFT JOIN users admin ON ass.assigned_by = admin.id
      ORDER BY ass.assigned_at DESC
    `);
    res.json({ success: true, assignments: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/assignments - Admin assign team/tech to issue
router.post('/', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { issue_id, team_id, technician_id } = req.body;

    if (!issue_id || (!team_id && !technician_id)) {
      return res.status(400).json({ success: false, error: 'Issue ID and team or technician are required.' });
    }

    const existing = await db.query('SELECT id FROM assignments WHERE issue_id = $1', [issue_id]);

    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE assignments SET team_id = $1, technician_id = $2, assigned_by = $3, assigned_at = NOW(), status = 'ASSIGNED' WHERE issue_id = $4`,
        [team_id || null, technician_id || null, req.user.id, issue_id]
      );
    } else {
      await db.query(
        `INSERT INTO assignments (issue_id, team_id, technician_id, assigned_by, status) VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
        [issue_id, team_id || null, technician_id || null, req.user.id]
      );
    }

    await db.query(`UPDATE issues SET status = 'ASSIGNED', updated_at = NOW() WHERE id = $1`, [issue_id]);

    await db.query(
      `INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [issue_id, req.user.id, req.user.name, 'MANUAL_ASSIGNMENT', 'REPORTED', 'ASSIGNED', 'Assigned manually by Administrator']
    );

    res.json({ success: true, message: 'Assignment saved successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
