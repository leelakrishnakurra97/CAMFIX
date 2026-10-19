const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { generateQrImage } = require('../utils/qrGenerator');

// GET /api/assets - Get all assets with location breakdown
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT a.*, r.room_number, r.name as room_name, f.floor_number, f.name as floor_name, b.code as building_code, b.name as building_name
      FROM assets a
      JOIN rooms r ON a.room_id = r.id
      JOIN floors f ON r.floor_id = f.id
      JOIN buildings b ON f.building_id = b.id
      ORDER BY a.created_at DESC
    `);
    res.json({ success: true, assets: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/assets/qr/:qrCode - Scan QR Code and return complete location context
router.get('/qr/:qrCode', async (req, res, next) => {
  try {
    const qrCode = req.params.qrCode.trim();
    const result = await db.query(`
      SELECT a.*, r.id as room_id, r.room_number, r.name as room_name, 
             f.id as floor_id, f.floor_number, f.name as floor_name, 
             b.id as building_id, b.code as building_code, b.name as building_name
      FROM assets a
      JOIN rooms r ON a.room_id = r.id
      JOIN floors f ON r.floor_id = f.id
      JOIN buildings b ON f.building_id = b.id
      WHERE a.asset_id = $1 OR a.qr_code_data = $1
    `, [qrCode]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'QR Code not found or asset inactive.' });
    }

    const asset = result.rows[0];
    if (!asset.is_active) {
      return res.status(400).json({ success: false, error: 'This asset QR code has been disabled.' });
    }

    res.json({
      success: true,
      asset: {
        id: asset.id,
        asset_id: asset.asset_id,
        name: asset.name,
        category: asset.category,
        building: { id: asset.building_id, code: asset.building_code, name: asset.building_name },
        floor: { id: asset.floor_id, number: asset.floor_number, name: asset.floor_name },
        room: { id: asset.room_id, number: asset.room_number, name: asset.room_name }
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/assets - Admin Create Asset & Generate QR Code
router.post('/', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { asset_id, name, category, room_id } = req.body;

    if (!asset_id || !name || !category || !room_id) {
      return res.status(400).json({ success: false, error: 'Asset ID, name, category, and room are required.' });
    }

    // Check duplicate asset ID
    const existing = await db.query('SELECT id FROM assets WHERE asset_id = $1', [asset_id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Asset ID already exists.' });
    }

    const qrImageUrl = await generateQrImage(asset_id, name, category);

    const result = await db.query(
      `INSERT INTO assets (asset_id, name, category, room_id, qr_code_data, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [asset_id, name, category, room_id, asset_id, true]
    );

    res.status(201).json({
      success: true,
      asset: { ...result.rows[0], qr_image_url: qrImageUrl }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/assets/:id/status - Toggle asset active/disable
router.patch('/:id/status', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE assets SET is_active = $1 WHERE id = $2', [is_active, req.params.id]);
    res.json({ success: true, message: `Asset status updated to ${is_active ? 'Active' : 'Disabled'}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
