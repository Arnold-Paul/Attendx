// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const authRoutes          = require('./routes/auth');
const userRoutes          = require('./routes/users');
const courseRoutes        = require('./routes/courses');
const sessionRoutes       = require('./routes/sessions');
const attendanceRoutes    = require('./routes/attendance');
const notificationRoutes  = require('./routes/notifications');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/courses',       courseRoutes);
app.use('/api/sessions',      sessionRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AttendX API is running' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n  AttendX API running on http://localhost:${PORT}\n`);
});