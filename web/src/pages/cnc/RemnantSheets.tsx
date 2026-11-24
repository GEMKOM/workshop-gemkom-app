import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  Modal,
  NativeSelect,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconPrinter, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import type { BookedRemnant } from '@/api/cnc';
import {
  buildRemnant,
  parseDecimal,
  SHAPE_LABELS,
  SHAPES,
  shapeFields,
  shortSideMm,
  sizeText,
  type Remnant,
  type RemnantInput,
} from '@/lib/plateShape';
import sheets from '@/ui/Sheets.module.css';

// Legacy cnc_cutting/tasks/remnantFinishModal.js and remnantCodesModal.js: the
// remnants a finished cut returns to stock (shape and size; a piece whose short
// side is under 500 mm counts as fire), then the codes the server gave them,
// to write on the sheets and print.

export const MIN_REMNANT_SIDE_MM = 500;

interface Row extends RemnantInput {
  id: number;
}

let nextId = 1;
const newRow = (): Row => ({
  id: nextId++,
  shape: 'rectangle',
  width: '',
  length: '',
  area: '',
  quantity: '1',
});

function isScrap(row: Row): boolean {
  const width = parseDecimal(row.width, 1);
  const length = row.shape === 'circle' ? width : parseDecimal(row.length, 1);
  return width > 0 && length > 0 && shortSideMm(row.shape, width, length) < MIN_REMNANT_SIDE_MM;
}

/** Reads the rows; the first problem stops it. */
export function readRemnantRows(rows: RemnantInput[]): { remnants: Remnant[]; error: string } {
  const remnants: Remnant[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const result = buildRemnant(rows[i]!, i + 1);
    if ('empty' in result) continue;
    if ('error' in result) return { remnants, error: result.error };
    remnants.push(result.remnant);
  }
  return { remnants, error: '' };
}

export function RemnantSheet({
  opened,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  onClose: () => void;
  /** Resolves when the cut is finished; an error it throws shows in the sheet. */
  onConfirm: (payload: { remnants: Remnant[]; no_remnant: boolean }) => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (id: number, patch: Partial<Row>) => {
    setError('');
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const confirm = async () => {
    const { remnants, error: problem } = readRemnantRows(rows);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await onConfirm({ remnants, no_remnant: remnants.length === 0 });
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : 'Hata oluştu. Lütfen tekrar deneyin.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      title="Fire Sac Ölçüleri"
      classNames={{ content: sheets.sheet }}
    >
      <Stack gap="sm" pb="md">
        <Text size="sm" c="dimmed">
          Kesimden artan kullanılabilir sacları şekli ve ölçüsüyle girin. Bunlar stoğa döner; kalanı
          fire sayılır. Kullanılabilir fire kalmadıysa boş bırakın.
        </Text>
        {rows.map((row, index) => {
          const fields = shapeFields(row.shape);
          return (
            <Paper key={row.id} withBorder p="sm">
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <NativeSelect
                  flex={1}
                  label="Şekil"
                  data={SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] }))}
                  value={row.shape}
                  onChange={(e) => update(row.id, { shape: e.currentTarget.value })}
                />
                <TextInput
                  w={84}
                  label="Adet"
                  inputMode="numeric"
                  value={row.quantity}
                  onChange={(e) => update(row.id, { quantity: e.currentTarget.value })}
                />
                <ActionIcon
                  color="red"
                  variant="light"
                  size={50}
                  aria-label={`${index + 1}. satırı sil`}
                  onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
                >
                  <IconTrash size={20} />
                </ActionIcon>
              </Group>
              <Group gap="xs" mt="xs" grow>
                {fields.map((f) => (
                  <TextInput
                    key={f.field}
                    label={f.label}
                    inputMode="decimal"
                    value={row[f.field]}
                    onChange={(e) => update(row.id, { [f.field]: e.currentTarget.value })}
                  />
                ))}
              </Group>
              {isScrap(row) ? (
                <Text size="xs" c="orange.8" mt={6}>
                  {row.shape === 'circle'
                    ? `Çapı ${MIN_REMNANT_SIDE_MM} mm'den küçük: stoğa alınmaz, fireye sayılır.`
                    : `Kısa kenarı ${MIN_REMNANT_SIDE_MM} mm'den kısa: stoğa alınmaz, fireye sayılır.`}
                </Text>
              ) : null}
            </Paper>
          );
        })}
        <Button
          variant="light"
          leftSection={<IconPlus size={18} />}
          onClick={() => setRows((l) => [...l, newRow()])}
        >
          Fire Sac Ekle
        </Button>
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        <Button color="green" loading={saving} onClick={() => void confirm()}>
          Görevi Tamamla
        </Button>
      </Stack>
    </Drawer>
  );
}

export interface RemnantCode {
  code: string;
  item_code?: string | null;
  item_name?: string | null;
  size: string;
  heat_number: string;
}

/** The booked remnant sheets that got a code (legacy remnantSheets). */
export function remnantCodes(
  booked: { remnants?: BookedRemnant[] | null } | null | undefined,
): RemnantCode[] {
  const out: RemnantCode[] = [];
  for (const r of booked?.remnants ?? []) {
    for (const sheet of r.sheets ?? []) {
      if (!sheet.code) continue;
      out.push({
        code: sheet.code,
        item_code: r.item_code,
        item_name: r.item_name,
        size: sizeText(r),
        heat_number: sheet.heat_number || '',
      });
    }
  }
  return out;
}

const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** Opens a print page of the codes (A4, large monospace codes), as the legacy page did. */
export function printRemnantCodes(title: string, codes: RemnantCode[]): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  const rows = codes
    .map(
      (s) =>
        `<tr><td class="code">${esc(s.code)}</td><td>${esc(s.item_code)}${
          s.item_name ? `<div class="small">${esc(s.item_name)}</div>` : ''
        }</td><td>${esc(s.size)}</td><td>${esc(s.heat_number || '–')}</td></tr>`,
    )
    .join('');
  win.document
    .write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body { font: 11pt/1.4 "Segoe UI", Arial, sans-serif; color: #111; margin: 12mm; }
      h1 { font-size: 14pt; margin: 0 0 4mm; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #999; padding: 2mm 2.5mm; text-align: left; vertical-align: middle; }
      th { background: #eee; font-size: 9.5pt; }
      td.code { font: 700 16pt/1.2 Consolas, "Courier New", monospace; white-space: nowrap; }
      .small { font-size: 9pt; color: #555; }
      tr { page-break-inside: avoid; }
      @page { size: A4; margin: 10mm; }
    </style></head><body><h1>${esc(title)}</h1>
    <table><thead><tr><th>Sac Kodu</th><th>Stok Kartı</th><th>Ölçü</th><th>Döküm No</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    try {
      win.print();
    } catch {
      /* the user can print from the window */
    }
  }, 50);
  return true;
}

export function RemnantCodesModal({
  codes,
  title,
  onDone,
  onPrintBlocked,
}: {
  codes: RemnantCode[] | null;
  title: string;
  onDone: () => void;
  onPrintBlocked: () => void;
}) {
  const heading = title ? `Fire sac kodları · ${title}` : 'Fire sac kodları';
  return (
    <Modal
      opened={!!codes}
      onClose={onDone}
      title="Görev tamamlandı · Fire sac kodları"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      size="lg"
    >
      <Stack gap="sm">
        <Alert color="blue">
          Her fire sacın üzerine kodunu yazın. Kod ile Sac Stoğu&apos;nda aratınca sacın kartı,
          ölçüsü ve döküm no&apos;su bulunur; kesimde de sac bu kodla seçilir.
        </Alert>
        <Table.ScrollContainer minWidth={420}>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sac Kodu</Table.Th>
                <Table.Th>Stok Kartı</Table.Th>
                <Table.Th>Ölçü</Table.Th>
                <Table.Th>Döküm No</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(codes ?? []).map((s) => (
                <Table.Tr key={s.code}>
                  <Table.Td ff="monospace" fw={700} fz="lg" style={{ whiteSpace: 'nowrap' }}>
                    {s.code}
                  </Table.Td>
                  <Table.Td>
                    {s.item_code}
                    {s.item_name ? (
                      <Text size="xs" c="dimmed">
                        {s.item_name}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{s.size}</Table.Td>
                  <Table.Td>{s.heat_number || '–'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group grow>
          <Button
            variant="default"
            leftSection={<IconPrinter size={18} />}
            onClick={() => {
              if (!printRemnantCodes(heading, codes ?? [])) onPrintBlocked();
            }}
          >
            Yazdır
          </Button>
          <Button color="green" onClick={onDone}>
            Kodları yazdım
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
