import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export type ReportExportData = {
  title: string; status: string; period?: string | null;
  sections: { title: string; content?: string | null }[];
  links: { entityType: string; entityId: string }[];
};

const DISCLAIMER = "Generated from entESG controlled data. Readiness content is a management signal, not a legal compliance conclusion. Requires SME validation.";

export async function reportPdf(d: ReportExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, info: { Title: d.title } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(20).fillColor("#0d1f16").text("entESG", { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(16).text(d.title);
    doc.fontSize(10).fillColor("#475569").text(`Status: ${d.status} · Period: ${d.period ?? "—"} · Exported ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown();
    for (const s of d.sections) {
      doc.fontSize(13).fillColor("#0d1f16").text(s.title, { underline: true });
      doc.fontSize(10).fillColor("#1e293b").text((s.content ?? "Pending narrative").slice(0, 2000));
      doc.moveDown(0.6);
    }
    if (d.links.length) {
      doc.fontSize(13).fillColor("#0d1f16").text("Linked approved data", { underline: true });
      for (const l of d.links) doc.fontSize(9).fillColor("#334155").text(`• ${l.entityType}: ${l.entityId}`);
      doc.moveDown(0.6);
    }
    doc.fontSize(8).fillColor("#64748b").text(DISCLAIMER);
    doc.end();
  });
}

export async function reportDocx(d: ReportExportData): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("entESG")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(d.title)] }),
        new Paragraph({ children: [new TextRun(`Status: ${d.status} · Period: ${d.period ?? "—"} · Exported ${new Date().toISOString().slice(0, 10)}`)] }),
        ...d.sections.flatMap((s) => [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s.title)] }),
          new Paragraph({ children: [new TextRun((s.content ?? "Pending narrative").slice(0, 2000))] }),
        ]),
        ...(d.links.length ? [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Linked approved data")] }),
          ...d.links.map((l) => new Paragraph({ children: [new TextRun(`• ${l.entityType}: ${l.entityId}`)] })),
        ] : []),
        new Paragraph({ children: [new TextRun({ text: DISCLAIMER, italics: true, size: 16 })] }),
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, "'")}"`;
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
}
