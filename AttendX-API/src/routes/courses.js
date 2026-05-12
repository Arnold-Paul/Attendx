// src/routes/courses.js
const express = require('express');
const prisma  = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// ── GET /api/courses ──────────────────────────────────────────────────────────
// Student: returns courses they are enrolled in
// Lecturer/Admin: returns all courses
router.get('/', async (req, res) => {
  try {
    let courses;

    if (req.user.role === 'STUDENT') {
      const enrolments = await prisma.courseEnrolment.findMany({
        where: { userId: req.user.id },
        include: {
          course: {
            include: { lecturer: { select: { name: true, studentId: true } } },
          },
        },
      });
      courses = enrolments.map((e) => e.course);
    } else {
      courses = await prisma.course.findMany({
        include: {
          lecturer: { select: { name: true, studentId: true } },
          _count:   { select: { enrolments: true, sessions: true } },
        },
        orderBy: { name: 'asc' },
      });
    }

    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/courses/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        lecturer:   { select: { name: true, studentId: true } },
        sessions:   { orderBy: { startTime: 'desc' }, take: 10 },
        enrolments: { include: { user: { select: { id: true, name: true, studentId: true } } } },
      },
    });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    res.json({ course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/courses — Lecturer/Admin: create course ────────────────────────
router.post('/', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'name and code are required.' });
    }
    const course = await prisma.course.create({
      data: { name, code, lecturerId: req.user.id },
    });
    res.status(201).json({ course });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A course with that code already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/courses/:id/enrol — Enrol a student ────────────────────────────
// Body: { studentId }  (the studentId string like "CS/2024/041")
router.post('/:id/enrol', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const { studentId } = req.body;
    const student = await prisma.user.findUnique({ where: { studentId } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const enrolment = await prisma.courseEnrolment.create({
      data: { userId: student.id, courseId: req.params.id },
    });
    res.status(201).json({ enrolment });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Student already enrolled.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/courses/:id/enrol — Remove a student ─────────────────────────
router.delete('/:id/enrol', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const { studentId } = req.body;
    const student = await prisma.user.findUnique({ where: { studentId } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    await prisma.courseEnrolment.delete({
      where: { userId_courseId: { userId: student.id, courseId: req.params.id } },
    });
    res.json({ message: 'Student removed from course.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;