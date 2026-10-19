/**
 * CAMFIX Smart Department Assignment Router & SLA Deadline Calculator
 */

const db = require('../config/db');

/**
 * Find best maintenance team based on issue category
 */
async function autoAssignTeam(category) {
  try {
    const teams = await db.query('SELECT * FROM maintenance_teams');
    const catLower = (category || '').toLowerCase();

    let matchedTeam = teams.rows.find(t => t.category_specialty.toLowerCase() === catLower);

    if (!matchedTeam) {
      if (catLower.includes('electric') || catLower.includes('light')) {
        matchedTeam = teams.rows.find(t => t.name.includes('Electrical'));
      } else if (catLower.includes('plumb') || catLower.includes('water') || catLower.includes('washroom')) {
        matchedTeam = teams.rows.find(t => t.name.includes('Plumbing'));
      } else if (catLower.includes('hvac') || catLower.includes('ac') || catLower.includes('fan')) {
        matchedTeam = teams.rows.find(t => t.name.includes('HVAC'));
      } else if (catLower.includes('projector') || catLower.includes('it') || catLower.includes('network') || catLower.includes('av')) {
        matchedTeam = teams.rows.find(t => t.name.includes('IT'));
      } else {
        matchedTeam = teams.rows.find(t => t.name.includes('Facilities')) || teams.rows[0];
      }
    }

    return matchedTeam || null;
  } catch (err) {
    console.error('Auto assignment error:', err);
    return null;
  }
}

/**
 * Calculate SLA deadline timestamp based on rules table
 */
async function calculateSlaDeadline(category, severity) {
  try {
    const rules = await db.query(
      `SELECT * FROM sla_rules WHERE LOWER(category) = LOWER($1) AND LOWER(severity) = LOWER($2)`,
      [category, severity]
    );

    let hours = 24; // Default SLA fallback (24 hours)

    if (rules.rows.length > 0) {
      hours = rules.rows[0].resolution_hours;
    } else {
      // Fallback heuristics
      const sevUpper = (severity || '').toUpperCase();
      if (sevUpper === 'CRITICAL') hours = 1;
      else if (sevUpper === 'HIGH') hours = 4;
      else if (sevUpper === 'MEDIUM') hours = 12;
      else hours = 48;
    }

    const deadline = new Date(Date.now() + hours * 60 * 60 * 1000);
    return deadline.toISOString();
  } catch (err) {
    console.error('SLA calculation error:', err);
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
}

module.exports = {
  autoAssignTeam,
  calculateSlaDeadline
};
