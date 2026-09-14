// ─── Pause / Delete Complaint ────────────────────────────────────────────────

// Pause a complaint (student can only pause their own, non-resolved complaints)
router.put('/complaints/:id/pause', async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (complaint.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden.' });
    if (complaint.status === 'Resolved') return res.status(400).json({ success: false, message: 'Cannot pause a resolved complaint.' });

    const newPaused = !complaint.paused;
    await db.complaints.updateOne(complaint.id, { paused: newPaused });

    await db.statusHistory.insertOne({
      complaintId: complaint.id,
      previousStatus: complaint.status,
      newStatus: complaint.status,
      changedById: req.user.id,
      changedByName: req.user.name,
      changedByRole: 'student',
      comment: newPaused ? 'Complaint paused by student' : 'Complaint resumed by student'
    });

    logAuditAction(req, newPaused ? 'COMPLAINT_PAUSED' : 'COMPLAINT_RESUMED', 'COMPLAINT', complaint.id,
      `${newPaused ? 'Paused' : 'Resumed'} complaint ${complaint.referenceId}`);

    res.json({ success: true, message: newPaused ? 'Complaint paused.' : 'Complaint resumed.', paused: newPaused });
  } catch (err) {
    console.error('Pause error:', err);
    res.status(500).json({ success: false, message: 'Failed to update complaint.' });
  }
});

// Delete a complaint (student can only delete their own submitted/acknowledged complaints)
router.delete('/complaints/:id', async (req, res) => {
  try {
    const complaint = await db.complaints.findOne(c => c.id === req.params.id || c.referenceId === req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    if (complaint.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden.' });

    // Only allow deletion if status is Submitted or Acknowledged (not yet under investigation)
    const deletable = ['Submitted', 'Acknowledged'];
    if (!deletable.includes(complaint.status)) {
      return res.status(400).json({ success: false, message: `Cannot delete complaint in "${complaint.status}" status. Only Submitted or Acknowledged complaints can be deleted.` });
    }

    // Delete related data
    await db.statusHistory.find({ complaintId: complaint.id }).then(items => {
      for (const item of items) db.statusHistory.deleteOne(item.id);
    }).catch(() => {});
    await db.complaintUpdates.find({ complaintId: complaint.id }).then(items => {
      for (const item of items) db.complaintUpdates.deleteOne(item.id);
    }).catch(() => {});
    await db.notifications.find({ referenceId: complaint.referenceId }).then(items => {
      for (const item of items) db.notifications.deleteOne(item.id);
    }).catch(() => {});

    await db.complaints.deleteOne(complaint.id);

    logAuditAction(req, 'COMPLAINT_DELETED', 'COMPLAINT', complaint.id, `Student deleted complaint ${complaint.referenceId}`);

    res.json({ success: true, message: 'Complaint deleted successfully.' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
  }
});

module.exports = router;
