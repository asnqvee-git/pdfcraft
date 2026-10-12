import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { containsThai, containsCJK, detectScript, getFontForText, loadFontBuffer } from '@/lib/pdf/font-loader';

describe('font-loader', () => {
  it('correctly detects Thai characters', () => {
    expect(containsThai('สวัสดี')).toBe(true);
    expect(containsThai('Hello สวัสดี')).toBe(true);
    expect(containsThai('Hello World')).toBe(false);
    expect(containsThai('你好')).toBe(false);
  });

  it('correctly detects CJK characters', () => {
    expect(containsCJK('你好')).toBe(true);
    expect(containsCJK('こんにちは')).toBe(true);
    expect(containsCJK('안녕하세요')).toBe(true);
    expect(containsCJK('Hello World')).toBe(false);
    expect(containsCJK('สวัสดี')).toBe(false);
  });

  it('detects scripts accurately', () => {
    expect(detectScript('สวัสดีชาวโลก')).toBe('thai');
    expect(detectScript('中文测试')).toBe('cjk');
    expect(detectScript('Hello World 123')).toBe('latin');
  });

  it('loads Thai font buffer from local filesystem', async () => {
    const buffer = await loadFontBuffer('thai');
    expect(buffer).not.toBeNull();
    expect(buffer!.byteLength).toBeGreaterThan(10000);
  });

  it('embeds Thai font and draws Thai text without WinAnsi error', async () => {
    const pdfDoc = await PDFDocument.create();
    const { StandardFonts, rgb } = await import('pdf-lib');
    const defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const thaiText = 'เอกสารลับ (Confidential)';
    const font = await getFontForText(pdfDoc, thaiText, defaultFont);

    // Font should not be the standard Helvetica
    expect(font).not.toBe(defaultFont);

    const page = pdfDoc.addPage([500, 300]);
    expect(() => {
      page.drawText(thaiText, {
        x: 50,
        y: 150,
        font,
        size: 16,
        color: rgb(0, 0, 0),
      });
    }).not.toThrow();

    const pdfBytes = await pdfDoc.save();
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });
});
