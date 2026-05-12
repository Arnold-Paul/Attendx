// src/routes/users.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const prisma  = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        enrolments: {
          include: { course: true },
        },
      },
    });
    const { password: _pw, ...safe } = user;
    res.json({ user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/users/me ─────────────────────────────────────────────────────────
router.put('/me', async (req, res) => {
  try {
    const { name, email, programme, year, password } = req.body;
    const data = {};
    if (name)      data.name      = name;
    if (email)     data.email     = email;
    if (programme) data.programme = programme;
    if (year)      data.year      = year;
    if (password)  data.password  = await bcrypt.hash(password, 12);

    const updated = await prisma.user.update({ where: { id: req.user.id }, data });
    const { password: _pw, ...safe } = updated;
    res.json({ user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users — Admin only ───────────────────────────────────────────────
router.get('/', requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, studentId: true, name: true,
        email: true, role: true, programme: true, year: true, createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', requireRole('ADMIN', 'LECTURER'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, studentId: true, name: true,
        email: true, role: true, programme: true, year: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/assign-classrep', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({ error: 'studentId and courseId are required.' });
    }

    // Find the student
    const student = await prisma.user.findUnique({ where: { studentId } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    if (student.role === 'LECTURER' || student.role === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot assign class rep role to a lecturer or admin.' });
    }

    // Verify student is enrolled in the course
    const enrolment = await prisma.courseEnrolment.findUnique({
      where: { userId_courseId: { userId: student.id, courseId } },
    });
    if (!enrolment) {
      return res.status(400).json({ error: 'This student is not enrolled in that course.' });
    }

    // Demote any existing class rep for this course
    const existingReps = await prisma.courseEnrolment.findMany({
      where: { courseId, isClassRep: true },
    });
    for (const rep of existingReps) {
      await prisma.courseEnrolment.update({
        where: { id: rep.id },
        data:  { isClassRep: false },
      });
      // Check if they are still a class rep in any other course
      const stillRep = await prisma.courseEnrolment.findFirst({
        where: { userId: rep.userId, isClassRep: true },
      });
      if (!stillRep) {
        await prisma.user.update({
          where: { id: rep.userId },
          data:  { role: 'STUDENT' },
        });
      }
    }

    // Promote new class rep
    await prisma.courseEnrolment.update({
      where: { userId_courseId: { userId: student.id, courseId } },
      data:  { isClassRep: true },
    });

    await prisma.user.update({
      where: { id: student.id },
      data:  { role: 'CLASS_REP' },
    });

    const course = await prisma.course.findUnique({ where: { id: courseId } });

    res.json({
      message: `${student.name} is now the class rep for ${course.name}. They can set classroom location and open/close attendance.`,
      student: { id: student.id, name: student.name, studentId: student.studentId, role: 'CLASS_REP' },
      course:  { id: course.id, name: course.name, code: course.code },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/remove-classrep', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    if (!studentId || !courseId) {
      return res.status(400).json({ error: 'studentId and courseId are required.' });
    }

    const student = await prisma.user.findUnique({ where: { studentId } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const enrolment = await prisma.courseEnrolment.findUnique({
      where: { userId_courseId: { userId: student.id, courseId } },
    });
    if (!enrolment || !enrolment.isClassRep) {
      return res.status(400).json({ error: 'This student is not the class rep for that course.' });
    }

    // Remove class rep flag from this enrolment
    await prisma.courseEnrolment.update({
      where: { userId_courseId: { userId: student.id, courseId } },
      data:  { isClassRep: false },
    });

    // Check if they are still class rep in any other course
    const stillRep = await prisma.courseEnrolment.findFirst({
      where: { userId: student.id, isClassRep: true },
    });
    if (!stillRep) {
      await prisma.user.update({
        where: { id: student.id },
        data:  { role: 'STUDENT' },
      });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });

    res.json({
      message: `${student.name} has been removed as class rep for ${course.name}. They are now a regular student.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/classreps/:courseId ────────────────────────────────────────
// Get the current class rep for a course
router.get('/classreps/:courseId', requireRole('LECTURER', 'ADMIN'), async (req, res) => {
  try {
    const reps = await prisma.courseEnrolment.findMany({
      where: { courseId: req.params.courseId, isClassRep: true },
      include: { user: { select: { id: true, name: true, studentId: true, email: true } } },
    });

    if (reps.length === 0) {
      return res.json({ classRep: null, message: 'No class rep assigned for this course.' });
    }

    res.json({ classRep: reps[0].user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;