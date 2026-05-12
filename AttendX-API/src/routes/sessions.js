// src/routes/sessions.js
const express = require('express');
const prisma  = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Disable caching on all session routes so polling always gets fresh data
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function canManage(user, session) {
  if (user.role === 'LECTURER' || user.role === 'ADMIN') return true;
  if (user.role === 'CLASS_REP') {
    const e = await prisma.courseEnrolment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: session.courseId } },
    });
    return e?.isClassRep === true;
  }
  return false;
}


router.get('/active', async (req, res) => {
  try {
    let sessions;

    if (req.user.role === 'STUDENT' || req.user.role === 'CLASS_REP') {
      const enrolments = await prisma.courseEnrolment.findMany({
        where:  { userId: req.user.id },
        select: { courseId: true },
      });
      const ids = enrolments.map((e) => e.courseId);

      if (ids.length === 0) {
        return res.json({ sessions: [] });
      }

      // Return ANY open session for their courses — no time filter
      // The lecturer controls open/close, not the clock
      sessions = await prisma.session.findMany({
        where: {
          courseId: { in: ids },
          isOpen:   true,
        },
        include: {
          course: { include: { lecturer: { select: { name: true } } } },
        },
        orderBy: { startTime: 'desc' },
      });
    } else {
      // Lecturer/Admin — show sessions in their courses that are happening today
      const now   = new Date();
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end   = new Date(now); end.setHours(23, 59, 59, 999);

      const courses = await prisma.course.findMany({
        where:  { lecturerId: req.user.id },
        select: { id: true },
      });
      const ids = courses.map((c) => c.id);

      sessions = await prisma.session.findMany({
        where: {
          courseId:  { in: ids },
          startTime: { gte: start, lte: end },
        },
        include: {
          course: true,
          _count: { select: { attendanceLogs: true } },
        },
        orderBy: { startTime: 'asc' },
      });
    }

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions?courseId=xxx ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { courseId } = req.query;
    if (!courseId) return res.status(400).json({ error: 'courseId required.' });

    const sessions = await prisma.session.findMany({
      where:   { courseId },
      orderBy: { startTime: 'desc' },
      include: { _count: { select: { attendanceLogs: true } } },
    });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions/today ───────────────────────────────────────────────────
// Returns all sessions for today for the logged-in lecturer
router.get('/today', async (req, res) => {
  try {
    const now   = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);

    const courses = await prisma.course.findMany({
      where:  { lecturerId: req.user.id },
      select: { id: true },
    });
    const ids = courses.map((c) => c.id);

    const sessions = await prisma.session.findMany({
      where: {
        courseId:  { in: ids },
        startTime: { gte: start, lte: end },
      },
      include: {
        course: true,
        _count: { select: { attendanceLogs: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where:   { id: req.params.id },
      include: {
        course:         { include: { lecturer: { select: { name: true } } } },
        attendanceLogs: { include: { user: { select: { id: true, name: true, studentId: true } } } },
      },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sessions ────────────────────────────────────────────────────────
router.post('/', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const { courseId, weekNumber, sessionType, startTime, endTime, radiusMeters } = req.body;
    if (!courseId || !startTime || !endTime) {
      return res.status(400).json({ error: 'courseId, startTime and endTime are required.' });
    }
    const session = await prisma.session.create({
      data: {
        courseId,
        weekNumber:   weekNumber  || 1,
        sessionType:  sessionType || 'Lecture',
        startTime:    new Date(startTime),
        endTime:      new Date(endTime),
        radiusMeters: radiusMeters ? parseInt(radiusMeters) : 50,
      },
    });
    res.status(201).json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.patch('/:id/set-location', async (req, res) => {
  try {
    const { latitude, longitude, radiusMeters } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required.' });
    }

    const session = await prisma.session.findUnique({
      where:   { id: req.params.id },
      include: { course: true },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const allowed = await canManage(req.user, session);
    if (!allowed) {
      return res.status(403).json({ error: 'Only the lecturer, admin, or class rep can set the classroom location.' });
    }

    // Save GPS and open attendance
    const updated = await prisma.session.update({
      where: { id: req.params.id },
      data: {
        latitude:      parseFloat(latitude),
        longitude:     parseFloat(longitude),
        radiusMeters:  radiusMeters ? parseInt(radiusMeters) : session.radiusMeters,
        locationSetBy: req.user.id,
        locationSetAt: new Date(),
        isOpen:        true,
      },
      include: { course: true },
    });

    // Create in-app notifications for all enrolled students
    const enrolments = await prisma.courseEnrolment.findMany({
      where:   { courseId: session.courseId },
      include: { user: { select: { id: true } } },
    });

    const title = `Attendance Open — ${session.course.name}`;
    const body  = `${req.user.name} has opened attendance. Sign in now.`;
    const toInsert = [];

    for (const enr of enrolments) {
      const exists = await prisma.notification.findFirst({
        where: { userId: enr.user.id, sessionId: session.id },
      });
      if (!exists) {
        toInsert.push({ userId: enr.user.id, sessionId: session.id, title, body, isRead: false });
      }
    }
    if (toInsert.length > 0) {
      await prisma.notification.createMany({ data: toInsert });
    }

    res.json({
      message:       `Location set. Attendance open for ${updated.course.name}. ${toInsert.length} students notified.`,
      session:       updated,
      notifiedCount: toInsert.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/sessions/:id/close ─────────────────────────────────────────────
router.patch('/:id/close', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const allowed = await canManage(req.user, session);
    if (!allowed) {
      return res.status(403).json({ error: 'Only the lecturer, admin, or class rep can close attendance.' });
    }

    const updated = await prisma.session.update({
      where: { id: req.params.id },
      data:  { isOpen: false, closedAt: new Date() },
    });
    res.json({ message: 'Attendance closed.', session: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;