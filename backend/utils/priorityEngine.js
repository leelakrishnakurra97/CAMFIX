/**
 * CAMFIX Smart Priority Engine
 * Explainable priority calculation based on category, severity, safety hazards, location context, and time.
 */

const SAFETY_KEYWORDS = [
  'wire', 'spark', 'fire', 'smoke', 'electric shock', 'hazard', 'leak',
  'flood', 'elevator', 'trap', 'blocked exit', 'emergency', 'gas', 'glass',
  'collapse', 'exposed', 'short circuit', 'danger'
];

function calculatePriority(category, severity, description = '', roomNumber = '') {
  const descLower = (description || '').toLowerCase();
  const catLower = (category || '').toLowerCase();
  const sevUpper = (severity || 'MEDIUM').toUpperCase();

  let priority = 'MEDIUM';
  let reason = '';

  // 1. Check Safety Hazards (Automatic CRITICAL Priority)
  const matchedSafety = SAFETY_KEYWORDS.filter(kw => descLower.includes(kw));

  if (matchedSafety.length > 0 || sevUpper === 'CRITICAL' || catLower === 'safety') {
    priority = 'CRITICAL';
    const kwText = matchedSafety.length > 0 ? `Safety keywords detected: "${matchedSafety.join(', ')}"` : 'Emergency safety classification';
    reason = `CRITICAL priority assigned: ${kwText}. Immediate hazard response required.`;
    return { priority, reason };
  }

  // 2. High Severity Rules
  if (sevUpper === 'HIGH') {
    if (catLower === 'electrical' || catLower === 'plumbing' || catLower === 'hvac' || catLower === 'washroom') {
      priority = 'HIGH';
      reason = `HIGH priority assigned: Critical facility category (${category}) with high operational impact.`;
    } else if (catLower === 'projector/av' || catLower === 'it/network') {
      priority = 'HIGH';
      reason = `HIGH priority assigned: Classroom/Lab technology failure interrupting instruction.`;
    } else {
      priority = 'HIGH';
      reason = `HIGH priority assigned based on high severity user classification.`;
    }
    return { priority, reason };
  }

  // 3. Medium Severity Rules
  if (sevUpper === 'MEDIUM') {
    if (catLower === 'electrical' || catLower === 'plumbing' || catLower === 'washroom') {
      priority = 'MEDIUM';
      reason = `MEDIUM priority assigned: Essential infrastructure category needing prompt attention.`;
    } else {
      priority = 'MEDIUM';
      reason = `MEDIUM priority assigned for standard maintenance workflow.`;
    }
    return { priority, reason };
  }

  // 4. Low Severity Rules
  priority = 'LOW';
  reason = `LOW priority assigned: Non-urgent cosmetic or routine maintenance request.`;
  return { priority, reason };
}

module.exports = {
  calculatePriority
};
