const bcrypt = require('bcryptjs');
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

async function seed() {
  console.log(' Starting database initialization and seeding...');

  try {
    await db.initDb();

    // Read and run DDL schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.exec(schemaSql);
    console.log(' Schema created successfully.');

    // Check if seeded already
    const checkUsers = await db.query('SELECT COUNT(*) as count FROM users');
    const count = parseInt(checkUsers.rows[0].count, 10);
    if (count > 0) {
      console.log(` Database already seeded (${count} users found). Skipping duplicate seed.`);
      return;
    }

    // Password Hash for all demo accounts: 'password123'
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Roles
    await db.query(`INSERT INTO roles (name, description) VALUES 
      ('STUDENT', 'Campus Student User'),
      ('MAINTENANCE', 'Campus Maintenance Staff Technician'),
      ('ADMIN', 'Campus Facility & System Administrator')
    `);

    // 2. Maintenance Teams
    const electricalTeam = await db.query(`INSERT INTO maintenance_teams (name, category_specialty, description) VALUES ('Electrical Team', 'Electrical', 'Handles electrical, wiring, lighting, and power outlets') RETURNING id`);
    const plumbingTeam = await db.query(`INSERT INTO maintenance_teams (name, category_specialty, description) VALUES ('Plumbing Team', 'Plumbing', 'Handles water leaks, pipes, washroom fixtures, and pumps') RETURNING id`);
    const hvacTeam = await db.query(`INSERT INTO maintenance_teams (name, category_specialty, description) VALUES ('HVAC Team', 'HVAC', 'Handles air conditioning, ventilation, and heating systems') RETURNING id`);
    const itTeam = await db.query(`INSERT INTO maintenance_teams (name, category_specialty, description) VALUES ('IT Team', 'IT/Network', 'Handles projectors, network switches, AV equipment, and IT hardware') RETURNING id`);
    const facilitiesTeam = await db.query(`INSERT INTO maintenance_teams (name, category_specialty, description) VALUES ('Facilities Team', 'Furniture', 'Handles furniture, doors, windows, locks, and structural fixes') RETURNING id`);

    const electTeamId = electricalTeam.rows[0]?.id || 1;
    const plumbTeamId = plumbingTeam.rows[0]?.id || 2;
    const hvacTeamId = hvacTeam.rows[0]?.id || 3;
    const itTeamId = itTeam.rows[0]?.id || 4;
    const facTeamId = facilitiesTeam.rows[0]?.id || 5;

    // 3. Users
    const demoUsers = [
      ['Alex Rivera', 'student@campus.edu', passwordHash, 'STUDENT', null],
      ['Sarah Chen', 'student2@campus.edu', passwordHash, 'STUDENT', null],
      ['Mike Electrician', 'tech.electrical@campus.edu', passwordHash, 'MAINTENANCE', electTeamId],
      ['David Tech', 'tech.it@campus.edu', passwordHash, 'MAINTENANCE', itTeamId],
      ['Tom HVAC', 'tech.hvac@campus.edu', passwordHash, 'MAINTENANCE', hvacTeamId],
      ['Campus Admin', 'admin@campus.edu', passwordHash, 'ADMIN', null]
    ];

    for (const u of demoUsers) {
      await db.query(
        'INSERT INTO users (name, email, password_hash, role, team_id) VALUES ($1, $2, $3, $4, $5)',
        u
      );
    }

    console.log(' Users and Maintenance Teams seeded.');

    // 4. Buildings
    const b1 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('AB-1', 'Academic Block 1', 'Engineering & Technology Building') RETURNING id`);
    const b2 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('AB-2', 'Academic Block 2', 'Sciences & Innovation Building') RETURNING id`);
    const b3 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('MB', 'Main Building', 'Administrative & Central Offices') RETURNING id`);
    const b4 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('LIBRARY', 'Central Library', 'Library, Study Halls & Digital Labs') RETURNING id`);
    const b5 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('HOSTEL', 'Student Hostel Complex', 'Residential Block A & B') RETURNING id`);
    const b6 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('SJT', 'Silver Jubilee Tower', 'Academic & Research Tower') RETURNING id`);
    const b7 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('PRP', 'PRP Building', 'Engineering & Technology Block') RETURNING id`);
    const b8 = await db.query(`INSERT INTO buildings (code, name, description) VALUES ('SMV', 'SMV Building', 'Sciences & Humanities Building') RETURNING id`);

    const ab1Id = b1.rows[0]?.id || 1;
    const ab2Id = b2.rows[0]?.id || 2;
    const mbId = b3.rows[0]?.id || 3;
    const libId = b4.rows[0]?.id || 4;
    const hostelId = b5.rows[0]?.id || 5;

    const b1Res = await db.query("SELECT id FROM buildings WHERE code = 'AB-1'");
    const b2Res = await db.query("SELECT id FROM buildings WHERE code = 'AB-2'");
    const b3Res = await db.query("SELECT id FROM buildings WHERE code = 'MB'");
    const b4Res = await db.query("SELECT id FROM buildings WHERE code = 'LIBRARY'");
    const b5Res = await db.query("SELECT id FROM buildings WHERE code = 'HOSTEL'");
    const b6Res = await db.query("SELECT id FROM buildings WHERE code = 'SJT'");
    const b7Res = await db.query("SELECT id FROM buildings WHERE code = 'PRP'");
    const b8Res = await db.query("SELECT id FROM buildings WHERE code = 'SMV'");

    const allBldgRows = await db.query("SELECT id, code FROM buildings");
    
    // 5. Floors 0 to 10 for all buildings
    for (const bldg of allBldgRows.rows) {
      for (let fNum = 0; fNum <= 10; fNum++) {
        const fName = fNum === 0 ? 'Ground Floor' : `Floor ${fNum}`;
        await db.query(
          "INSERT INTO floors (building_id, floor_number, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [bldg.id, fNum, fName]
        );
      }
    }

    const fl_ab2_3 = await db.query(`SELECT id FROM floors WHERE building_id = $1 AND floor_number = 3`, [b2.rows[0]?.id || 2]);
    const fl_ab1_1 = await db.query(`SELECT id FROM floors WHERE building_id = $1 AND floor_number = 1`, [b1.rows[0]?.id || 1]);
    const fl_mb_1 = await db.query(`SELECT id FROM floors WHERE building_id = $1 AND floor_number = 1`, [b3.rows[0]?.id || 3]);
    const fl_lib_2 = await db.query(`SELECT id FROM floors WHERE building_id = $1 AND floor_number = 2`, [b4.rows[0]?.id || 4]);
    const fl_hostel_1 = await db.query(`SELECT id FROM floors WHERE building_id = $1 AND floor_number = 0`, [b5.rows[0]?.id || 5]);

    const ab2_fl3 = fl_ab2_3.rows[0]?.id || 1;
    const ab1_fl1 = fl_ab1_1.rows[0]?.id || 2;
    const mb_fl1 = fl_mb_1.rows[0]?.id || 3;
    const lib_fl2 = fl_lib_2.rows[0]?.id || 4;
    const hostel_fl1 = fl_hostel_1.rows[0]?.id || 5;

    // 6. Rooms
    const rm_ab2_305 = await db.query(`INSERT INTO rooms (floor_id, room_number, name) VALUES (${ab2_fl3}, '305', 'Lecture Hall 305') RETURNING id`);
    const rm_ab2_306 = await db.query(`INSERT INTO rooms (floor_id, room_number, name) VALUES (${ab2_fl3}, '306', 'Computer Lab 306') RETURNING id`);
    const rm_ab1_102 = await db.query(`INSERT INTO rooms (floor_id, room_number, name) VALUES (${ab1_fl1}, '102', 'Seminar Hall 102') RETURNING id`);
    const rm_mb_101 = await db.query(`INSERT INTO rooms (floor_id, room_number, name) VALUES (${mb_fl1}, '101', 'Reception Lobby') RETURNING id`);
    const rm_lib_201 = await db.query(`INSERT INTO rooms (floor_id, room_number, name) VALUES (${lib_fl2}, '201', 'Reading Room A') RETURNING id`);
    const rm_hostel_a10 = await db.query(`INSERT INTO rooms (floor_id, room_number, name) VALUES (${hostel_fl1}, 'A-10', 'Washroom Block A') RETURNING id`);

    const r_305 = rm_ab2_305.rows[0]?.id || 1;
    const r_306 = rm_ab2_306.rows[0]?.id || 2;
    const r_102 = rm_ab1_102.rows[0]?.id || 3;
    const r_101 = rm_mb_101.rows[0]?.id || 4;
    const r_201 = rm_lib_201.rows[0]?.id || 5;
    const r_a10 = rm_hostel_a10.rows[0]?.id || 6;

    // 7. Assets with QR Data
    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'qrcodes');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const assetsData = [
      { id: 'AB2-305-P01', name: 'UltraHD Overhead Projector', category: 'Projector/AV', room_id: r_305 },
      { id: 'AB2-305-AC1', name: 'Dual Inverter AC Unit', category: 'HVAC', room_id: r_305 },
      { id: 'AB2-306-E01', name: 'Main Power Outlet Distribution Box', category: 'Electrical', room_id: r_306 },
      { id: 'AB1-102-L01', name: 'Ceiling Lighting Panel', category: 'Electrical', room_id: r_102 },
      { id: 'MB-101-W01', name: 'RO Water Dispenser & Cooler', category: 'Plumbing', room_id: r_101 },
      { id: 'LIB-201-F01', name: 'High-Speed Ceiling Fan', category: 'Furniture', room_id: r_201 }
    ];

    const insertedAssets = [];
    for (const a of assetsData) {
      // Generate QR Code image file
      const qrFilename = `${a.id}.png`;
      const qrPath = path.join(uploadsDir, qrFilename);
      const qrUrl = `/uploads/qrcodes/${qrFilename}`;

      const qrPayload = JSON.stringify({
        asset_id: a.id,
        name: a.name,
        category: a.category
      });

      await QRCode.toFile(qrPath, qrPayload, { width: 300, margin: 2 });

      const res = await db.query(`INSERT INTO assets (asset_id, name, category, room_id, qr_code_data, is_active) 
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [a.id, a.name, a.category, a.room_id, a.id, true]
      );
      insertedAssets.push({ ...a, dbId: res.rows[0]?.id });
    }

    console.log(' Campus Assets & QR Codes generated.');

    // 8. SLA Rules
    await db.query(`INSERT INTO sla_rules (category, severity, resolution_hours, warning_hours) VALUES
      ('Electrical', 'Critical', 1, 0.5),
      ('Electrical', 'High', 4, 1),
      ('Plumbing', 'Critical', 1, 0.5),
      ('Plumbing', 'High', 2, 0.5),
      ('HVAC', 'High', 8, 2),
      ('Projector/AV', 'High', 6, 1.5),
      ('IT/Network', 'Medium', 12, 3),
      ('Washroom', 'High', 4, 1),
      ('Safety', 'Critical', 1, 0.5),
      ('Furniture', 'Low', 48, 12)
    `);

    // 9. Initial Seed Issues for immediate visual richness
    const projectorAsset = insertedAssets.find(a => a.id === 'AB2-305-P01');
    const elecAsset = insertedAssets.find(a => a.id === 'AB2-306-E01');
    const waterAsset = insertedAssets.find(a => a.id === 'MB-101-W01');
    const fanAsset = insertedAssets.find(a => a.id === 'LIB-201-F01');
    const flushAsset = insertedAssets.find(a => a.id === 'HOSTEL-A10-W01');

    // Issue 1: Exposed Electrical Wire (CRITICAL) - IN_PROGRESS by Mike Electrician
    const issue1Sla = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins left (Approaching Deadline)
    const iss1 = await db.query(`INSERT INTO issues (
      issue_code, student_id, asset_id, building_id, floor_id, room_id, category, severity, priority, priority_reason,
      description, status, sla_deadline, before_image_url
    ) VALUES (
      '#1001', 1, ${elecAsset.dbId}, ${ab2Id}, ${ab2_fl3}, ${r_306}, 'Electrical', 'Critical', 'CRITICAL',
      'Safety hazard: Exposed high-voltage electrical wires sparking near computer workstation',
      'Exposed live wire detected near Lab 306 rack 4. Sparks visible.', 'IN_PROGRESS', '${issue1Sla}', '/uploads/sample_electrical.jpg'
    ) RETURNING id`);

    const iss1Id = iss1.rows[0]?.id || 1;
    await db.query(`INSERT INTO assignments (issue_id, team_id, technician_id, assigned_by, status) VALUES (${iss1Id}, ${electTeamId}, 3, 6, 'ACCEPTED')`);
    await db.query(`INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes) VALUES 
      (${iss1Id}, 1, 'Alex Rivera', 'REPORTED', NULL, 'REPORTED', 'Issue reported by student'),
      (${iss1Id}, 6, 'Campus Admin', 'ASSIGNED', 'REPORTED', 'ASSIGNED', 'Assigned to Electrical Team'),
      (${iss1Id}, 3, 'Mike Electrician', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'Technician accepted assignment and arrived on site')
    `);

    // Issue 2: Water Leakage (HIGH) - VERIFIED, assigned to Plumbing Team
    const issue2Sla = new Date(Date.now() + 90 * 60 * 1000).toISOString(); // 1.5 hrs left (On Track)
    const iss2 = await db.query(`INSERT INTO issues (
      issue_code, student_id, asset_id, building_id, floor_id, room_id, category, severity, priority, priority_reason,
      description, status, sla_deadline, before_image_url
    ) VALUES (
      '#1002', 2, ${waterAsset.dbId}, ${mbId}, ${mb_fl1}, ${r_101}, 'Plumbing', 'High', 'HIGH',
      'High operational impact: Continuous water overflow in reception lobby',
      'Water dispenser leaking rapidly onto marble floor creating slip hazard.', 'VERIFIED', '${issue2Sla}', '/uploads/sample_plumbing.jpg'
    ) RETURNING id`);

    // Issue 3: Flush malfunction in Hostel (HIGH) - AWAITING_VERIFICATION
    const iss3 = await db.query(`INSERT INTO issues (
      issue_code, student_id, asset_id, building_id, floor_id, room_id, category, severity, priority, priority_reason,
      description, status, before_image_url, after_image_url
    ) VALUES (
      '#1003', 1, ${flushAsset.dbId}, ${hostelId}, ${hostel_fl1}, ${r_a10}, 'Washroom', 'High', 'HIGH',
      'Hygiene & sanitation concern in hostel washroom',
      'Automatic sensor flush failure causing backup in Hostel Block A washroom.', 'AWAITING_VERIFICATION',
      '/uploads/sample_washroom_before.jpg', '/uploads/sample_washroom_after.jpg'
    ) RETURNING id`);
    const iss3Id = iss3.rows[0]?.id || 3;
    await db.query(`INSERT INTO issue_history (issue_id, actor_id, actor_name, action, previous_status, new_status, notes) VALUES 
      (${iss3Id}, 1, 'Alex Rivera', 'REPORTED', NULL, 'REPORTED', 'Reported flush sensor issue'),
      (${iss3Id}, 6, 'Campus Admin', 'ASSIGNED', 'REPORTED', 'ASSIGNED', 'Assigned to Plumbing Team'),
      (${iss3Id}, 3, 'Mike Electrician', 'RESOLVED', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'Replaced solenoid valve and verified flow. Ready for verification.')
    `);

    // 10. Sample Notifications
    await db.query(`INSERT INTO notifications (user_id, title, message, type, issue_id, is_read) VALUES
      (1, 'Verification Needed', 'Issue #1003 (Washroom Flush) has been marked resolved by technician. Please verify outcome.', 'VERIFICATION', ${iss3Id}, false),
      (3, 'Critical Emergency Assigned', 'Critical Issue #1001 (Exposed Wire in AB2-306) assigned to your team.', 'CRITICAL', ${iss1Id}, true),
      (6, 'SLA Warning Alert', 'Issue #1001 (Exposed Wire) is within 30 mins of SLA breach deadline.', 'WARNING', ${iss1Id}, false)
    `);

    console.log(' Demo issues, history, and notifications successfully created.');
    console.log(' Database Seeding Complete!');
    console.log('\n🔐 DEMO ACCOUNTS:');
    console.log('   - Student:     student@campus.edu           / password123');
    console.log('   - Student 2:    student2@campus.edu          / password123');
    console.log('   - Electrical:   tech.electrical@campus.edu   / password123');
    console.log('   - IT Tech:      tech.it@campus.edu           / password123');
    console.log('   - Admin:        admin@campus.edu             / password123');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
