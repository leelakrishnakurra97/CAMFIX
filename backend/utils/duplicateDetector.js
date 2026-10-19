/**
 * CAMFIX Duplicate Report Detector
 * Rule-based similarity engine checking asset, location, category, and time window.
 */

const db = require('../config/db');

async function checkForDuplicates(assetId, roomId, category, description = '') {
  try {
    // 1. Search active non-closed issues with same Asset ID
    if (assetId) {
      const assetDupes = await db.query(
        `SELECT i.id, i.issue_code, i.description, i.created_at, i.status, u.name as reporter_name,
                (SELECT COUNT(*) FROM issues d WHERE d.parent_issue_id = i.id OR d.id = i.id) as dupe_count
         FROM issues i
         LEFT JOIN users u ON i.student_id = u.id
         WHERE i.asset_id = $1 
           AND i.status NOT IN ('CLOSED') 
           AND i.is_duplicate = false
         ORDER BY i.created_at ASC
         LIMIT 1`,
        [assetId]
      );

      if (assetDupes.rows.length > 0) {
        const primary = assetDupes.rows[0];
        return {
          isDuplicate: true,
          primaryIssue: {
            id: primary.id,
            issue_code: primary.issue_code,
            status: primary.status,
            created_at: primary.created_at,
            reporter_name: primary.reporter_name,
            total_reports: parseInt(primary.dupe_count || 1, 10)
          },
          reason: `Potential duplicate issue detected. Asset already has active issue ${primary.issue_code}.`
        };
      }
    }

    // 2. Search active issues in same room & category reported in last 24 hours
    if (roomId && category) {
      const roomDupes = await db.query(
        `SELECT i.id, i.issue_code, i.description, i.created_at, i.status, u.name as reporter_name,
                (SELECT COUNT(*) FROM issues d WHERE d.parent_issue_id = i.id OR d.id = i.id) as dupe_count
         FROM issues i
         LEFT JOIN users u ON i.student_id = u.id
         WHERE i.room_id = $1 
           AND LOWER(i.category) = LOWER($2)
           AND i.status NOT IN ('CLOSED')
           AND i.is_duplicate = false
           AND i.created_at >= NOW() - INTERVAL '24 hours'
         ORDER BY i.created_at ASC
         LIMIT 1`,
        [roomId, category]
      );

      if (roomDupes.rows.length > 0) {
        const primary = roomDupes.rows[0];
        return {
          isDuplicate: true,
          primaryIssue: {
            id: primary.id,
            issue_code: primary.issue_code,
            status: primary.status,
            created_at: primary.created_at,
            reporter_name: primary.reporter_name,
            total_reports: parseInt(primary.dupe_count || 1, 10)
          },
          reason: `Potential duplicate issue detected. Room has active ${category} issue ${primary.issue_code}.`
        };
      }
    }

    return {
      isDuplicate: false,
      primaryIssue: null,
      reason: 'No duplicate issue detected.'
    };
  } catch (err) {
    console.error('Duplicate detection error:', err);
    return { isDuplicate: false, primaryIssue: null, reason: 'Error checking duplicates' };
  }
}

module.exports = {
  checkForDuplicates
};
