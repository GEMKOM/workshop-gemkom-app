import {
  Button,
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
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlayerPause, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  downtimeReasonsQueryOptions,
  logReason,
  machineOptionsQueryOptions,
  operationsQueryOptions,
  timerTaskPath,
  type Operation,
} from '@/api/machining';
import { timersChanged } from '@/api/timers';
import { DowntimeReasonSheet } from '@/ui/DowntimeReasonSheet';
import { FinishedTimers } from '@/ui/FinishedTimers';
import classes from './Machining.module.css';

// Legacy machining/: "Aktif" (pick a machine, its open planned operations,
// "Durma Nedeni Kaydet") and "Biten" (finished timers). The machine is in
// ?machine_id (pushed, so back returns to the previous machine).

function operationTitle(op: Operation): string {
  return op.part_task_key
    ? `${op.part_task_key} (${op.key || 'Operasyon'})`
    : op.key || 'Operasyon';
}

function OperationCard({ op, machineId }: { op: Operation; machineId: string }) {
  const fields: [string, unknown][] = [
    ['Parça', op.part_key || '-'],
    ['Sıra', op.plan_order || '-'],
    ...(op.part_job_no ? ([['İş Emri', op.part_job_no]] as [string, unknown][]) : []),
    ...(op.part_image_no ? ([['Resim', op.part_image_no]] as [string, unknown][]) : []),
    ...(op.part_position_no ? ([['Pozisyon', op.part_position_no]] as [string, unknown][]) : []),
    ...(op.part_quantity ? ([['Adet', op.part_quantity]] as [string, unknown][]) : []),
  ];
  return (
    <UnstyledButton
      component={Link}
      to={`/machining/tasks/?machine_id=${encodeURIComponent(machineId)}&key=${encodeURIComponent(op.key)}`}
      className={classes.opCard}
    >
      <Text fw={600} className={classes.opTitle}>
        {operationTitle(op)}
      </Text>
      <Text size="sm" c="dimmed" truncate>
        {op.part_name || op.name || 'Açıklama yok'}
      </Text>
      <div className={classes.opFields}>
        {fields.map(([label, value]) => (
          <span key={label}>
            <small>{label}</small> {String(value)}
          </span>
        ))}
      </div>
    </UnstyledButton>
  );
}

function ActiveOperations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const machineId = params.get('machine_id') ?? '';
  const machines = useQuery(machineOptionsQueryOptions('machining'));
  const reasons = useQuery({ ...downtimeReasonsQueryOptions(), enabled: !!machineId });
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const operations = useQuery({
    ...operationsQueryOptions(machineId, debounced),
    enabled: !!machineId,
  });
  const [reasonOpen, setReasonOpen] = useState(false);
  const timerReasons = (reasons.data ?? []).filter((r) => r.creates_timer);

  const machineData = [
    { value: '', label: 'Makine Seçiniz...' },
    ...(machines.data ?? []).map((m) => ({
      value: String(m.id),
      label: `${m.name}${m.has_active_timer ? ' (Kullanımda)' : ''}${
        m.is_under_maintenance ? ' (Bakımda)' : ''
      }`,
      // As the legacy dropdown: a busy machine or one under maintenance can't be picked.
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
              placeholder="TI, operasyon, iş emri, resim no veya parça adı"
              aria-label="Operasyon ara"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            <Button
              variant="default"
              px="md"
              aria-label="Yenile"
              onClick={() => void operations.refetch()}
              loading={operations.isRefetching}
            >
              <IconRefresh size={22} />
            </Button>
          </Group>

          {timerReasons.length > 0 ? (
            <UnstyledButton className={classes.reasonCard} onClick={() => setReasonOpen(true)}>
              <IconPlayerPause size={28} />
              <div>
                <Text fw={600}>Durma Nedeni Kaydet</Text>
                <Text size="sm">Makine durma nedenini seçin ve kaydedin</Text>
              </div>
            </UnstyledButton>
          ) : null}

          {operations.isPending ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : operations.isError ? (
            <Text c="red">Operasyonlar yüklenemedi.</Text>
          ) : operations.data.length === 0 ? (
            <Paper withBorder p="lg">
              <Text c="dimmed" ta="center">
                {debounced
                  ? 'Aramayla eşleşen operasyon yok.'
                  : 'Bu makinede planlı operasyon yok.'}
              </Text>
            </Paper>
          ) : (
            operations.data.map((op) => (
              <OperationCard key={op.key} op={op} machineId={machineId} />
            ))
          )}

          <DowntimeReasonSheet
            opened={reasonOpen}
            onClose={() => setReasonOpen(false)}
            reasons={reasons.data ?? []}
            onSubmit={async (reasonId, comment) => {
              const result = await logReason({
                reason_id: reasonId,
                machine_id: machineId,
                ...(comment ? { comment } : {}),
              });
              setReasonOpen(false);
              void timersChanged(queryClient);
              if (result.new_timer_id && result.timer) {
                void navigate(timerTaskPath('machining', result.timer));
              } else {
                void operations.refetch();
              }
            }}
          />
        </>
      ) : (
        <Paper withBorder p="lg">
          <Text c="dimmed" ta="center">
            Operasyonları görmek için bir makine seçin.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

export function MachiningPage() {
  const [tab, setTab] = useState<'active' | 'finished'>('active');
  return (
    <Stack gap="md">
      <SegmentedControl
        data={[
          { value: 'active', label: 'Aktif' },
          { value: 'finished', label: 'Biten' },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'active' | 'finished')}
      />
      {tab === 'active' ? <ActiveOperations /> : <FinishedTimers area="machining" />}
    </Stack>
  );
}
