import {
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { faultsQueryOptions, type Fault } from '@/api/maintenance';
import { formatDateTime } from '@/lib/format';
import classes from './Maintenance.module.css';

// Legacy maintenance/requests/: open faults (tap → the fault's timer page) and
// resolved requests (read-only), each with a search on the phone.

function matches(fault: Fault, term: string, withResolution: boolean): boolean {
  const haystack = [
    fault.machine_name || fault.asset_name,
    fault.description,
    withResolution ? fault.resolution_description : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr');
  return haystack.includes(term);
}

function OpenFault({ fault }: { fault: Fault }) {
  return (
    <UnstyledButton
      component={Link}
      to={`/maintenance/faults/task/?fault_id=${encodeURIComponent(fault.id)}`}
      className={classes.faultCard}
      data-breaking={fault.is_breaking || undefined}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text fw={600} truncate>
          {fault.machine_name || fault.asset_name || 'Makine'}
        </Text>
        {fault.is_breaking ? (
          <Badge color="red" variant="filled" style={{ flex: 'none' }}>
            Makine duruşta
          </Badge>
        ) : (
          <Badge color="yellow" variant="light" style={{ flex: 'none' }}>
            {fault.is_maintenance ? 'Bakım' : 'Arıza'}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed" lineClamp={2}>
        {fault.description || 'Açıklama yok'}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        Bildirim: {formatDateTime(fault.reported_at) || '-'}
      </Text>
    </UnstyledButton>
  );
}

function ResolvedFault({ fault }: { fault: Fault }) {
  return (
    <Paper withBorder p="md" className={classes.resolvedCard}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text fw={600} truncate>
          {fault.machine_name || fault.asset_name || 'Makine'}
        </Text>
        <IconCircleCheck size={20} color="var(--mantine-color-green-7)" style={{ flex: 'none' }} />
      </Group>
      <Text size="sm" c="dimmed">
        {fault.is_maintenance ? 'Bakım' : 'Arıza'} - {fault.description || 'Açıklama yok'}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        Çözüm: {formatDateTime(fault.resolved_at) || '-'}
      </Text>
      {fault.resolution_description ? (
        <Text size="sm" mt={4} className={classes.preWrap}>
          {fault.resolution_description}
        </Text>
      ) : null}
    </Paper>
  );
}

export function FaultList({ unresolved }: { unresolved: boolean }) {
  const faults = useQuery(faultsQueryOptions(unresolved));
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase('tr');
  const list = (faults.data ?? []).filter((f) => !term || matches(f, term, !unresolved));

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap">
        <TextInput
          flex={1}
          leftSection={<IconSearch size={18} />}
          placeholder={
            unresolved
              ? 'Makine adı veya açıklama ile ara...'
              : 'Makine, açıklama veya çözüm ile ara...'
          }
          aria-label="Ara"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Button
          variant="default"
          px="md"
          aria-label="Yenile"
          onClick={() => void faults.refetch()}
          loading={faults.isRefetching}
        >
          <IconRefresh size={22} />
        </Button>
      </Group>
      {faults.isPending ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : faults.isError ? (
        <Paper withBorder p="lg" ta="center">
          <IconAlertTriangle size={36} color="var(--gk-danger)" />
          <Text fw={600}>Talepler yüklenemedi</Text>
          <Button variant="light" mt="sm" onClick={() => void faults.refetch()}>
            Tekrar dene
          </Button>
        </Paper>
      ) : list.length === 0 ? (
        <Paper withBorder p="lg">
          <Text c="dimmed" ta="center">
            {term
              ? 'Aramayla eşleşen talep yok.'
              : unresolved
                ? 'Açık bakım veya arıza talebi yok.'
                : 'Çözülmüş talep yok.'}
          </Text>
        </Paper>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            {list.length} talep
          </Text>
          {list.map((fault) =>
            unresolved ? (
              <OpenFault key={fault.id} fault={fault} />
            ) : (
              <ResolvedFault key={fault.id} fault={fault} />
            ),
          )}
        </>
      )}
    </Stack>
  );
}
