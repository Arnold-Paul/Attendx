// src/routes/attendance.js
const express               = require('express');
const prisma                = require('../utils/prisma');
const { haversineDistance } = require('../utils/haversine');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);


router.post('/sign', async (req, res) => {
  try {
    const { sessionId, gpsLat, gpsLng } = req.body;

    if (!sessionId || gpsLat == null || gpsLng == null) {
      return res.status(400).json({ error: 'sessionId, gpsLat and gpsLng are required.' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId }, include: { course: true },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Must be open — lecturer controls this
    if (!session.isOpen) {
      return res.status(403).json({ error: 'Attendance is not open for this session. Wait for your lecturer.' });
    }

    // Must be enrolled
    const enrolment = await prisma.courseEnrolment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId: session.courseId } },
    });
    if (!enrolment) {
      return res.status(403).json({ error: 'You are not enrolled in this course.' });
    }

    // Already signed
    const existing = await prisma.attendanceLog.findUnique({
      where: { userId_sessionId: { userId: req.user.id, sessionId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'You have already signed attendance for this session.' });
    }

    // Location must be set
    if (session.latitude == null || session.longitude == null) {
      return res.status(403).json({ error: 'Classroom location has not been set yet.' });
    }

    // GPS distance check
    const distanceM = haversineDistance(
      parseFloat(gpsLat), parseFloat(gpsLng),
      session.latitude, session.longitude
    );

    if (distanceM > session.radiusMeters) {
      return res.status(403).json({
        error:     `You are ${Math.round(distanceM)}m from the classroom. You must be within ${session.radiusMeters}m.`,
        distanceM: Math.round(distanceM),
        radiusM:   session.radiusMeters,
      });
    }

    // All checks passed — log attendance
    const log = await prisma.attendanceLog.create({
      data: {
        userId:    req.user.id,
        sessionId,
        status:    'PRESENT',
        gpsLat:    parseFloat(gpsLat),
        gpsLng:    parseFloat(gpsLng),
        distanceM: parseFloat(distanceM.toFixed(2)),
        verified:  true,
      },
      include: {
        session: { include: { course: true } },
        user:    { select: { name: true, studentId: true } },
      },
    });

    res.status(201).json({
      message:   'Attendance signed successfully.',
      distanceM: Math.round(distanceM),
      log,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/me ────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const logs = await prisma.attendanceLog.findMany({
      where:   { userId: req.user.id },
      include: { session: { include: { course: true } } },
      orderBy: { signedAt: 'desc' },
    });

    const enrolments = await prisma.courseEnrolment.findMany({
      where:   { userId: req.user.id },
      include: { course: true },
    });

    const courseStats = await Promise.all(
      enrolments.map(async (enr) => {
        // Only count CLOSED sessions as "total" — open/pending sessions don't affect the percentage yet
        const closedSessions = await prisma.session.count({
          where: { courseId: enr.courseId, isOpen: false, closedAt: { not: null } },
        });
        const attended = await prisma.attendanceLog.count({
          where: { userId: req.user.id, session: { courseId: enr.courseId }, status: 'PRESENT' },
        });
        const pct = closedSessions > 0 ? Math.round((attended / closedSessions) * 100) : null;
        return {
          course: enr.course.name, courseCode: enr.course.code,
          courseId: enr.courseId,
          closedSessions, attended,
          absent: Math.max(0, closedSessions - attended),
          percentage: pct, // null = no closed sessions yet, show as pending
        };
      })
    );

    const closedTotal   = courseStats.reduce((a, c) => a + c.closedSessions, 0);
    const totalAttended = courseStats.reduce((a, c) => a + c.attended,       0);
    const overallPct    = closedTotal > 0 ? Math.round((totalAttended / closedTotal) * 100) : null;

    res.json({
      overall: {
        percentage: overallPct,
        attended:   totalAttended,
        absent:     Math.max(0, closedTotal - totalAttended),
        totalSessions: closedTotal,
      },
      courseStats,
      logs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/session/:sessionId ────────────────────────────────────
router.get('/session/:sessionId', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId }, include: { course: true },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const enrolments = await prisma.courseEnrolment.findMany({
      where:   { courseId: session.courseId },
      include: { user: { select: { id: true, name: true, studentId: true, email: true } } },
    });

    const logs      = await prisma.attendanceLog.findMany({ where: { sessionId: req.params.sessionId } });
    const signedIds = new Set(logs.map((l) => l.userId));

    // Status: PRESENT if signed, ABSENT if session closed, PENDING if session still open
    const sessionClosed = !session.isOpen && session.closedAt != null;

    const students = enrolments.map((enr) => {
      const log = logs.find((l) => l.userId === enr.user.id);
      return {
        ...enr.user,
        signed:    signedIds.has(enr.user.id),
        status:    signedIds.has(enr.user.id) ? 'PRESENT'
                 : sessionClosed              ? 'ABSENT'
                 : 'PENDING',
        signedAt:  log?.signedAt  || null,
        distanceM: log?.distanceM || null,
      };
    });

    const signedCount  = students.filter((s) => s.signed).length;
    const absentCount  = sessionClosed ? students.length - signedCount : 0;
    const pendingCount = sessionClosed ? 0 : students.length - signedCount;

    res.json({
      session,
      summary: {
        enrolled: students.length,
        signed:   signedCount,
        absent:   absentCount,
        pending:  pendingCount,
        percentage: students.length > 0 ? Math.round((signedCount / students.length) * 100) : 0,
        sessionClosed,
      },
      students,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/report/:sessionId ─────────────────────────────────────
router.get('/report/:sessionId', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where:   { id: req.params.sessionId },
      include: { course: { include: { lecturer: { select: { name: true } } } } },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const enrolments = await prisma.courseEnrolment.findMany({
      where:   { courseId: session.courseId },
      include: { user: { select: { id: true, name: true, studentId: true } } },
    });

    const logs      = await prisma.attendanceLog.findMany({ where: { sessionId: req.params.sessionId } });
    const signedMap = new Map(logs.map((l) => [l.userId, l]));
    const sessionClosed = !session.isOpen && session.closedAt != null;

    const rows = enrolments.map((enr) => {
      const log = signedMap.get(enr.user.id);
      return {
        studentId: enr.user.studentId,
        name:      enr.user.name,
        status:    log           ? 'PRESENT'
                 : sessionClosed ? 'ABSENT'
                 :                 'PENDING',
        signedAt:  log?.signedAt  || null,
        distanceM: log?.distanceM || null,
      };
    });

    const signedCount = rows.filter((r) => r.status === 'PRESENT').length;
    const absentCount = rows.filter((r) => r.status === 'ABSENT').length;

    res.json({
      report: {
        generatedAt:   new Date(),
        course:        session.course.name,
        courseCode:    session.course.code,
        lecturer:      session.course.lecturer.name,
        session:       `Week ${session.weekNumber} · ${session.sessionType}`,
        date:          session.startTime,
        enrolled:      rows.length,
        present:       signedCount,
        absent:        absentCount,
        pending:       rows.length - signedCount - absentCount,
        percentage:    rows.length > 0 ? Math.round((signedCount / rows.length) * 100) : 0,
        sessionClosed,
        students:      rows,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/report/:sessionId/csv ─────────────────────────────────
router.get('/report/:sessionId/csv', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where:   { id: req.params.sessionId },
      include: { course: { include: { lecturer: { select: { name: true } } } } },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const enrolments = await prisma.courseEnrolment.findMany({
      where:   { courseId: session.courseId },
      include: { user: { select: { id: true, name: true, studentId: true, email: true } } },
    });

    const logs      = await prisma.attendanceLog.findMany({ where: { sessionId: req.params.sessionId } });
    const signedMap = new Map(logs.map((l) => [l.userId, l]));
    const sessionClosed = !session.isOpen && session.closedAt != null;

    const rows = enrolments.map((enr) => {
      const log = signedMap.get(enr.user.id);
      const status = log           ? 'PRESENT'
                   : sessionClosed ? 'ABSENT'
                   :                 'PENDING';
      return [
        enr.user.studentId,
        enr.user.name,
        enr.user.email || '',
        status,
        log?.signedAt ? new Date(log.signedAt).toLocaleString() : '',
        log?.distanceM != null ? `${Math.round(log.distanceM)}m` : '',
        log?.verified ? 'GPS Verified' : '',
      ];
    });

    const signedCount = rows.filter((r) => r[3] === 'PRESENT').length;
    const absentCount = rows.filter((r) => r[3] === 'ABSENT').length;

    const header = [
      `AttendX Attendance Report`,
      `Course: ${session.course.name} (${session.course.code})`,
      `Lecturer: ${session.course.lecturer.name}`,
      `Session: Week ${session.weekNumber} - ${session.sessionType}`,
      `Date: ${new Date(session.startTime).toLocaleDateString('en-GB')}`,
      `Status: ${sessionClosed ? 'Closed' : 'Open / In Progress'}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Summary: ${signedCount} Present | ${absentCount} Absent | ${rows.length - signedCount - absentCount} Pending | ${rows.length} Total (${rows.length > 0 ? Math.round((signedCount / rows.length) * 100) : 0}%)`,
      ``,
      `Student ID,Full Name,Email,Status,Signed At,Distance From Class,GPS Verified`,
    ].join('\n');

    const csvRows  = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const csv      = `${header}\n${csvRows}`;
    const filename = `AttendX_${session.course.code}_Week${session.weekNumber}_${new Date(session.startTime).toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type',        'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control',       'no-store');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/me/csv ────────────────────────────────────────────────
router.get('/me/csv', async (req, res) => {
  try {
    const logs = await prisma.attendanceLog.findMany({
      where:   { userId: req.user.id },
      include: { session: { include: { course: true } } },
      orderBy: { signedAt: 'desc' },
    });

    const enrolments = await prisma.courseEnrolment.findMany({
      where:   { userId: req.user.id },
      include: { course: true },
    });

    const summaryLines = [];
    for (const enr of enrolments) {
      const closed   = await prisma.session.count({ where: { courseId: enr.courseId, isOpen: false, closedAt: { not: null } } });
      const attended = await prisma.attendanceLog.count({
        where: { userId: req.user.id, session: { courseId: enr.courseId }, status: 'PRESENT' },
      });
      const pct = closed > 0 ? `${Math.round((attended / closed) * 100)}%` : 'N/A';
      summaryLines.push(`"${enr.course.name}","${enr.course.code}","${attended}","${Math.max(0, closed - attended)}","${closed}","${pct}"`);
    }

    const header = [
      `AttendX Personal Attendance Report`,
      `Student: ${req.user.name} (${req.user.studentId})`,
      `Email: ${req.user.email}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `=== COURSE SUMMARY ===`,
      `Course,Code,Present,Absent,Closed Sessions,Percentage`,
      summaryLines.join('\n'),
      ``,
      `=== ATTENDANCE LOG ===`,
      `Course,Code,Session,Date,Time,Status,Distance`,
    ].join('\n');

    const logRows = logs.map((log) => [
      `"${log.session?.course?.name || ''}"`,
      `"${log.session?.course?.code || ''}"`,
      `"Week ${log.session?.weekNumber} - ${log.session?.sessionType}"`,
      `"${new Date(log.signedAt).toLocaleDateString('en-GB')}"`,
      `"${new Date(log.signedAt).toLocaleTimeString()}"`,
      `"${log.status}"`,
      `"${Math.round(log.distanceM)}m"`,
    ].join(',')).join('\n');

    const csv = `${header}\n${logRows}`;
    res.setHeader('Content-Type',        'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="AttendX_${req.user.studentId}_Report.csv"`);
    res.setHeader('Cache-Control',       'no-store');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;