import { baseName, fileExtension, fileKind, looksLikeText } from './files';

describe('files', () => {
  it('names a file by its last path segment', () => {
    expect(baseName('task_attachments/cnc_cutting/CNC-2318/E10162.pdf')).toBe('E10162.pdf');
    expect(baseName('E1.pdf')).toBe('E1.pdf');
    expect(baseName(null)).toBe('');
    expect(fileExtension('a/b/E1.MPG')).toBe('mpg');
    expect(fileExtension('README')).toBe('');
  });

  it('previews PDFs, images and CNC programs', () => {
    expect(fileKind('E1.pdf')).toBe('pdf');
    expect(fileKind('foto.JPG')).toBe('image');
    expect(fileKind('E1.MPG')).toBe('text');
    expect(fileKind('E1.dxf')).toBe('other');
  });

  it('tells text from binary', () => {
    expect(
      looksLikeText(new TextEncoder().encode('3\r\nE10162-ST44-20MM\r\nInfo: Columbus, V2.2\r\n')),
    ).toBe(true);
    expect(looksLikeText(new Uint8Array([0, 0, 1, 186]))).toBe(false);
  });
});
