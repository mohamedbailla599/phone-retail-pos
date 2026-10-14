import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AuditLog } from '../api/audit';

interface ExportAuditPdfOptions {
  logs: AuditLog[];
  categoryLabel: string;
  startDate?: string;
  endDate?: string;
  operatorName?: string;
  generatedBy?: string;
}

export function exportAuditLogsToPdf({
  logs,
  categoryLabel,
  startDate,
  endDate,
  operatorName,
  generatedBy,
}: ExportAuditPdfOptions) {
  // Create PDF in landscape A4 (297mm x 210mm) for spacious audit tabular layout
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Top Decorative Header Bar
  doc.setFillColor(17, 17, 17); // Dark Charcoal
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Gold accent line under header
  doc.setFillColor(212, 175, 90); // Gold
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  // Title & Brand
  doc.setTextColor(212, 175, 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('BIGHRISSEN PHONE', 14, 13);

  doc.setTextColor(245, 245, 245);
  doc.setFontSize(11);
  doc.text("RAPPORT OFFICIEL DU JOURNAL D'AUDIT & SÉCURITÉ", 14, 21);

  // Right Top Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  const generationDateStr = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  doc.text(`Édité le : ${generationDateStr}`, pageWidth - 14, 13, { align: 'right' });
  if (generatedBy) {
    doc.text(`Par : ${generatedBy}`, pageWidth - 14, 19, { align: 'right' });
  }

  // 2. Filter Summary Info Box
  const boxY = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, boxY, pageWidth - 28, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  // Column 1: Category & Records
  doc.text(`Catégorie :`, 20, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(212, 175, 90);
  doc.text(categoryLabel, 42, boxY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Événements :`, 20, boxY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${logs.length} opération(s)`, 55, boxY + 13);

  // Column 2: Date Range
  doc.setFont('helvetica', 'bold');
  doc.text(`Période :`, 110, boxY + 6);
  doc.setFont('helvetica', 'normal');
  const periodText = startDate
    ? endDate
      ? `Du ${startDate} au ${endDate}`
      : `Depuis le ${startDate}`
    : 'Toutes les dates (Historique complet)';
  doc.text(periodText, 128, boxY + 6);

  // Column 3: Operator Filter
  doc.setFont('helvetica', 'bold');
  doc.text(`Opérateur :`, 200, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(operatorName || 'Tous les opérateurs', 222, boxY + 6);

  // 3. Format Table Data
  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return (
        d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      return isoString;
    }
  };

  const summarizeValues = (val: Record<string, any> | null) => {
    if (!val) return '—';
    const parts: string[] = [];
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'object' && v !== null) {
        parts.push(`${k}: ${JSON.stringify(v)}`);
      } else {
        parts.push(`${k}: ${v}`);
      }
    }
    return parts.slice(0, 3).join(' | ');
  };

  const tableRows = logs.map((log) => [
    formatDateTime(log.created_at),
    log.actor_name || `@${log.actor_username}`,
    log.action_display || log.action,
    `${log.entity_type} #${log.entity_id}`,
    log.reason || '—',
    summarizeValues(log.new_values),
  ]);

  // 4. Render Table with autoTable
  autoTable(doc, {
    startY: 56,
    head: [
      [
        'Date & Heure',
        'Opérateur',
        'Action Système',
        'Entité / Réf',
        'Motif / Description',
        'Données Enregistrées',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [24, 24, 27], // Dark Header
      textColor: [212, 175, 90], // Gold text
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 32 }, // Date
      1: { cellWidth: 28 }, // Operator
      2: { cellWidth: 42, fontStyle: 'bold' }, // Action
      3: { cellWidth: 35 }, // Entity
      4: { cellWidth: 78 }, // Reason / Description
      5: { cellWidth: 54, fontSize: 7.5, textColor: [71, 85, 105] }, // Values
    },
    margin: { left: 14, right: 14, bottom: 15 },
    didDrawPage: (data) => {
      // Footer on every page
      const currentY = pageHeight - 8;
      doc.setDrawColor(226, 232, 240);
      doc.line(14, currentY - 3, pageWidth - 14, currentY - 3);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      doc.text(
        'BIGHRISSEN PHONE POS • Document officiel de contrôle interne et conformité',
        14,
        currentY
      );

      const pageStr = `Page ${data.pageNumber}`;
      doc.text(pageStr, pageWidth - 14, currentY, { align: 'right' });
    },
  });

  // 5. Download the PDF file
  const safeCategory = categoryLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `audit-log-bighrissen-${safeCategory}-${dateStr}.pdf`;

  doc.save(fileName);
}
