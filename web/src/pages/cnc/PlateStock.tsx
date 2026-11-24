import {
  Badge,
  Group,
  Loader,
  Pagination,
  Paper,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  Button,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  PLATE_PAGE_SIZE,
  plateGroupsQueryOptions,
  type PlateGroup,
  type PlatePiece,
} from '@/api/cnc';
import { errorText } from '@/ui/notify';
import { formatNumber, normalizeShape, sheetCodeFromSearch, sizeText } from '@/lib/plateShape';
import classes from './Cnc.module.css';

// Legacy cnc_cutting/plateStock.js (Sac Stoğu): the plates in stock grouped by
// card and size, each sheet with its code, heat number, place and whether it
// is free or set aside for a cut or a pull request.

const SEARCH_DELAY_MS = 350;
const qty = (value: unknown) => Number(value) || 0;

/** "(1 kesime ayrılmış, 1 çıkış talebine ayrılmış)" for a group's set-aside sheets. */
export function reservedSummary(pieces: PlatePiece[]): string {
  const reserved = pieces.reduce((sum, p) => sum + qty(p.reserved_quantity), 0);
  if (!reserved) return '';
  let forCuts = 0;
  let forPulls = 0;
  for (const p of pieces) {
    for (const r of p.reservations ?? []) {
      if (r.cnc_task) forCuts += qty(r.quantity);
      else if (r.pull_request) forPulls += qty(r.quantity);
    }
  }
  const parts: string[] = [];
  if (forCuts) parts.push(`${forCuts} kesime ayrılmış`);
  if (forPulls) parts.push(`${forPulls} çıkış talebine ayrılmış`);
  if (!parts.length || forCuts + forPulls < reserved) {
    const rest = reserved - forCuts - forPulls;
    parts.push(`${parts.length ? rest : reserved} ayrılmış`);
  }
  return `(${parts.join(', ')})`;
}

function totalKg(pieces: PlatePiece[]): string {
  if (
    !pieces.length ||
    pieces.some((p) => p.total_kg === null || p.total_kg === undefined || p.total_kg === '')
  ) {
    return '';
  }
  const kg = pieces.reduce((sum, p) => sum + Number(p.total_kg), 0);
  return Number.isFinite(kg)
    ? `${kg.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`
    : '';
}

function placeText(p: PlatePiece): string {
  const place = p.supplier_name
    ? `Fason: ${p.supplier_name}`
    : p.warehouse_name || p.warehouse_code || '–';
  return p.job_no ? `${place} · İş Emri ${p.job_no}` : place;
}

function StateBadges({ piece }: { piece: PlatePiece }) {
  const quantity = qty(piece.quantity);
  const reserved = qty(piece.reserved_quantity);
  if (!reserved) {
    return (
      <Badge color="green" variant="light">
        Boşta
      </Badge>
    );
  }
  const many = quantity > 1;
  const badges = (piece.reservations ?? [])
    .map((r) => {
      const amount = many ? `${qty(r.quantity)} adet ` : '';
      if (r.cnc_task) return `${amount}${r.cnc_task} kesimine ayrılmış`;
      if (r.pull_request) return `${amount}${r.pull_request} nolu çıkış talebine ayrılmış`;
      return '';
    })
    .filter(Boolean);
  if (!badges.length) badges.push(`${many ? `${reserved} adet ` : ''}Ayrılmış`);
  const free = qty(piece.available_quantity);
  return (
    <>
      {badges.map((text) => (
        <Badge key={text} color="yellow" variant="light" className={classes.wrapBadge}>
          {text}
        </Badge>
      ))}
      {free > 0 ? (
        <Badge color="green" variant="light">
          {free} adet boşta
        </Badge>
      ) : null}
    </>
  );
}

function Sheet({
  piece,
  showSize,
  match,
}: {
  piece: PlatePiece;
  showSize: boolean;
  match: boolean;
}) {
  const origin = [piece.origin_label, piece.parent_code ? `${piece.parent_code} sacından` : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={classes.sheetRow} data-match={match || undefined}>
      <Group gap="xs" wrap="wrap">
        {piece.code ? (
          <Text ff="monospace" fw={700} fz="lg">
            {piece.code}
          </Text>
        ) : (
          <Text c="dimmed" fs="italic">
            Kodsuz
          </Text>
        )}
        {qty(piece.quantity) > 1 ? <Badge color="gray">{qty(piece.quantity)} adet</Badge> : null}
        {showSize ? <Text size="sm">{sizeText(piece)}</Text> : null}
      </Group>
      <Text size="sm">
        <Text span c="dimmed">
          Döküm no:
        </Text>{' '}
        {piece.heat_number || '–'} · {placeText(piece)}
      </Text>
      <Group gap={4} mt={4}>
        <StateBadges piece={piece} />
      </Group>
      {origin ? (
        <Text size="xs" c="dimmed" mt={2}>
          {origin}
        </Text>
      ) : null}
    </div>
  );
}

function GroupCard({ group, search }: { group: PlateGroup; search: string }) {
  const pieces = group.pieces ?? [];
  const first = pieces[0] ?? ({} as PlatePiece);
  const shape = normalizeShape(group.shape);
  const areasMatch = new Set(pieces.map((p) => String(p.area_m2 ?? ''))).size === 1;
  const size = sizeText({
    shape,
    width_mm: group.width_mm,
    length_mm: group.length_mm,
    area_m2: areasMatch ? first.area_m2 : null,
  });
  const thickness = formatNumber(first.plate_thickness_mm, 2);
  const weight = totalKg(pieces);
  const reserved = reservedSummary(pieces);
  const count = qty(group.quantity) || pieces.reduce((sum, p) => sum + qty(p.quantity), 0);
  const single = pieces.length === 1;
  const [open, setOpen] = useState(single || !!search);
  const searchedCode = sheetCodeFromSearch(search);
  const searched = search.toLowerCase();

  const head = (
    <Group align="flex-start" wrap="nowrap" gap="sm">
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text fw={600}>
          <Text span ff="monospace">
            {group.item_code || first.item_code}
          </Text>{' '}
          {first.item_name ? (
            <Text span c="dimmed" fw={400}>
              {first.item_name}
            </Text>
          ) : null}
        </Text>
        <Text size="sm" c="dimmed">
          {[thickness ? `${thickness} mm` : '', size, weight].filter(Boolean).join(' · ')}
        </Text>
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <Text fw={700}>{count} sac</Text>
        {reserved ? (
          <Text size="xs" c="yellow.9">
            {reserved}
          </Text>
        ) : null}
      </div>
      {single ? null : (
        <IconChevronDown size={20} className={classes.chevron} data-open={open || undefined} />
      )}
    </Group>
  );

  return (
    <Paper withBorder className={classes.group}>
      {single ? (
        <div className={classes.groupHead}>{head}</div>
      ) : (
        <UnstyledButton
          className={classes.groupHead}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {head}
        </UnstyledButton>
      )}
      {open ? (
        <div>
          {pieces.map((p) => (
            <Sheet
              key={p.id}
              piece={p}
              showSize={normalizeShape(p.shape) !== shape || (shape === 'irregular' && !areasMatch)}
              match={!!p.code && (p.code === searchedCode || p.code.toLowerCase() === searched)}
            />
          ))}
        </div>
      ) : null}
    </Paper>
  );
}

export function PlateStock() {
  const [input, setInput] = useState('');
  const [debounced] = useDebouncedValue(input.trim(), SEARCH_DELAY_MS);
  const [page, setPage] = useState(1);
  const search = debounced;
  const groups = useQuery(plateGroupsQueryOptions(page, search));
  const data = groups.data;
  const count = Number(data?.count) || data?.results.length || 0;
  const pages = Math.ceil(count / PLATE_PAGE_SIZE);

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Depodaki saclar, her biri üzerindeki koduyla. Fire saclar kesim bitirilirken stoğa girer.
      </Text>
      <TextInput
        type="search"
        autoComplete="off"
        leftSection={<IconSearch size={18} />}
        rightSection={
          input ? (
            <UnstyledButton aria-label="Aramayı temizle" onClick={() => setInput('')}>
              <IconX size={18} />
            </UnstyledButton>
          ) : null
        }
        placeholder="Sac kodu, malzeme, ölçü (1500x3000), döküm no…"
        aria-label="Sac ara"
        value={input}
        onChange={(e) => {
          setInput(e.currentTarget.value);
          setPage(1);
        }}
      />
      {groups.isPending ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : groups.isError ? (
        <Paper withBorder p="lg" ta="center">
          <Text c="red" fw={600}>
            Sac stoğu yüklenemedi
          </Text>
          <Text size="sm" c="dimmed">
            {errorText(groups.error, 'Bir hata oluştu. Lütfen tekrar deneyin.')}
          </Text>
          <Button variant="light" mt="sm" onClick={() => void groups.refetch()}>
            Tekrar Dene
          </Button>
        </Paper>
      ) : data && data.results.length === 0 ? (
        <Paper withBorder p="lg" ta="center">
          <Text fw={600}>{search ? 'Aramaya uyan sac bulunamadı' : 'Stokta sac yok'}</Text>
          <Text size="sm" c="dimmed">
            {search
              ? 'Sac kodunu, malzemeyi veya ölçüyü kontrol edip tekrar deneyin.'
              : 'Depoya alınan saclar ve kesimden dönen fire saclar burada görünür.'}
          </Text>
        </Paper>
      ) : data ? (
        <>
          <Text size="sm" c="dimmed">
            {count} ölçü grubu
          </Text>
          {data.results.map((group, i) => (
            <GroupCard
              key={`${data.page}-${search}-${group.item_code}-${group.width_mm}-${group.length_mm}-${group.shape}-${i}`}
              group={group}
              search={search}
            />
          ))}
          {pages > 1 ? (
            <Group justify="center">
              <Pagination total={pages} value={data.page} onChange={setPage} siblings={0} />
            </Group>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
