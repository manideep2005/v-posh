const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/info', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const categories = await db.categories.find();
    const departments = await db.departments.find();

    // Public ICC Committee Members (sanitized)
    const admins = (await db.users.find())
      .filter(u => u.role === 'admin' || u.role === 'super_admin');
    const iccMembers = admins.map(u => ({
      name: u.name,
      designation: u.designation || 'ICC Committee Member',
      department: u.department,
      email: u.email
    }));

    const faqs = [
      {
        q: 'What is the Internal Complaints Committee (ICC)?',
        a: 'The ICC is a statutory body constituted under the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013, to inquire into harassment grievances with full confidentiality.'
      },
      {
        q: 'Who can submit a complaint on this platform?',
        a: 'All enrolled students, research scholars, and academic staff who have experienced or witnessed sexual harassment or misconduct within institutional jurisdiction.'
      },
      {
        q: 'Will my identity remain strictly confidential?',
        a: 'Yes. Institutional policy mandates strict confidentiality. Only assigned members of the Internal Complaints Committee have permission to access complaint details during investigation.'
      },
      {
        q: 'What happens after I submit a complaint?',
        a: 'The complaint reference ID is generated instantly. Within 7 working days, the ICC acknowledges receipt, conducts preliminary scrutiny, and initiates formal inquiry proceedings in accordance with statutory guidelines.'
      },
      {
        q: 'Can I track the progress of my complaint?',
        a: 'Yes. You can track your complaint status in real-time through the Student Dashboard using your unique Reference ID (e.g., POSH-2026-000101).'
      }
    ];

    const rights = [
      'Right to a fair, impartial, and confidential inquiry.',
      'Right to request interim protective relief (e.g. transfer of academic guide or lab assignment).',
      'Right to receive formal status updates and official committee findings.',
      'Right to protection against victimization or academic retaliation.'
    ];

    res.json({
      success: true,
      institutionName: settings.institutionName,
      poshCellEmail: settings.poshCellEmail,
      emergencyHelpline: settings.emergencyHelpline,
      poshPolicyVersion: settings.poshPolicyVersion,
      categories,
      departments,
      iccMembers,
      faqs,
      rights
    });
  } catch (err) {
    console.error('Awareness info error:', err);
    res.status(500).json({ success: false, message: 'Failed to load platform information.' });
  }
});

module.exports = router;
