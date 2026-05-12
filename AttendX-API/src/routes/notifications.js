// src/routes/notifications.js
const express = require('express');
const prisma  = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user.id },
      include: {
        session: { include: { course: { select: { name: true, code: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found.' });
    if (notif.userId !== req.user.id) return res.status(403).json({ error: 'Not your notification.' });
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ notification: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
router.patch('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data:  { isRead: true },
    });
    res.json({ message: 'All marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;