const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { calculatePriority } = require('../utils/priorityEngine');
const { checkForDuplicates } = require('../utils/duplicateDetector');
const { autoAssignTeam, calculateSlaDeadline } = require('../utils/assignmentEngine');

// Helper to generate issue code (e.g. #1024)
async function generateIssueCode() {
  const result = await db.query('SELECT COUNT(*) as count FROM issues');
  const count = parseInt(result.rows[0].count, 10) + 1001;
  return `#${count}`;
}

// POST /api/issues - Submit Issue Report
router.post('/', verifyToken, upload.single('image'), async (req, res, next) => {
  try {
    const { category, severity, description, asset_id, building_id, floor_id, room_id, custom_asset, additional_notes } = req.body;
    const student_id = req.user.id;

    if (!category || !severity || !description || !building_id || !floor_id || !room_id) {
      return res.status(400).json({ success: false, error: 'Category, severity, description, building, floor, and room are required.' });
    }

    // Resolve room_id if passed as room number text string
    let finalRoomId = null;
    const parsedRoomId = parseInt(room_id, 10);

    // Check if parsedRoomId is a valid room id in database
    let roomCheck = null;
    if (!isNaN(parsedRoomId)) {
      roomCheck = await db.query('SELECT id FROM rooms WHERE id = $1', [parsedRoomId]);
    }

    if (roomCheck && roomCheck.rows.length > 0) {
      finalRoomId = roomCheck.rows[0].id;
    } else {
      // Find or create room entry under floor_id
      const roomStr = String(room_id).trim();
      const existingRoom = await db.query(
        'SELECT id FROM rooms WHERE floor_id = $1 AND (LOWER(room_number) = LOWER($2) OR LOWER(name) = LOWER($2)) LIMIT 1',
        [floor_id, roomStr]
      );
      if (existingRoom.rows.length > 0) {
        finalRoomId = existingRoom.rows[0].id;
      } else {
        const newRoom = await db.query(
          'INSERT INTO rooms (floor_id, room_number, name) VALUES ($1, $2, $3) RETURNING id',
          [floor_id, roomStr, `Room ${roomStr}`]
        );
        finalRoomId = newRoom.rows[0].id;
      }
    }

    const before_image_url = req.file ? `/uploads/${req.file.filename}` : null;

    let fullDescription = description;
    if (custom_asset) {
      fullDescription += `\n[Asset: ${custom_asset}]`;
    }
    if (additional_notes) {
      fullDescription += `\nNotes: ${additional_notes}`;
    }

    // 1. Calculate Explainable Priority
    const { priority, reason: priority_reason } = calculatePriority(category, severity, fullDescription);

    // 2. Check Duplicate Issue Engine
    const duplicateCheck = await checkForDuplicates(asset_id || null, finalRoomId, category, fullDescription);

    // 3. Auto-assign Department Team
    const assignedTeam = await autoAssignTeam(category);

    // 4. Calculate SLA Deadline
    const sla_deadline = await calculateSlaDeadline(category, severity);

    // 5. Create Issue Code
    const issue_code = await generateIssueCode();
    const initialStatus = duplicateCheck.isDuplicate ? 'VERIFIED' : 'REPORTED';

    const insertRes = await db.query(
      `INSERT INTO issues (
        issue_code, student_id, asset_id, building_id, floor_id, room_id, category, severity,
        priority, priority_reason, description, before_image_url, status, is_duplicate,
        parent_issue_id, sla_deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        issue_code, student_id, asset_id || null, building_id, floor_id, finalRoomId, category, severity,
        priority, priority_reason, fullDescription,
        before_image_url, initialStatus, duplicateCheck.isDuplicate,
        duplicateCheck.isDuplicate ? duplicateCheck.primaryIssue.id : null, sla_deadline
      ]
    );

    const issue = insertRes.rows[0];

    // 6. Record Initial History
    await db.query(
      `INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [issue.id, student_id, req.user.name, 'REPORTED', null, initialStatus, `Report submitted by ${req.user.name}`]
    );

    // 7. Auto-Create Assignment if team matched
    if (assignedTeam && !duplicateCheck.isDuplicate) {
      await db.query(
        `INSERT INTO assignments (issue_id, team_id, status) VALUES ($1, $2, 'ASSIGNED')`,
        [issue.id, assignedTeam.id]
      );
      
      await db.query(
        `UPDATE issues SET status = 'ASSIGNED' WHERE id = $1`,
        [issue.id]
      );

      await db.query(
        `INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [issue.id, null, 'CAMFIX Engine', 'AUTO_ASSIGNED', initialStatus, 'ASSIGNED', `Auto-assigned to ${assignedTeam.name}`]
      );
    }

    // 8. Emergency Escalation Notifications
    if (priority === 'CRITICAL') {
      // Notify admins & maintenance leads
      const admins = await db.query(`SELECT id FROM users WHERE role IN ('ADMIN', 'MAINTENANCE')`);
      for (const admin of admins.rows) {
        await db.query(
          `INSERT INTO notifications (user_id, title, message, type, issue_id) VALUES ($1, $2, $3, $4, $5)`,
          [
            admin.id,
            ` EMERGENCY CRITICAL ISSUE ${issue_code}`,
            `CRITICAL priority issue reported: "${category}" in building. Priority Reason: ${priority_reason}`,
            'CRITICAL',
            issue.id
          ]
        );
      }
    }

    // Student submission confirmation notification
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, issue_id) VALUES ($1, $2, $3, $4, $5)`,
      [
        student_id,
        `Issue ${issue_code} Submitted`,
        `Your issue report for ${category} has been received and assigned priority ${priority}.`,
        'INFO',
        issue.id
      ]
    );

    res.status(201).json({
      success: true,
      issue,
      duplicateCheck,
      priorityExplanation: { priority, reason: priority_reason }
    });

  } catch (err) {
    next(err);
  }
});

// GET /api/issues - List Issues with Filters
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { status, priority, category, building_id, student_id, team_id, sla, search } = req.query;

    let sql = `
      SELECT i.*, 
             u.name as student_name, u.email as student_email,
             b.code as building_code, b.name as building_name,
             f.floor_number, f.name as floor_name,
             r.room_number, r.name as room_name,
             a.asset_id as asset_code, a.name as asset_name,
             t.name as assigned_team_name, tech.name as technician_name,
             (SELECT COUNT(*) FROM issues dup WHERE dup.parent_issue_id = i.id) as dupe_count
      FROM issues i
      LEFT JOIN users u ON i.student_id = u.id
      LEFT JOIN buildings b ON i.building_id = b.id
      LEFT JOIN floors f ON i.floor_id = f.id
      LEFT JOIN rooms r ON i.room_id = r.id
      LEFT JOIN assets a ON i.asset_id = a.id
      LEFT JOIN assignments ass ON i.id = ass.issue_id
      LEFT JOIN maintenance_teams t ON ass.team_id = t.id
      LEFT JOIN users tech ON ass.technician_id = tech.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by student role restriction
    if (req.user.role === 'STUDENT' && !student_id) {
      params.push(req.user.id);
      sql += ` AND i.student_id = $${params.length}`;
    } else if (student_id) {
      params.push(student_id);
      sql += ` AND i.student_id = $${params.length}`;
    }

    // Maintenance / Control desk sees all incoming student complaints
    if (team_id) {
      params.push(team_id);
      sql += ` AND ass.team_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      sql += ` AND i.priority = $${params.length}`;
    }

    if (category) {
      params.push(category);
      sql += ` AND i.category = $${params.length}`;
    }

    if (building_id) {
      params.push(building_id);
      sql += ` AND i.building_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (i.issue_code ILIKE $${params.length} OR i.description ILIKE $${params.length} OR i.category ILIKE $${params.length})`;
    }

    sql += ` ORDER BY CASE WHEN i.priority = 'CRITICAL' THEN 1 WHEN i.priority = 'HIGH' THEN 2 WHEN i.priority = 'MEDIUM' THEN 3 ELSE 4 END, i.created_at DESC`;

    const result = await db.query(sql, params);

    // Calculate dynamic SLA status for each issue
    const issues = result.rows.map(issue => {
      let slaStatus = 'ON TRACK';
      let timeRemaining = null;

      if (issue.sla_deadline && issue.status !== 'CLOSED' && issue.status !== 'RESOLVED') {
        const now = new Date();
        const deadline = new Date(issue.sla_deadline);
        const diffMs = deadline - now;

        if (diffMs <= 0) {
          slaStatus = 'BREACHED';
        } else if (diffMs <= 2 * 60 * 60 * 1000) { // < 2 hours
          slaStatus = 'APPROACHING DEADLINE';
        }

        const mins = Math.floor(Math.abs(diffMs) / 60000);
        const hrs = Math.floor(mins / 60);
        timeRemaining = diffMs < 0 
          ? `Breached by ${hrs}h ${mins % 60}m` 
          : `${hrs}h ${mins % 60}m left`;
      }

      return {
        ...issue,
        sla_status: slaStatus,
        sla_time_remaining: timeRemaining
      };
    });

    res.json({ success: true, issues });
  } catch (err) {
    next(err);
  }
});

// GET /api/issues/:id - Single Issue Detail & Timeline
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT i.*, 
             u.name as student_name, u.email as student_email,
             b.code as building_code, b.name as building_name,
             f.floor_number, f.name as floor_name,
             r.room_number, r.name as room_name,
             a.asset_id as asset_code, a.name as asset_name, a.qr_code_data,
             ass.team_id, ass.technician_id, t.name as assigned_team_name, tech.name as technician_name
      FROM issues i
      LEFT JOIN users u ON i.student_id = u.id
      LEFT JOIN buildings b ON i.building_id = b.id
      LEFT JOIN floors f ON i.floor_id = f.id
      LEFT JOIN rooms r ON i.room_id = r.id
      LEFT JOIN assets a ON i.asset_id = a.id
      LEFT JOIN assignments ass ON i.id = ass.issue_id
      LEFT JOIN maintenance_teams t ON ass.team_id = t.id
      LEFT JOIN users tech ON ass.technician_id = tech.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    const issue = result.rows[0];

    // Fetch history timeline
    const historyRes = await db.query(
      `SELECT * FROM issue_history WHERE issue_id = $1 ORDER BY timestamp ASC`,
      [req.params.id]
    );

    // Fetch child duplicate issues if any
    const duplicatesRes = await db.query(
      `SELECT id, issue_code, description, created_at, status FROM issues WHERE parent_issue_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      issue,
      timeline: historyRes.rows,
      linkedDuplicates: duplicatesRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/issues/:id/status - Maintenance / Admin update issue status
router.patch('/:id/status', verifyToken, upload.single('resolution_image'), async (req, res, next) => {
  try {
    const { status, notes, priority, team_id, technician_id } = req.body;
    const issueId = req.params.id;

    const issueRes = await db.query('SELECT * FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    const issue = issueRes.rows[0];
    const prevStatus = issue.status;
    let afterImageUrl = issue.after_image_url;

    if (req.file) {
      afterImageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.resolution_url && req.body.resolution_url.trim()) {
      afterImageUrl = req.body.resolution_url.trim();
    }

    let nextStatus = status || prevStatus;
    if (status === 'RESOLVED') {
      nextStatus = 'AWAITING_VERIFICATION'; // Technician marks resolved -> Student must verify
    }

    // Update Issue Table
    await db.query(
      `UPDATE issues 
       SET status = $1, 
           after_image_url = COALESCE($2, after_image_url),
           priority = COALESCE($3, priority),
           updated_at = NOW()
       WHERE id = $4`,
      [nextStatus, afterImageUrl, priority || null, issueId]
    );

    // Update or Create Assignment
    if (team_id || technician_id) {
      const assCheck = await db.query('SELECT id FROM assignments WHERE issue_id = $1', [issueId]);
      if (assCheck.rows.length > 0) {
        await db.query(
          `UPDATE assignments SET team_id = COALESCE($1, team_id), technician_id = COALESCE($2, technician_id) WHERE issue_id = $3`,
          [team_id || null, technician_id || null, issueId]
        );
      } else {
        await db.query(
          `INSERT INTO assignments (issue_id, team_id, technician_id, assigned_by, status) VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
          [issueId, team_id || null, technician_id || null, req.user.id]
        );
      }
    }

    // Audit Trail History
    await db.query(
      `INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [issueId, req.user.id, req.user.name, `STATUS_UPDATE_${nextStatus}`, prevStatus, nextStatus, notes || `Status changed to ${nextStatus}`]
    );

    // Notify Student when marked awaiting verification
    if (nextStatus === 'AWAITING_VERIFICATION') {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, issue_id) VALUES ($1, $2, $3, $4, $5)`,
        [
          issue.student_id,
          `Action Required: Verify Issue ${issue.issue_code}`,
          `Technician has completed resolution work for ${issue.category}. Please review resolution proof and confirm.`,
          'VERIFICATION',
          issueId
        ]
      );
    }

    res.json({
      success: true,
      message: `Issue status updated to ${nextStatus}`,
      after_image_url: afterImageUrl
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/issues/:id/verify - Student Resolution Verification Workflow
router.post('/:id/verify', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { confirmed, reopen_reason } = req.body;
    const issueId = req.params.id;

    const issueRes = await db.query('SELECT * FROM issues WHERE id = $1 AND student_id = $2', [issueId, req.user.id]);
    if (issueRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Issue not found or unauthorized.' });
    }

    const issue = issueRes.rows[0];

    if (confirmed) {
      // Student accepts resolution -> CLOSED
      await db.query(
        `UPDATE issues SET status = 'CLOSED', updated_at = NOW() WHERE id = $1`,
        [issueId]
      );

      await db.query(
        `INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [issueId, req.user.id, req.user.name, 'STUDENT_VERIFIED_CLOSED', issue.status, 'CLOSED', 'Student verified and confirmed issue resolution. Issue officially closed.']
      );

      res.json({ success: true, status: 'CLOSED', message: 'Issue successfully closed.' });
    } else {
      // Student rejects resolution -> REOPENED
      if (!reopen_reason) {
        return res.status(400).json({ success: false, error: 'Reopening reason is required.' });
      }

      await db.query(
        `UPDATE issues SET status = 'REOPENED', reopen_count = reopen_count + 1, reopen_reason = $1, updated_at = NOW() WHERE id = $2`,
        [reopen_reason, issueId]
      );

      await db.query(
        `INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [issueId, req.user.id, req.user.name, 'STUDENT_REOPENED', issue.status, 'REOPENED', `Student rejected resolution. Reason: ${reopen_reason}`]
      );

      // Notify Maintenance Team Lead / Technicians
      const assRes = await db.query('SELECT team_id, technician_id FROM assignments WHERE issue_id = $1', [issueId]);
      if (assRes.rows.length > 0) {
        const { team_id, technician_id } = assRes.rows[0];
        if (technician_id) {
          await db.query(
            `INSERT INTO notifications (user_id, title, message, type, issue_id) VALUES ($1, $2, $3, $4, $5)`,
            [technician_id, `Issue ${issue.issue_code} REOPENED`, `Student rejected resolution proof. Reason: ${reopen_reason}`, 'WARNING', issueId]
          );
        }
      }

      res.json({ success: true, status: 'REOPENED', message: 'Issue reopened for further action.' });
    }

  } catch (err) {
    next(err);
  }
});

module.exports = router;
