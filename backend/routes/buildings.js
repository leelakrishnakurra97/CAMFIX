const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/buildings - Get all buildings with floors and rooms
router.get('/', async (req, res, next) => {
  try {
    const buildingsRes = await db.query('SELECT * FROM buildings ORDER BY code ASC');
    const floorsRes = await db.query('SELECT * FROM floors ORDER BY floor_number ASC');
    const roomsRes = await db.query('SELECT * FROM rooms ORDER BY room_number ASC');

    const buildings = buildingsRes.rows.map(b => {
      const bFloors = floorsRes.rows
        .filter(f => f.building_id === b.id)
        .map(f => {
          const fRooms = roomsRes.rows.filter(r => r.floor_id === f.id);
          return { ...f, rooms: fRooms };
        });
      return { ...b, floors: bFloors };
    });

    res.json({ success: true, buildings });
  } catch (err) {
    next(err);
  }
});

// POST /api/buildings (Admin)
router.post('/', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { code, name, description } = req.body;
    const result = await db.query(
      'INSERT INTO buildings (code, name, description) VALUES ($1, $2, $3) RETURNING *',
      [code, name, description]
    );
    res.status(201).json({ success: true, building: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/buildings/:id/floors (Admin)
router.post('/:id/floors', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { floor_number, name } = req.body;
    const result = await db.query(
      'INSERT INTO floors (building_id, floor_number, name) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, floor_number, name]
    );
    res.status(201).json({ success: true, floor: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/buildings/floors/:floorId/rooms (Admin)
router.post('/floors/:floorId/rooms', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { room_number, name } = req.body;
    const result = await db.query(
      'INSERT INTO rooms (floor_id, room_number, name) VALUES ($1, $2, $3) RETURNING *',
      [req.params.floorId, room_number, name]
    );
    res.status(201).json({ success: true, room: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
