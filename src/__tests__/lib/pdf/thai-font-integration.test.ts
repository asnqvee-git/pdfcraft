import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { WatermarkProcessor } from '@/lib/pdf/processors/watermark';
import { TextToPDFProcessor } from '@/lib/pdf/processors/text-to-pdf';
import { HeaderFooterProcessor } from '@/lib/pdf/processors/header-footer';
import { PageNumbersProcessor } from '@/lib/pdf/processors/page-numbers';

async function createSamplePdfFile(name = 'sample.pdf'): Promise<File> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  page.drawText('Sample PDF page');
  const pdfBytes = await doc.save();
  const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
  const file = new File([arrayBuffer], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => arrayBuffer,
  });
  return file;
}

describe('Thai Font PDF Processing Integration', () => {
  it('applies Thai text watermark successfully without WinAnsi errors', async () => {
    const sampleFile = await createSamplePdfFile();
    const processor = new WatermarkProcessor();
    const thaiWatermarkText = 'เอกสารลับ (CONFIDENTIAL)';

    const output = await processor.process({
      files: [sampleFile],
      options: {
        type: 'text',
        text: thaiWatermarkText,
        fontSize: 36,
        opacity: 0.5,
      },
    });

    expect(output.success).toBe(true);
    expect(output.result).toBeInstanceOf(Blob);
    expect((output.result as Blob).size).toBeGreaterThan(1000);
  });

  it('converts Thai text to PDF successfully', async () => {
    const processor = new TextToPDFProcessor();
    const thaiContent = 'ยินดีต้อนรับสู่ PDFCraft\nการสร้างเอกสารภาษาไทยทำงานได้อย่างถูกต้องแล้ว';

    const output = await processor.process({
      files: [],
      options: {
        directText: thaiContent,
        fontSize: 14,
        pageSize: 'A4',
        orientation: 'portrait',
      },
    });

    expect(output.success).toBe(true);
    expect(output.result).toBeInstanceOf(Blob);
    expect((output.result as Blob).size).toBeGreaterThan(1000);
  });

  it('adds Thai header and footer to PDF successfully', async () => {
    const sampleFile = await createSamplePdfFile();
    const processor = new HeaderFooterProcessor();

    const output = await processor.process({
      files: [sampleFile],
      options: {
        header: {
          left: 'หัวกระดาษ: รายงาน',
          right: 'หน้า {page}',
        },
        footer: {
          center: 'ท้ายกระดาษ: บริษัท จำกัด',
        },
      },
    });

    expect(output.success).toBe(true);
    expect(output.result).toBeInstanceOf(Blob);
    expect((output.result as Blob).size).toBeGreaterThan(1000);
  });

  it('adds page numbers with Thai prefix to PDF successfully', async () => {
    const sampleFile = await createSamplePdfFile();
    const processor = new PageNumbersProcessor();

    const output = await processor.process({
      files: [sampleFile],
      options: {
        prefix: 'หน้า ',
        suffix: ' จากทั้งหมด',
        format: 'page-of-total',
      },
    });

    expect(output.success).toBe(true);
    expect(output.result).toBeInstanceOf(Blob);
    expect((output.result as Blob).size).toBeGreaterThan(1000);
  });
});
