// File helpers for FileList and FileViewer: names, kinds and one-file download.
// The legacy CNC pages showed files in a modal with Görüntüle and İndir
// (cnc_cutting/tasks/task.js, components/file-viewer).

/** One file as FileList and FileViewer show it. Pages map their API rows to this. */
export interface ViewFile {
  id?: number | string;
  url: string;
  /** Shown name, with its extension. */
  name: string;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
}

export type FileKind = 'image' | 'pdf' | 'video' | 'text' | 'other';

// MPG here is a CNC program (plain text from Columbus), not MPEG video, so it
// is previewed as text; TextPreview falls back to a download card when a file
// turns out not to be text.
const KINDS: Record<Exclude<FileKind, 'other'>, readonly string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
  pdf: ['pdf'],
  video: ['mp4', 'webm', 'mov'],
  text: ['txt', 'csv', 'log', 'json', 'xml', 'mpg', 'nc', 'cnc', 'gcode', 'tap'],
};

/** The last path segment: legacy file_name is a storage path (task_attachments/…/E1.pdf). */
export function baseName(name: string | null | undefined): string {
  if (!name) return '';
  const parts = String(name).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : '';
}

export function fileExtension(name: string | null | undefined): string {
  const base = baseName(name);
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function fileKind(name: string): FileKind {
  const ext = fileExtension(name);
  for (const [kind, list] of Object.entries(KINDS)) {
    if (list.includes(ext)) return kind as FileKind;
  }
  return 'other';
}

/** True when the bytes read as text (a few control characters allowed). */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  let odd = 0;
  for (const c of bytes) {
    if (c === 0) return false;
    if (c < 32 && c !== 9 && c !== 10 && c !== 13 && c !== 12 && c !== 27) odd++;
  }
  return odd / bytes.length < 0.05;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves the file under its own name; opens it in a new tab when it can't be fetched. */
export async function downloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    saveBlob(await response.blob(), fileName || 'Dosya');
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

/** Android's browser has no PDF viewer inside a page; the PDF opens in its own tab there. */
export function canShowPdfInline(): boolean {
  return !/android/i.test(navigator.userAgent);
}
