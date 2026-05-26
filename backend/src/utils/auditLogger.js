const AuditLog = require('../models/AuditLog');

/**
 * Log audit events to database
 * @param {String} action The event type (e.g. 'LOGIN', 'SOS_TRIGGERED', 'SPOOF_DETECTED')
 * @param {ObjectId|null} performedBy User ID of initiator
 * @param {Object|null} req Express req object for IP and User-Agent parsing (optional)
 * @param {Object|null} details Extra key-value pairs of details
 */
const logAudit = async (action, performedBy, req, details) => {
  try {
    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      userAgent = req.headers['user-agent'] || '';
    }

    await AuditLog.create({
      action,
      performedBy: performedBy || null,
      ipAddress,
      userAgent,
      details,
    });
    console.log(`[AUDIT] Action: ${action} | User: ${performedBy || 'System'}`);
  } catch (error) {
    console.error('Audit logging failed:', error.message);
  }
};

module.exports = { logAudit };
