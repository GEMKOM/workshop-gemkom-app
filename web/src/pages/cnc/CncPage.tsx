import {
  Button,
  Drawer,
  Group,
  Loader,
  NativeSelect,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconPlayerPause, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  cncMachinesQueryOptions,
  holdTasksQueryOptions,
  machineCutsQueryOptions,
  type CncTask,
} from '@/api/cnc';
import { formatDate } from '@/lib/format';
import { isPorted } from '@/shell/areas';
import { SiteLink } from '@/shell/SiteLink';
import { FinishedTimers } from '@/ui/FinishedTimers';
import sheets from '@/ui/Sheets.module.css';
import classes from './Cnc.module.css';
import { CncOverview } from './CncOverview';
import { PlateStock } from './PlateStock';

// Legacy cnc_cutting/: Aktif (a machine's next planned cuts, "Diğer İşler" for
// putting the machine on hold), Biten, Görev Genel Bakış and Sac Stoğu.

export function cutTaskPath(machineId: string, key: string, hold?: { name: string }): string {
  const params = new URLSearchParams({ machine_id: machineId, key });
  if (hold) {
    params.set('name', hold.name);
    params.set('hold', '1');
  }
  return `/cnc_cutting/tasks/?${params.toString()}`;
}

function CutCard({ task, machineId }: { task: CncTask; machineId: string }) {
  const fields: [string, string][] = [
    ['Malzeme', task.material || '-'],
    ['Boyutlar', task.dimensions || '-'],
    ['Kalınlık', task.thickness_mm ? `${task.thickness_mm} mm` : '-'],
    ['Parça', String(task.parts?.length ?? task.parts_count ?? '-')],
    ['Adet', task.quantity ? String(task.quantity) : '-'],
    ...(task.finish_time ? ([['Bitiş', formatDate(task.finish_time)]] as [string, string][]) : []),
  ];
  return (
    <UnstyledButton
      component={SiteLink}
      to={cutTaskPath(machineId, task.key)}
      className={classes.card}
    >
      <Text fw={700} className={classes.code}>
        {task.nesting_id || 'Görev'}
      </Text>
      <Text size="sm" c="dimmed">
        {task.key}
      </Text>
      <div className={classes.fields}>
        {fields.map(([label, value]) => (
          <span key={label}>
            <small>{label}</small> {value}
          </span>
        ))}
      </div>
    </UnstyledButton>
  );
}

function HoldSheet({
  opened,
  onClose,
  machineId,
}: {
  opened: boolean;
  onClose: () => void;
  machineId: string;
}) {
  const navigate = useNavigate();
  const holds = useQuery({ ...holdTasksQueryOptions(), enabled: opened });
  const [key, setKey] = useState('');
  const list = holds.data ?? [];
  const chosen = list.find((h) => h.key === key) ?? list[0];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      title="Bekletme Nedeni Seç"
      classNames={{ content: sheets.sheet }}
    >
      <Stack gap="sm" pb="md">
        <Text size="sm" c="dimmed">
          Makineyi bekletme nedenini seçin:
        </Text>
        {holds.isPending ? (
          <Group justify="center">
            <Loader />
          </Group>
        ) : holds.isError ? (
          <Text c="red">Bekletme nedenleri alınamadı</Text>
        ) : (
          <NativeSelect
            aria-label="Bekletme nedeni"
            data={list.map((h) => ({ value: h.key, label: h.name || h.job_no || h.key }))}
            value={chosen?.key ?? ''}
            onChange={(e) => setKey(e.currentTarget.value)}
          />
        )}
        <Button
          disabled={!chosen}
          onClick={() => {
            if (!chosen) return;
            const path = cutTaskPath(machineId, chosen.key, {
              name: chosen.name || chosen.job_no || chosen.key,
            });
            onClose();
            // A page not yet in this app (during the pilot) is a full page load.
            if (isPorted(path)) void navigate(path);
            else window.location.assign(path);
          }}
        >
          Seç
        </Button>
      </Stack>
    </Drawer>
  );
}

function CncActive() {
  const [params, setParams] = useSearchParams();
  const machineId = params.get('machine_id') ?? '';
  const machines = useQuery(cncMachinesQueryOptions());
  const cuts = useQuery({ ...machineCutsQueryOptions(machineId), enabled: !!machineId });
  const [search, setSearch] = useState('');
  const [holdOpen, setHoldOpen] = useState(false);
  const term = search.trim().toLocaleLowerCase('tr');
  const list = (cuts.data ?? []).filter(
    (t) =>
      !term ||
      t.key.toLocaleLowerCase('tr').includes(term) ||
      (t.name ?? '').toLocaleLowerCase('tr').includes(term),
  );

  const machineData = [
    { value: '', label: 'Makine Seçiniz...' },
    ...(machines.data ?? []).map((m) => ({
      value: String(m.id),
      label: `${m.name}${m.has_active_timer ? ' (Kullanımda)' : ''}${m.is_under_maintenance ? ' (Bakımda)' : ''}`,
      disabled: !!(m.has_active_timer || m.is_under_maintenance) && String(m.id) !== machineId,
    })),
  ];

  return (
    <Stack gap="sm">
      <NativeSelect
        label="Makine"
        description="Çalışmak istediğiniz makineyi seçin"
        data={machineData}
        value={machineId}
        disabled={machines.isPending}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setParams(value ? { machine_id: value } : {});
        }}
      />
      {machineId ? (
        <>
          <Group gap="sm" wrap="nowrap">
            <TextInput
              flex={1}
              leftSection={<IconSearch size={18} />}
              placeholder="TI numarası ile ara..."
              aria-label="Kesim ara"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Button
              variant="default"
              px="md"
              aria-label="Yenile"
              onClick={() => void cuts.refetch()}
              loading={cuts.isRefetching}
            >
              <IconRefresh size={22} />
            </Button>
          </Group>
          {/* Shown whatever the cuts are: the legacy list hid it on a machine with none. */}
          <UnstyledButton className={classes.holdCard} onClick={() => setHoldOpen(true)}>
            <IconPlayerPause size={28} />
            <div>
              <Text fw={600}>Diğer İşler</Text>
              <Text size="sm">
                Makineyi bekletme (Arıza, fabrika işleri, malzeme bekleme, yemek molası, izin, vs)
                için tıklayın
              </Text>
            </div>
          </UnstyledButton>
          {cuts.isPending ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : cuts.isError ? (
            <Text c="red">Görevler yüklenemedi.</Text>
          ) : list.length === 0 ? (
            <Paper withBorder p="lg">
              <Text c="dimmed" ta="center">
                {term ? 'Aramayla eşleşen kesim yok.' : 'Bu makinede planlı kesim yok.'}
              </Text>
            </Paper>
          ) : (
            list.map((task) => <CutCard key={task.key} task={task} machineId={machineId} />)
          )}
          <HoldSheet opened={holdOpen} onClose={() => setHoldOpen(false)} machineId={machineId} />
        </>
      ) : (
        <Paper withBorder p="lg">
          <Text c="dimmed" ta="center">
            Kesimleri görmek için bir makine seçin.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

type Tab = 'active' | 'finished' | 'overview' | 'plates';

export function CncPage() {
  const [tab, setTab] = useState<Tab>('active');
  return (
    <Stack gap="md">
      <SegmentedControl
        size="sm"
        data={[
          { value: 'active', label: 'Aktif' },
          { value: 'finished', label: 'Biten' },
          { value: 'overview', label: 'Genel Bakış' },
          { value: 'plates', label: 'Sac Stoğu' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as Tab)}
      />
      {tab === 'active' ? <CncActive /> : null}
      {tab === 'finished' ? <FinishedTimers area="cnc_cutting" /> : null}
      {tab === 'overview' ? <CncOverview /> : null}
      {tab === 'plates' ? <PlateStock /> : null}
    </Stack>
  );
}
