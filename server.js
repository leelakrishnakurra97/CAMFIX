const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const db = require('./backend/config/db');
const seed = require('./backend/database/seed');
const errorHandler = require('./backend/middleware/errorHandler');

// Route imports
const authRoutes = require('./backend/routes/auth');
const usersRoutes = require('./backend/routes/users');
const buildingsRoutes = require('./backend/routes/buildings');
const assetsRoutes = require('./backend/routes/assets');
const issuesRoutes = require('./backend/routes/issues');
const assignmentsRoutes = require('./backend/routes/assignments');
const slaRoutes = require('./backend/routes/sla');
const notificationsRoutes = require('./backend/routes/notifications');
const analyticsRoutes = require('./backend/routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/buildings', buildingsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Fallback SPA Route
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handler
app.use(errorHandler);

// Server startup
async function startServer() {
  try {
    console.log('⚡ Initializing CAMFIX Server...');
    await seed(); // Runs schema DDL and seeds data if DB empty

    app.listen(PORT, () => {
      console.log(`🚀 CAMFIX Platform is running at http://localhost:${PORT}`);
      console.log(` Campus Issue Reporting & Resolution Engine Operational.`);
    });
  } catch (err) {
    console.error('❌ Failed to start CAMFIX server:', err);
    process.exit(1);
  }
}

startServer();
