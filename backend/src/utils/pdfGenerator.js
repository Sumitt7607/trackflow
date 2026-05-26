const PDFDocument = require('pdfkit');

/**
 * Generate PDF report for employee tracking data
 * @param {Object} data { employee, attendanceRecords, violations, tasks, dateRange }
 * @param {NodeJS.WritableStream} stream write target stream
 */
const generateEmployeeReportPDF = (data, stream) => {
  const { employee, attendanceRecords, violations, tasks, dateRange } = data;
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.pipe(stream);

  // --- BRAND HEADER ---
  doc
    .fillColor('#0f172a') // Slate 900
    .fontSize(24)
    .text('TrackFlow', 50, 50, { bold: true })
    .fillColor('#6366f1') // Indigo 500
    .fontSize(10)
    .text('FIELD FORCE TRACKING & ANALYTICS', 50, 75)
    .moveDown();

  doc
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .moveTo(50, 95)
    .lineTo(545, 95)
    .stroke()
    .moveDown(1.5);

  // --- REPORT METADATA ---
  doc
    .fillColor('#334155')
    .fontSize(16)
    .text('Employee Productivity & Attendance Report', { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#475569')
    .text(`Employee Name: ${employee.name}`)
    .text(`Email Address: ${employee.email}`)
    .text(`Date Range: ${dateRange.start} to ${dateRange.end}`)
    .text(`Generated At: ${new Date().toLocaleString()}`)
    .moveDown(2);

  // --- STATISTICS OVERVIEW CARD ---
  const totalDays = attendanceRecords.length;
  const totalHours = attendanceRecords.reduce((sum, r) => sum + (r.workingHours || 0), 0);
  const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(2) : 0;
  const totalViolations = violations.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;

  doc
    .fillColor('#f8fafc') // Slate 50
    .rect(50, doc.y, 495, 80)
    .fillAndStroke('#f8fafc', '#e2e8f0');

  doc
    .fillColor('#1e293b')
    .fontSize(11)
    .text('PERFORMANCE METRICS OVERVIEW', 65, doc.y - 70, { bold: true })
    .moveDown(0.3);

  const startY = doc.y;
  doc
    .fontSize(9)
    .fillColor('#64748b')
    .text('Total Days Tracked:', 65, startY)
    .fillColor('#0f172a')
    .text(`${totalDays}`, 180, startY, { bold: true })
    .fillColor('#64748b')
    .text('Total Hours Logged:', 260, startY)
    .fillColor('#0f172a')
    .text(`${totalHours.toFixed(2)} hrs`, 370, startY, { bold: true });

  doc
    .fillColor('#64748b')
    .text('Avg Daily Hours:', 65, startY + 15)
    .fillColor('#0f172a')
    .text(`${avgHours} hrs`, 180, startY + 15, { bold: true })
    .fillColor('#64748b')
    .text('Geofence Violations:', 260, startY + 15)
    .fillColor('#ef4444') // Red 500
    .text(`${totalViolations}`, 370, startY + 15, { bold: true });

  doc
    .fillColor('#64748b')
    .text('Tasks Completed:', 65, startY + 30)
    .fillColor('#10b981') // Emerald 500
    .text(`${completedTasks} / ${totalTasks}`, 180, startY + 30, { bold: true });

  doc.y = startY + 55;
  doc.moveDown(2);

  // --- ATTENDANCE HISTORY TABLE ---
  doc
    .fillColor('#334155')
    .fontSize(13)
    .text('Attendance History', { bold: true })
    .moveDown(0.5);

  let currentY = doc.y;
  // Table headers
  doc
    .rect(50, currentY, 495, 20)
    .fill('#e2e8f0');

  doc
    .fillColor('#1e293b')
    .fontSize(9)
    .text('Date', 60, currentY + 5, { bold: true })
    .text('Check In', 150, currentY + 5, { bold: true })
    .text('Check Out', 260, currentY + 5, { bold: true })
    .text('Method (In/Out)', 370, currentY + 5, { bold: true })
    .text('Duration', 475, currentY + 5, { bold: true });

  currentY += 20;

  attendanceRecords.forEach((record) => {
    // Page boundary check
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }

    doc
      .rect(50, currentY, 495, 20)
      .stroke('#f1f5f9');

    doc
      .fillColor('#334155')
      .text(record.date, 60, currentY + 6)
      .text(new Date(record.checkInTime).toLocaleTimeString(), 150, currentY + 6)
      .text(
        record.checkOutTime
          ? new Date(record.checkOutTime).toLocaleTimeString()
          : 'Active / Missing',
        260,
        currentY + 6
      )
      .text(`${record.checkInMethod} / ${record.checkOutMethod || '-'}`, 370, currentY + 6)
      .text(`${record.workingHours ? record.workingHours.toFixed(2) : 0} hrs`, 475, currentY + 6);

    currentY += 20;
  });

  doc.y = currentY;
  doc.moveDown(2);

  // --- GEOFENCE BREACHES TABLE ---
  if (violations.length > 0) {
    // Page boundary check
    if (doc.y > 650) {
      doc.addPage();
    }

    doc
      .fillColor('#334155')
      .fontSize(13)
      .text('Geofence Violation Log', { bold: true })
      .moveDown(0.5);

    currentY = doc.y;
    doc
      .rect(50, currentY, 495, 20)
      .fill('#fee2e2'); // Soft red

    doc
      .fillColor('#991b1b') // Dark red text
      .fontSize(9)
      .text('Fence Name', 60, currentY + 5, { bold: true })
      .text('Event Type', 180, currentY + 5, { bold: true })
      .text('Location (Lat/Lng)', 280, currentY + 5, { bold: true })
      .text('Time', 430, currentY + 5, { bold: true });

    currentY += 20;

    violations.forEach((v) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc
        .rect(50, currentY, 495, 20)
        .stroke('#f1f5f9');

      doc
        .fillColor('#475569')
        .text(v.geoFence?.name || 'Unknown Fence', 60, currentY + 6)
        .fillColor(v.type === 'exit' ? '#ef4444' : '#10b981')
        .text(v.type.toUpperCase(), 180, currentY + 6)
        .fillColor('#475569')
        .text(`${v.location.lat.toFixed(5)}, ${v.location.lng.toFixed(5)}`, 280, currentY + 6)
        .text(new Date(v.timestamp).toLocaleString(), 430, currentY + 6);

      currentY += 20;
    });
  }

  doc.y = currentY;
  doc.moveDown(2);

  // --- TASKS REPORT SECTION ---
  if (tasks.length > 0) {
    if (doc.y > 650) {
      doc.addPage();
    }

    doc
      .fillColor('#334155')
      .fontSize(13)
      .text('Assigned Tasks & Statuses', { bold: true })
      .moveDown(0.5);

    currentY = doc.y;
    doc
      .rect(50, currentY, 495, 20)
      .fill('#f0fdf4'); // Soft green

    doc
      .fillColor('#166534')
      .fontSize(9)
      .text('Task Title', 60, currentY + 5, { bold: true })
      .text('Status', 220, currentY + 5, { bold: true })
      .text('Notes / Uploads', 320, currentY + 5, { bold: true });

    currentY += 20;

    tasks.forEach((t) => {
      if (currentY > 680) {
        doc.addPage();
        currentY = 50;
      }

      doc
        .rect(50, currentY, 495, 30)
        .stroke('#f1f5f9');

      doc
        .fillColor('#334155')
        .text(t.title, 60, currentY + 8, { bold: true })
        .fillColor(t.status === 'completed' ? '#10b981' : '#f59e0b')
        .text(t.status.toUpperCase(), 220, currentY + 8)
        .fillColor('#475569')
        .text(t.notes || 'No notes uploaded from field', 320, currentY + 8, { width: 210, height: 20 });

      currentY += 30;
    });
  }

  doc.end();
};

module.exports = {
  generateEmployeeReportPDF,
};
