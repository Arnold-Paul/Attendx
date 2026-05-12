// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const prisma  = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}


async function sendExpoPush(pushToken, title, body, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: 'default' }),
    });
  } catch (_) {}
}
module.exports.sendExpoPush = sendExpoPush;


router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, programme, year, deviceId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const DOMAIN = '@students.jkuat.ac.ke';
    if (!email.toLowerCase().endsWith(DOMAIN)) {
      return res.status(400).json({ error: `Please use your JKUAT student email (ending in ${DOMAIN}).` });
    }

    // One account per device
    if (deviceId) {
      const taken = await prisma.user.findFirst({ where: { deviceId } });
      if (taken) {
        return res.status(409).json({ error: 'An account is already registered on this device.' });
      }
    }

    const studentId = email.toLowerCase().split('@')[0].toUpperCase();

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { studentId }] },
    });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        studentId,
        name:      name.trim(),
        email:     email.toLowerCase().trim(),
        password:  hashed,
        role:      'STUDENT',
        programme: programme?.trim() || 'BSc Computer Science',  
        year:      year?.trim()      || 'Year 1',                
        deviceId:  deviceId || null,
      },
    });

    // ── Auto-enrol in ALL existing courses ────────────────────────────────────
    const courses = await prisma.course.findMany({ select: { id: true } });
    if (courses.length > 0) {
      await prisma.courseEnrolment.createMany({
        data:           courses.map((c) => ({ userId: user.id, courseId: c.id })),
        skipDuplicates: true,
      });
    }

    const token = signToken(user.id);
    const { password: _pw, ...safe } = user;

    res.status(201).json({ message: 'Account created. You are now enrolled in all courses.', token, user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/login', async (req, res) => {
  try {
    const { email, studentId, password, deviceId, pushToken } = req.body;

    if (!password) return res.status(400).json({ error: 'Password is required.' });
    if (!email && !studentId) return res.status(400).json({ error: 'Email or student ID is required.' });

    let user;
    if (email) {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    } else {
      user = await prisma.user.findUnique({ where: { studentId } });
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)  return res.status(401).json({ error: 'Invalid credentials.' });

    // Device binding for students only
    if (deviceId && user.role === 'STUDENT') {
      if (user.deviceId && user.deviceId !== deviceId) {
        return res.status(403).json({ error: 'This account is linked to a different device.' });
      }
    }

    const updateData = {};
    if (deviceId  && !user.deviceId) updateData.deviceId  = deviceId;
    if (pushToken)                    updateData.pushToken  = pushToken;
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: updateData });
    }

    // Auto-enrol in any courses the student isn't enrolled in yet
    if (user.role === 'STUDENT' || user.role === 'CLASS_REP') {
      const courses = await prisma.course.findMany({ select: { id: true } });
      if (courses.length > 0) {
        await prisma.courseEnrolment.createMany({
          data:           courses.map((c) => ({ userId: user.id, courseId: c.id })),
          skipDuplicates: true,
        });
      }
    }

    const token = signToken(user.id);
    const { password: _pw, ...safe } = { ...user, ...updateData };

    res.json({ token, user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/push-token ─────────────────────────────────────────────────
router.post('/push-token', requireAuth, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ error: 'pushToken required.' });
    await prisma.user.update({ where: { id: req.user.id }, data: { pushToken } });
    res.json({ message: 'Push token saved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const { password: _pw, ...safe } = req.user;
  res.json({ user: safe });
});

// ── POST /api/auth/register (admin creates staff) ─────────────────────────────
router.post('/register', requireAuth, requireRole('ADMIN', 'LECTURER'), async (req, res) => {
  try {
    const { studentId, name, email, password, role, programme, year } = req.body;
    if (!studentId || !name || !email || !password) {
      return res.status(400).json({ error: 'studentId, name, email and password are required.' });
    }
    const existing = await prisma.user.findFirst({ where: { OR: [{ studentId }, { email }] } });
    if (existing) return res.status(409).json({ error: 'User already exists.' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: { studentId, name, email: email.toLowerCase(), password: hashed, role: role || 'STUDENT', programme: programme || null, year: year || null },
    });
    const { password: _pw, ...safe } = user;
    res.status(201).json({ user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;