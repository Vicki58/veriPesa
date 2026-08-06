const db = require('../config/db');

const getDailyReport = async (req, res) => {
  const vendorId = req.vendor.vendor_id;
  // Use query date or default to current date in EAT/Local time (YYYY-MM-DD format)
  const date = req.query.date || new Date().toISOString().split('T')[0];

  try {
    // 1. Gather stats from sales for this vendor on this day
    const saleStats = await db.query(
      `SELECT 
         COALESCE(SUM(expected_amount), 0) as total_expected,
         SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
         SUM(CASE WHEN status = 'flagged' THEN 1 ELSE 0 END) as flagged_count
       FROM sales 
       WHERE vendor_id = ? AND DATE(created_at) = ?`,
      [vendorId, date]
    );

    const stats = saleStats[0] || { total_expected: 0, verified_count: 0, pending_count: 0, flagged_count: 0 };

    // 2. Gather received amounts from transactions matched to sales on this day
    const txStats = await db.query(
      `SELECT COALESCE(SUM(t.received_amount), 0) as total_received
       FROM transactions t
       JOIN sales s ON t.sale_id = s.sale_id
       WHERE s.vendor_id = ? AND DATE(t.timestamp) = ? AND t.matched = true`,
      [vendorId, date]
    );

    const totalReceived = txStats[0]?.total_received || 0;

    // 3. Check if a report entry already exists for this vendor and date
    const existingReports = await db.query(
      'SELECT * FROM reconciliation_reports WHERE vendor_id = ? AND report_date = ?',
      [vendorId, date]
    );

    if (existingReports.length > 0) {
      // Update report
      await db.query(
        `UPDATE reconciliation_reports 
         SET total_expected = ?, total_received = ?, verified_count = ?, pending_count = ?, flagged_count = ?, generated_at = CURRENT_TIMESTAMP
         WHERE report_id = ?`,
        [
          stats.total_expected, 
          totalReceived, 
          stats.verified_count || 0, 
          stats.pending_count || 0, 
          stats.flagged_count || 0, 
          existingReports[0].report_id
        ]
      );
    } else {
      // Create new report
      await db.query(
        `INSERT INTO reconciliation_reports 
         (vendor_id, report_date, total_expected, total_received, verified_count, pending_count, flagged_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          vendorId, 
          date, 
          stats.total_expected, 
          totalReceived, 
          stats.verified_count || 0, 
          stats.pending_count || 0, 
          stats.flagged_count || 0
        ]
      );
    }

    // Fetch the saved report
    const reports = await db.query(
      'SELECT * FROM reconciliation_reports WHERE vendor_id = ? AND report_date = ?',
      [vendorId, date]
    );

    // Get specific sales details for granular display
    const salesDetail = await db.query(
      `SELECT sale_id, customer_name, customer_phone, expected_amount, status, created_at
       FROM sales
       WHERE vendor_id = ? AND DATE(created_at) = ?
       ORDER BY created_at DESC`,
      [vendorId, date]
    );

    res.status(200).json({
      report: reports[0],
      sales: salesDetail
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ error: 'Server error while generating report.' });
  }
};

module.exports = {
  getDailyReport
};
