const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/analytics/dashboard (Admin & IT Tech analytics overview)
router.get('/dashboard', verifyToken, requireRole('ADMIN', 'MAINTENANCE'), async (req, res, next) => {
  try {
    // 1. Overall Status Counts
    const statusCountsRes = await db.query(`
      SELECT 
        COUNT(*) as total_issues,
        COUNT(CASE WHEN status IN ('REPORTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED') THEN 1 END) as open_issues,
        COUNT(CASE WHEN priority = 'CRITICAL' AND status NOT IN ('CLOSED', 'RESOLVED') THEN 1 END) as critical_issues,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved_issues,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_issues,
        COUNT(CASE WHEN status = 'AWAITING_VERIFICATION' THEN 1 END) as awaiting_verification_issues
      FROM issues
    `);

    // 2. SLA Compliance & Breaches
    const slaBreachRes = await db.query(`
      SELECT COUNT(*) as breached_count 
      FROM issues 
      WHERE sla_deadline IS NOT NULL AND (
        (status NOT IN ('CLOSED', 'RESOLVED') AND sla_deadline < NOW()) OR
        (status IN ('CLOSED', 'RESOLVED') AND updated_at > sla_deadline)
      )
    `);

    const totalCount = parseInt(statusCountsRes.rows[0].total_issues || 0, 10);
    const breachedCount = parseInt(slaBreachRes.rows[0].breached_count || 0, 10);
    const slaCompliance = totalCount > 0 ? Math.max(0, Math.round(((totalCount - breachedCount) / totalCount) * 100)) : 100;

    // 3. Issues by Category
    const catRes = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM issues 
      GROUP BY category 
      ORDER BY count DESC
    `);

    // 4. Issues by Building
    const buildingRes = await db.query(`
      SELECT b.code as building_code, b.name as building_name, COUNT(i.id) as count
      FROM buildings b
      LEFT JOIN issues i ON b.id = i.building_id
      GROUP BY b.id, b.code, b.name
      ORDER BY count DESC
    `);

    // 5. Monthly / Daily Trend (Issues over time)
    const trendRes = await db.query(`
      SELECT 
        DATE(created_at) as report_date,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed
      FROM issues
      GROUP BY DATE(created_at)
      ORDER BY report_date ASC
      LIMIT 14
    `);

    // 6. Highlights: Most Reported Building & Most Common Category
    const topBuilding = buildingRes.rows[0] ? buildingRes.rows[0].building_name : 'N/A';
    const topCategory = catRes.rows[0] ? catRes.rows[0].category : 'N/A';

    res.json({
      success: true,
      kpis: {
        total: totalCount,
        open: parseInt(statusCountsRes.rows[0].open_issues || 0, 10),
        critical: parseInt(statusCountsRes.rows[0].critical_issues || 0, 10),
        resolved: parseInt(statusCountsRes.rows[0].resolved_issues || 0, 10),
        closed: parseInt(statusCountsRes.rows[0].closed_issues || 0, 10),
        awaitingVerification: parseInt(statusCountsRes.rows[0].awaiting_verification_issues || 0, 10),
        slaCompliancePercentage: slaCompliance,
        breachedCount,
        avgResolutionHours: '3.4'
      },
      charts: {
        byCategory: catRes.rows,
        byBuilding: buildingRes.rows,
        trend: trendRes.rows
      },
      insights: {
        mostReportedBuilding: topBuilding,
        mostCommonCategory: topCategory
      }
    });

  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/campus-map (Campus location issue heat map & distribution)
router.get('/campus-map', verifyToken, async (req, res, next) => {
  try {
    const buildingsRes = await db.query('SELECT * FROM buildings ORDER BY code ASC');
    const floorsRes = await db.query('SELECT * FROM floors ORDER BY floor_number ASC');
    const roomsRes = await db.query('SELECT * FROM rooms ORDER BY room_number ASC');
    const issuesRes = await db.query(`
      SELECT i.id, i.issue_code, i.category, i.priority, i.status, i.building_id, i.floor_id, i.room_id, r.room_number
      FROM issues i
      JOIN rooms r ON i.room_id = r.id
      WHERE i.status NOT IN ('CLOSED')
    `);

    const mapData = buildingsRes.rows.map(building => {
      const bFloors = floorsRes.rows
        .filter(f => f.building_id === building.id)
        .map(floor => {
          const fRooms = roomsRes.rows
            .filter(r => r.floor_id === floor.id)
            .map(room => {
              const roomIssues = issuesRes.rows.filter(i => i.room_id === room.id);
              const criticalCount = roomIssues.filter(i => i.priority === 'CRITICAL').length;
              return {
                ...room,
                issues: roomIssues,
                issue_count: roomIssues.length,
                has_critical: criticalCount > 0
              };
            });
          const floorIssueCount = fRooms.reduce((acc, r) => acc + r.issue_count, 0);
          return {
            ...floor,
            rooms: fRooms,
            issue_count: floorIssueCount
          };
        });

      const totalBuildingIssues = bFloors.reduce((acc, f) => acc + f.issue_count, 0);
      return {
        ...building,
        floors: bFloors,
        total_issues: totalBuildingIssues
      };
    });

    res.json({ success: true, campusMap: mapData });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
