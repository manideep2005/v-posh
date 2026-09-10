const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const userNotifications = (await db.notifications.find({ userId: req.user.id }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const unreadCount = userNotifications.filter(n => !n.isRead).length;

    res.json({ success: true, notifications: userNotifications, unreadCount });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const unread = await db.notifications.find({ userId: req.user.id, isRead: false });
    for (const n of unread) {
      await db.notifications.updateOne(n.id, { isRead: true });
    }
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const notification = await db.notifications.findById(req.params.id);
    if (notification && notification.userId === req.user.id) {
      await db.notifications.updateOne(notification.id, { isRead: true });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

module.exports = router;
