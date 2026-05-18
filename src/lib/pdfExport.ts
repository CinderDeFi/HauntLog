import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  EQUIPMENT_CATALOG,
  type CaseFile,
  type LogEntry,
  PERSONAL_EXPERIENCE_ID,
} from '../store/useHauntStore';
import { HAUNT_MARK_B64 } from './brandMark';
import { fetchPhotosForCase, getSignedPhotoUrls, type LogEntryPhotoRow } from './dataLayer';

// Max photos rendered per log entry. Keeps the PDF size sane on logs
// with many photos. Beyond this count, we append a "(+N more in app)"
// hint and skip the rest.
const PDF_PHOTOS_PER_LOG = 4;
const PDF_PHOTO_FETCH_TIMEOUT_MS = 8000;

// ============================================================
// Brand colors (mirror Tailwind theme tokens)
// ============================================================
const HAUNT_RED: [number, number, number] = [226, 75, 74]; // #E24B4A
const TEXT_MAIN: [number, number, number] = [20, 20, 22];
const TEXT_MUTED: [number, number, number] = [110, 110, 115];
const RULE: [number, number, number] = [210, 210, 215];

// Equipment chip colors for PDF rendering. Approximate matches of the
// Tailwind palette used in the web UI, picked for legibility on a
// white page. Each tuple is [r, g, b].
const EQUIP_RGB: Record<string, [number, number, number]> = {
  sb7: [168, 85, 247], // purple-500
  k2: [239, 68, 68], // red-500
  rempod: [16, 185, 129], // emerald-500
  thermal: [6, 182, 212], // cyan-500
  voice: [245, 158, 11], // amber-500
  geophone: [59, 130, 246], // blue-500
};

function equipmentColorForPdf(id: string): [number, number, number] {
  if (id === PERSONAL_EXPERIENCE_ID) return [110, 110, 115];
  return EQUIP_RGB[id] ?? [110, 110, 115];
}

function equipmentAbbrForPdf(id: string): string {
  if (id === PERSONAL_EXPERIENCE_ID) return 'EXP';
  const known = EQUIPMENT_CATALOG.find((e) => e.id === id);
  return known?.abbr ?? id.slice(0, 4).toUpperCase();
}

// ============================================================
// Helpers
// ============================================================

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function durationHM(startIso: string, endIso?: string): string {
  if (!endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return '—';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Fetch a signed URL and convert it to a base64 data URI suitable for
 * jsPDF's addImage. Times out after 8s — slow images are skipped to
 * keep the export responsive.
 */
async function fetchAsDataUri(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDF_PHOTO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pre-fetch all photo blobs for a case as data URIs grouped by log
 * entry id. Returns a map suitable for inline embedding.
 */
async function preparePhotosForPdf(
  caseId: string
): Promise<Map<string, Array<{ photo: LogEntryPhotoRow; dataUri: string }>>> {
  const byLog = await fetchPhotosForCase(caseId);
  const result = new Map<string, Array<{ photo: LogEntryPhotoRow; dataUri: string }>>();
  if (byLog.size === 0) return result;

  // Collect all paths for the photos we'll actually render (cap per log).
  const photosToFetch: LogEntryPhotoRow[] = [];
  byLog.forEach((arr) => {
    arr.slice(0, PDF_PHOTOS_PER_LOG).forEach((p) => photosToFetch.push(p));
  });
  if (photosToFetch.length === 0) return result;

  const signedMap = await getSignedPhotoUrls(photosToFetch.map((p) => p.storage_path));
  // Fetch all blobs in parallel; skip failed ones gracefully.
  const fetched = await Promise.all(
    photosToFetch.map(async (p) => {
      const url = signedMap.get(p.storage_path);
      if (!url) return null;
      const dataUri = await fetchAsDataUri(url);
      if (!dataUri) return null;
      return { photo: p, dataUri };
    })
  );

  fetched.forEach((entry) => {
    if (!entry) return;
    const arr = result.get(entry.photo.log_entry_id) ?? [];
    arr.push(entry);
    result.set(entry.photo.log_entry_id, arr);
  });
  return result;
}

function visibilityLabel(v: CaseFile['visibility']): string {
  if (v === 'public') return 'PUBLIC';
  if (v === 'anonymous') return 'ANONYMOUS';
  return 'PRIVATE';
}

function equipmentDisplayName(id: string, customEquipment?: Record<string, string>): string {
  if (id === PERSONAL_EXPERIENCE_ID) return 'Personal experience';
  const fromCatalog = EQUIPMENT_CATALOG.find((e) => e.id === id);
  if (fromCatalog) return fromCatalog.name;
  if (customEquipment && customEquipment[id]) return customEquipment[id];
  return id;
}

/**
 * Compact one-line representation of a log entry's structured data field.
 * Equipment-specific data is shaped differently per device; render whatever
 * keys exist as "key: value" pairs.
 */
function formatLogData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    parts.push(`${k}: ${String(v)}`);
  }
  return parts.join(' · ');
}

// ============================================================
// Main export function
// ============================================================

export async function exportCasePDF(caseFile: CaseFile, baseUrl?: string): Promise<void> {
  // Pre-fetch all photos for this case. Done up-front so we know if
  // there are any to render at all. Skipped silently if the request
  // fails — the PDF still exports without photos.
  let photosByLog: Map<string, Array<{ photo: LogEntryPhotoRow; dataUri: string }>> =
    new Map();
  try {
    photosByLog = await preparePhotosForPdf(caseFile.id);
  } catch (e) {
    console.warn('[exportCasePDF] photo prep failed:', e);
  }

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;

  // ----------------------------------------------------------
  // Page 1 — Cover / metadata
  // ----------------------------------------------------------

  // Brand strip
  doc.setFillColor(...HAUNT_RED);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Brand mark — small square logo to the left of the wordmark.
  // jsPDF accepts base64 PNG. 28x28pt at this baseline visually balances
  // the 20pt wordmark cap-height nicely.
  const markSize = 28;
  const markY = 30;
  doc.addImage(
    HAUNT_MARK_B64,
    'PNG',
    margin,
    markY,
    markSize,
    markSize,
    'mark',
    'FAST'
  );

  // Logo wordmark. Measure its actual rendered width so the tagline
  // doesn't collide with it (font widths differ per system).
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...HAUNT_RED);
  const wordmark = 'HAUNTLOG';
  const wordmarkX = margin + markSize + 8;
  doc.text(wordmark, wordmarkX, 52);
  const wordmarkWidth = doc.getTextWidth(wordmark);

  // Tagline, offset by the measured wordmark width + a fixed gap.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    'PARANORMAL INVESTIGATION EVIDENCE VAULT',
    wordmarkX + wordmarkWidth + 12,
    52
  );

  // Case ID, top right — same baseline as the wordmark.
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`CASE FILE #${caseFile.id}`, pageWidth - margin, 52, { align: 'right' });

  // Horizontal rule below header
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(margin, 72, pageWidth - margin, 72);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...TEXT_MAIN);
  const titleY = 112;
  const titleLines = doc.splitTextToSize(caseFile.title, pageWidth - margin * 2);
  doc.text(titleLines, margin, titleY);

  let y = titleY + titleLines.length * 32 + 6;

  // Author / team attribution
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_MUTED);
  const authorText =
    caseFile.visibility === 'anonymous'
      ? 'Investigator: anonymous'
      : `Investigator: ${caseFile.ownerHandle}`;
  doc.text(authorText, margin, y);
  y += 24;

  // Summary
  if (caseFile.summary) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_MAIN);
    const summaryLines = doc.splitTextToSize(caseFile.summary, pageWidth - margin * 2);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 14 + 12;
  }

  // Metadata block — two-column key/value list
  const metaRows: Array<[string, string]> = [
    ['LOCATION', caseFile.location + (caseFile.zone ? ` · ${caseFile.zone}` : '')],
    ['DATE', formatDate(caseFile.startedAt)],
    ['STARTED', formatDateTime(caseFile.startedAt)],
    ['ENDED', caseFile.endedAt ? formatDateTime(caseFile.endedAt) : '—'],
    ['DURATION', durationHM(caseFile.startedAt, caseFile.endedAt)],
    ['VISIBILITY', visibilityLabel(caseFile.visibility)],
    [
      'GPS',
      caseFile.gpsVerified
        ? caseFile.lat !== undefined && caseFile.lng !== undefined
          ? `Verified · ${caseFile.lat.toFixed(5)}, ${caseFile.lng.toFixed(5)}`
          : 'Verified'
        : 'Not verified',
    ],
  ];

  if (caseFile.tags && caseFile.tags.length > 0) {
    metaRows.push(['TAGS', caseFile.tags.join(', ')]);
  }

  // Equipment list
  const equipmentNames = caseFile.equipmentUsed.map((id) =>
    equipmentDisplayName(id, caseFile.customEquipment)
  );
  metaRows.push([
    'EQUIPMENT',
    equipmentNames.length > 0 ? equipmentNames.join(', ') : 'None',
  ]);

  // Render metadata as a borderless two-column table
  autoTable(doc, {
    startY: y,
    body: metaRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 6, right: 12, bottom: 6, left: 0 },
      textColor: TEXT_MAIN,
    },
    columnStyles: {
      0: {
        font: 'courier',
        fontStyle: 'bold',
        textColor: TEXT_MUTED,
        cellWidth: 130,
        fontSize: 8,
        valign: 'top',
      },
      1: { fontSize: 10, valign: 'top' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 30;

  // Stats summary band
  const starred = caseFile.logs.filter((l) => l.starred).length;
  doc.setDrawColor(...HAUNT_RED);
  doc.setLineWidth(1);
  doc.line(margin, y, margin + 80, y);

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_MAIN);
  const logCountText = `${caseFile.logs.length} log ${
    caseFile.logs.length === 1 ? 'entry' : 'entries'
  }`;
  doc.text(logCountText, margin, y);
  if (starred > 0) {
    const logCountWidth = doc.getTextWidth(logCountText);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(` · ${starred} starred`, margin + logCountWidth + 4, y);
  }

  // ----------------------------------------------------------
  // Page 2+ — Log entries table
  // ----------------------------------------------------------

  if (caseFile.logs.length > 0) {
    doc.addPage();
    drawHeader(doc, caseFile, margin, pageWidth);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_MAIN);
    doc.text('LOG ENTRIES', margin, 100);

    const tableBody = caseFile.logs.map((l: LogEntry, i) => {
      const abbr = equipmentAbbrForPdf(l.equipmentId);
      let observationCell = (l.starred ? '★ ' : '') + l.observation;
      if (l.note) observationCell += `\nNote: ${l.note}`;
      const dataLine = formatLogData(l.data);
      if (dataLine) observationCell += `\n[${dataLine}]`;
      return [
        String(i + 1),
        new Date(l.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        abbr,
        observationCell,
      ];
    });

    autoTable(doc, {
      startY: 115,
      head: [['#', 'TIME', 'GEAR', 'OBSERVATION']],
      body: tableBody,
      theme: 'striped',
      headStyles: {
        fillColor: TEXT_MAIN,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        font: 'courier',
        fontSize: 8,
      },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 6,
        textColor: TEXT_MAIN,
        valign: 'top',
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'right', textColor: TEXT_MUTED, font: 'courier' },
        1: { cellWidth: 52, font: 'courier', fontSize: 9 },
        2: { cellWidth: 50, font: 'courier', fontStyle: 'bold', fontSize: 9, halign: 'center' },
        3: { fontSize: 10 },
      },
      // Color the GEAR column text by equipment type so a quick scan
      // matches the visual rhythm of the web UI.
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const rowIdx = data.row.index;
          const log = caseFile.logs[rowIdx];
          if (log) {
            const rgb = equipmentColorForPdf(log.equipmentId);
            data.cell.styles.textColor = rgb;
          }
        }
      },
      margin: { left: margin, right: margin, top: 90 },
      didDrawPage: (data) => {
        // Page header on every continuation page
        if (data.pageNumber > 1) {
          drawHeader(doc, caseFile, margin, pageWidth);
        }
      },
    });

    // Starred highlights section if any
    if (starred > 0) {
      const finalY = (doc as any).lastAutoTable.finalY ?? 200;
      // Add a new page if we're too close to the bottom.
      let highlightY = finalY + 40;
      if (highlightY > pageHeight - 200) {
        doc.addPage();
        drawHeader(doc, caseFile, margin, pageWidth);
        highlightY = 100;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...HAUNT_RED);
      doc.text('★ STARRED MOMENTS', margin, highlightY);
      highlightY += 6;
      doc.setDrawColor(...HAUNT_RED);
      doc.setLineWidth(0.5);
      doc.line(margin, highlightY, margin + 130, highlightY);

      const starredEntries = caseFile.logs.filter((l) => l.starred);
      autoTable(doc, {
        startY: highlightY + 14,
        body: starredEntries.map((l) => [
          new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          equipmentDisplayName(l.equipmentId, caseFile.customEquipment),
          l.observation + (l.note ? `\nNote: ${l.note}` : ''),
        ]),
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 10,
          cellPadding: 6,
          valign: 'top',
        },
        columnStyles: {
          0: { cellWidth: 56, font: 'courier', textColor: HAUNT_RED, fontStyle: 'bold' },
          1: { cellWidth: 110, font: 'helvetica', fontStyle: 'italic', textColor: TEXT_MUTED, fontSize: 8 },
          2: { fontSize: 10 },
        },
        margin: { left: margin, right: margin },
      });
    }
  }

  // ----------------------------------------------------------
  // Photo gallery — one section per log entry that has photos
  // ----------------------------------------------------------
  if (photosByLog.size > 0) {
    doc.addPage();
    drawHeader(doc, caseFile, margin, pageWidth);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_MAIN);
    doc.text('PHOTOS', margin, 100);

    let y = 120;
    const thumbSize = 110;        // ~1.5" each
    const thumbGap = 8;
    const usableWidth = pageWidth - margin * 2;
    const thumbsPerRow = Math.floor((usableWidth + thumbGap) / (thumbSize + thumbGap));

    for (const log of caseFile.logs) {
      const photos = photosByLog.get(log.id);
      if (!photos || photos.length === 0) continue;

      // Section heading — log time + observation snippet
      const headerHeight = 32;
      const rowsNeeded = Math.ceil(Math.min(photos.length, PDF_PHOTOS_PER_LOG) / thumbsPerRow);
      const totalSectionHeight = headerHeight + rowsNeeded * (thumbSize + thumbGap) + 20;

      if (y + totalSectionHeight > pageHeight - 48) {
        doc.addPage();
        drawHeader(doc, caseFile, margin, pageWidth);
        y = 100;
      }

      // Heading
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...HAUNT_RED);
      const t = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      doc.text(t, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MAIN);
      const obsSnippet =
        log.observation.length > 100
          ? log.observation.slice(0, 97) + '…'
          : log.observation;
      doc.text(obsSnippet, margin + 50, y, { maxWidth: usableWidth - 50 });
      y += 18;

      // Photos
      const renderable = photos.slice(0, PDF_PHOTOS_PER_LOG);
      renderable.forEach((entry, i) => {
        const col = i % thumbsPerRow;
        const row = Math.floor(i / thumbsPerRow);
        const x = margin + col * (thumbSize + thumbGap);
        const ty = y + row * (thumbSize + thumbGap);
        try {
          doc.addImage(entry.dataUri, 'JPEG', x, ty, thumbSize, thumbSize, undefined, 'FAST');
        } catch (e) {
          // Some images may fail to render (corrupt etc.) — draw a placeholder.
          doc.setDrawColor(...RULE);
          doc.rect(x, ty, thumbSize, thumbSize);
          doc.setFontSize(7);
          doc.setTextColor(...TEXT_MUTED);
          doc.text('[image error]', x + 8, ty + 14);
        }
      });
      y += rowsNeeded * (thumbSize + thumbGap);

      // "+N more" hint
      if (photos.length > PDF_PHOTOS_PER_LOG) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(
          `+${photos.length - PDF_PHOTOS_PER_LOG} more in app`,
          margin,
          y + 4
        );
        y += 14;
      }
      y += 12;
    }
  }

  // ----------------------------------------------------------
  // Footer on every page
  // ----------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);

    // Page count
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 24, {
      align: 'right',
    });

    // Case URL or sealed marker
    const footerLeft = baseUrl
      ? `SEALED · ${baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toUpperCase()}/CASE/${caseFile.id}`
      : `SEALED · #${caseFile.id}`;
    doc.setFont('courier', 'bold');
    doc.text(footerLeft, margin, pageHeight - 24);
    doc.setFont('helvetica', 'normal');
  }

  // ----------------------------------------------------------
  // Trigger download
  // ----------------------------------------------------------
  doc.save(`hauntlog-${caseFile.id}.pdf`);
}

// ============================================================
// Page header for continuation pages
// ============================================================

function drawHeader(
  doc: jsPDF,
  caseFile: CaseFile,
  margin: number,
  pageWidth: number
) {
  doc.setFillColor(...HAUNT_RED);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Smaller mini-mark on continuation pages — matches the cover but tighter.
  const miniSize = 14;
  doc.addImage(
    HAUNT_MARK_B64,
    'PNG',
    margin,
    22,
    miniSize,
    miniSize,
    'mark',
    'FAST'
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...HAUNT_RED);
  const wordmarkX = margin + miniSize + 5;
  doc.text('HAUNTLOG', wordmarkX, 32);
  const wmWidth = doc.getTextWidth('HAUNTLOG');

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);

  // Available width for the right-side title is whatever is left after
  // the wordmark + a comfortable gap.
  const leftEdgeWidth = (wordmarkX - margin) + wmWidth + 20;
  const availableWidth = pageWidth - margin * 2 - leftEdgeWidth;
  let rightText = `#${caseFile.id} · ${caseFile.title}`;
  // Truncate with an ellipsis if it would collide with the wordmark.
  while (doc.getTextWidth(rightText) > availableWidth && rightText.length > 8) {
    rightText = rightText.slice(0, -2) + '…';
  }
  doc.text(rightText, pageWidth - margin, 32, { align: 'right' });

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(margin, 44, pageWidth - margin, 44);
}
