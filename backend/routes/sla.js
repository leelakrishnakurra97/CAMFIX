const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/sla/rules - Get configured SLA rules
router.get('/rules', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM sla_rules ORDER BY category, resolution_hours ASC');
    res.json({ success: true, rules: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/sla/rules - Create/Update SLA Rule (Admin)
router.post('/rules', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { category, severity, resolution_hours, warning_hours } = req.body;

    if (!category || !severity || !resolution_hours) {
      return res.status(400).json({ success: false, error: 'Category, severity, and resolution hours are required.' });
    }

    const warn = warning_hours || Math.round(resolution_hours * 0.25);

    const existing = await db.query(
      'SELECT id FROM sla_rules WHERE LOWER(category) = LOWER($1) AND LOWER(severity) = LOWER($2)',
      [category, severity]
    );

    if (existing.rows.length > 0) {
      await db.query(
        'UPDATE sla_rules SET resolution_hours = $1, warning_hours = $2 WHERE id = $3',
        [resolution_hours, warn, existing.rows[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO sla_rules (category, severity, resolution_hours, warning_hours) VALUES ($1, $2, $3, $4)',
        [category, severity, resolution_hours, warn]
      );
    }

    res.json({ success: true, message: 'SLA rule configured successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sla/breaches - Get SLA breached and near-breach issues
router.get('/breaches', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT i.id, i.issue_code, i.category, i.priority, i.status, i.sla_deadline, i.created_at,
             b.code as building_code, r.room_number,
             t.name as team_name, tech.name as technician_name
      FROM issues i
      LEFT JOIN buildings b ON i.building_id = b.id
      LEFT JOIN rooms r ON i.room_id = r.id
      LEFT JOIN assignments ass ON i.id = ass.issue_id
      LEFT JOIN maintenance_teams t ON ass.team_id = t.id
      LEFT JOIN users tech ON ass.technician_id = tech.id
      WHERE i.status NOT IN ('CLOSED', 'RESOLVED')
        AND i.sla_deadline IS NOT NULL
        AND i.sla_deadline <= NOW()
      ORDER BY i.sla_deadline ASC
    `);

    res.json({ success: true, breached_issues: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
