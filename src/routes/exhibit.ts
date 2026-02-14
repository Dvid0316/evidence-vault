import { Router } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../db";
import { getAuditInfo } from "../middleware/audit";
import { designateExhibit, getExhibitForRecord, listExhibits, removeExhibit } from "../services/exhibitService";

export const exhibitRouter = Router();

// Designate a record as an exhibit
exhibitRouter.post("/records/:recordId/exhibit", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const ownerUserId = (req as any).userId as string;
    const label = req.body?.label ?? null;

    const exhibit = await designateExhibit({ recordId, ownerUserId, label, audit: getAuditInfo(req) });
    res.json({ exhibit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found") return res.status(404).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

// Get exhibit for a specific record
exhibitRouter.get("/records/:recordId/exhibit", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const exhibit = await getExhibitForRecord(recordId);
    res.json({ exhibit }); // null if not designated
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// List exhibits for the authenticated user
exhibitRouter.get("/exhibits", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;

    const exhibits = await listExhibits(ownerUserId);
    res.json({ exhibits });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Remove exhibit designation
exhibitRouter.delete("/exhibits/:exhibitId", async (req, res) => {
  try {
    const exhibitId = String(req.params.exhibitId);
    const actorUserId = (req as any).userId as string;

    await removeExhibit({ exhibitId, actorUserId, audit: getAuditInfo(req) });
    res.json({ removed: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Exhibit not found") return res.status(404).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

// Generate exhibit PDF package
exhibitRouter.get("/exhibits/:exhibitId/pdf", async (req, res) => {
  try {
    const exhibitId = String(req.params.exhibitId);

    const exhibit = await prisma.exhibit.findUnique({
      where: { id: exhibitId },
      select: {
        id: true,
        exhibitCode: true,
        label: true,
        createdAt: true,
        ownerUserId: true,
        recordId: true,
        owner: { select: { email: true } },
        record: {
          select: {
            id: true,
            createdAt: true,
            currentVersion: {
              select: {
                versionNumber: true,
                createdAt: true,
                contentText: true,
                eventDateText: true,
              },
            },
            case: {
              select: { name: true, caseNumber: true },
            },
            tags: {
              select: { tag: { select: { name: true, color: true } } },
              orderBy: { tag: { name: "asc" } },
            },
          },
        },
      },
    });

    if (!exhibit) return res.status(404).json({ error: "Exhibit not found" });

    const historyRows = await prisma.editHistory.findMany({
      where: { recordId: exhibit.recordId },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        changeType: true,
        changeSummary: true,
        actorUserId: true,
        ipAddress: true,
      },
    });

    const attachmentRows = await prisma.attachment.findMany({
      where: { recordId: exhibit.recordId, isActive: true },
      orderBy: { uploadedAt: "asc" },
      select: {
        storagePath: true,
        fileType: true,
        fileHash: true,
        uploadedAt: true,
      },
    });

    // Build PDF
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 72, bottom: 72, left: 72, right: 72 } });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Exhibit-${exhibit.exhibitCode}-${exhibit.recordId}.pdf"`
    );
    doc.pipe(res);

    const pageWidth = doc.page.width - 144; // 72 left + 72 right margins

    // ===== PAGE 1: Cover Sheet =====
    doc.moveDown(6);
    doc.fontSize(36).font("Helvetica-Bold").text(`EXHIBIT ${exhibit.exhibitCode}`, { align: "center" });
    doc.moveDown(1);

    if (exhibit.label) {
      doc.fontSize(18).font("Helvetica").text(exhibit.label, { align: "center" });
      doc.moveDown(1);
    }

    doc.moveDown(2);
    doc.fontSize(12).font("Helvetica");
    doc.text(`Record ID: ${exhibit.recordId}`, { align: "center" });
    doc.moveDown(0.5);
    doc.text(`Owner: ${exhibit.owner.email}`, { align: "center" });
    doc.moveDown(0.5);
    doc.text(`Designated: ${new Date(exhibit.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });

    // Case info
    const recordCase = exhibit.record.case;
    if (recordCase) {
      doc.moveDown(1.5);
      doc.fontSize(12).font("Helvetica-Bold").text("Case", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(11).font("Helvetica").text(recordCase.name, { align: "center" });
      if (recordCase.caseNumber) {
        doc.text(`Case No. ${recordCase.caseNumber}`, { align: "center" });
      }
    }

    // Tags
    const recordTags = exhibit.record.tags.map((rt) => rt.tag);
    if (recordTags.length > 0) {
      doc.moveDown(1);
      doc.fontSize(10).font("Helvetica-Bold").text("Tags", { align: "center" });
      doc.moveDown(0.2);
      doc.fontSize(10).font("Helvetica").text(recordTags.map((t) => t.name).join(", "), { align: "center" });
    }

    // Footer
    doc.fontSize(9).font("Helvetica-Oblique");
    doc.text(
      `Generated by Record App on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      72,
      doc.page.height - 72 - 12,
      { align: "center", width: pageWidth }
    );

    // ===== PAGE 2: Record Content =====
    doc.addPage();
    doc.fontSize(16).font("Helvetica-Bold").text(`Exhibit ${exhibit.exhibitCode} — Record Content`);
    doc.moveDown(0.5);
    doc.moveTo(72, doc.y).lineTo(72 + pageWidth, doc.y).stroke();
    doc.moveDown(0.5);

    const cv = exhibit.record.currentVersion;
    if (cv) {
      doc.fontSize(11).font("Helvetica-Bold").text(`Version ${cv.versionNumber}`, { continued: true });
      doc.font("Helvetica").text(`  —  ${new Date(cv.createdAt).toLocaleString()}`);
      if (cv.eventDateText) {
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica-Oblique").text(`Event date: ${cv.eventDateText}`);
      }
      doc.moveDown(1);
      doc.fontSize(11).font("Helvetica").text(cv.contentText, { lineGap: 3 });
    } else {
      doc.fontSize(11).font("Helvetica-Oblique").text("No current version available.");
    }

    // ===== PAGE 3: Chain of Custody =====
    doc.addPage();
    doc.fontSize(16).font("Helvetica-Bold").text(`Exhibit ${exhibit.exhibitCode} — Chain of Custody`);
    doc.moveDown(0.5);
    doc.moveTo(72, doc.y).lineTo(72 + pageWidth, doc.y).stroke();
    doc.moveDown(0.5);

    if (historyRows.length === 0) {
      doc.fontSize(11).font("Helvetica-Oblique").text("No edit history entries.");
    } else {
      // Table header — 5 columns: Date, Action, Actor, IP Address, Details
      const colWidths = [110, 55, 90, 90, pageWidth - 345];
      const startX = 72;
      let y = doc.y;

      doc.fontSize(9).font("Helvetica-Bold");
      let cx = startX;
      doc.text("Date", cx, y, { width: colWidths[0] }); cx += colWidths[0];
      doc.text("Action", cx, y, { width: colWidths[1] }); cx += colWidths[1];
      doc.text("Actor", cx, y, { width: colWidths[2] }); cx += colWidths[2];
      doc.text("IP Address", cx, y, { width: colWidths[3] }); cx += colWidths[3];
      doc.text("Details", cx, y, { width: colWidths[4] });
      y += 16;
      doc.moveTo(startX, y).lineTo(startX + pageWidth, y).stroke();
      y += 6;

      doc.fontSize(8).font("Helvetica");
      for (const row of historyRows) {
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 72;
        }
        const dateStr = new Date(row.createdAt).toLocaleString();
        cx = startX;
        doc.text(dateStr, cx, y, { width: colWidths[0] }); cx += colWidths[0];
        doc.text(row.changeType, cx, y, { width: colWidths[1] }); cx += colWidths[1];
        doc.text(row.actorUserId ?? "system", cx, y, { width: colWidths[2] }); cx += colWidths[2];
        doc.text(row.ipAddress ?? "—", cx, y, { width: colWidths[3] }); cx += colWidths[3];
        doc.text(row.changeSummary, cx, y, { width: colWidths[4] });
        y += 18;
      }
    }

    // ===== PAGE 4: Attachments Summary =====
    doc.addPage();
    doc.fontSize(16).font("Helvetica-Bold").text(`Exhibit ${exhibit.exhibitCode} — Attachments`);
    doc.moveDown(0.5);
    doc.moveTo(72, doc.y).lineTo(72 + pageWidth, doc.y).stroke();
    doc.moveDown(0.5);

    if (attachmentRows.length === 0) {
      doc.fontSize(11).font("Helvetica-Oblique").text("No active attachments.");
    } else {
      const colWidths2 = [140, 100, pageWidth - 360, 120];
      const startX2 = 72;
      let y2 = doc.y;

      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Filename", startX2, y2, { width: colWidths2[0] });
      doc.text("Type", startX2 + colWidths2[0], y2, { width: colWidths2[1] });
      doc.text("SHA-256 Hash", startX2 + colWidths2[0] + colWidths2[1], y2, { width: colWidths2[2] });
      doc.text("Upload Date", startX2 + colWidths2[0] + colWidths2[1] + colWidths2[2], y2, { width: colWidths2[3] });
      y2 += 16;
      doc.moveTo(startX2, y2).lineTo(startX2 + pageWidth, y2).stroke();
      y2 += 6;

      doc.fontSize(8).font("Helvetica");
      for (const att of attachmentRows) {
        if (y2 > doc.page.height - 100) {
          doc.addPage();
          y2 = 72;
        }
        const filename = att.storagePath.split(/[/\\]/).pop() ?? att.storagePath;
        doc.text(filename, startX2, y2, { width: colWidths2[0] });
        doc.text(att.fileType, startX2 + colWidths2[0], y2, { width: colWidths2[1] });
        doc.text(att.fileHash, startX2 + colWidths2[0] + colWidths2[1], y2, { width: colWidths2[2] });
        doc.text(new Date(att.uploadedAt).toLocaleString(), startX2 + colWidths2[0] + colWidths2[1] + colWidths2[2], y2, { width: colWidths2[3] });
        y2 += 18;
      }
    }

    doc.end();
  } catch (err) {
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
});
