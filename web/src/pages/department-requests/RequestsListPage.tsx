import {
  Badge,
  Button,
  Group,
  Loader,
  NativeSelect,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertTriangle, IconClipboardList, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  myRequestsQueryOptions,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type DepartmentRequest,
} from '@/api/departmentRequests';
import { formatDate, formatDateTime } from '@/lib/format';
import classes from './DepartmentRequests.module.css';

// Legacy department-requests/list.js: the user's own requests as cards.

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  submitted: 'yellow',
  approved: 'green',
  rejected: 'red',
  transferred: 'blue',
  cancelled: 'gray',
};

const PRIORITY_COLOR: Record<string, string> = {
  normal: 'gray',
  urgent: 'orange',
  critical: 'red',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value}
      </Text>
    </div>
  );
}

function RequestCard({ request }: { request: DepartmentRequest }) {
  const priority =
    PRIORITY_OPTIONS.find((p) => p.value === request.priority) ?? PRIORITY_OPTIONS[0]!;
  const statusLabel =
    request.status_label ?? STATUS_OPTIONS.find((s) => s.value === request.status)?.label;
  return (
    <Paper withBorder p="md" className={classes.card} data-request-id={request.id}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text ff="monospace" fw={600} size="sm">
          #{request.request_number}
        </Text>
        <Badge color={STATUS_COLOR[request.status] ?? 'gray'} variant="light">
          {statusLabel}
        </Badge>
      </Group>
      <Text fw={600} fz="lg" mt={4}>
        {request.title || 'Başlıksız Talep'}
      </Text>
      <div className={classes.fields}>
        <Field
          label="Talep Eden"
          value={request.requestor_full_name || request.requestor_username || '-'}
        />
        <Field label="Departman" value={request.department || '-'} />
        <Field label="İhtiyaç Tarihi" value={formatDate(request.needed_date) || '-'} />
        <Field label="Oluşturulma" value={formatDateTime(request.created_at) || '-'} />
        {request.items && request.items.length > 0 ? (
          <Field label="Ürün Sayısı" value={`${request.items.length} ürün`} />
        ) : null}
      </div>
      {request.description ? (
        <Text size="sm" c="dimmed" mt="sm" className={classes.description}>
          {request.description}
        </Text>
      ) : null}
      <Group mt="sm" gap="xs">
        <Badge color={PRIORITY_COLOR[priority.value]} variant="outline">
          {priority.label}
        </Badge>
      </Group>
    </Paper>
  );
}

export function RequestsListPage() {
  const requests = useInfiniteQuery(myRequestsQueryOptions());
  const [status, setStatus] = useState('');
  const all = requests.data?.pages.flatMap((page) => page.results) ?? [];
  const shown = status ? all.filter((r) => r.status === status) : all;

  return (
    <Stack gap="md">
      <Group gap="sm" wrap="nowrap">
        <Button
          component={Link}
          to="/department-requests/create/"
          leftSection={<IconPlus size={20} />}
          flex={1}
        >
          Yeni Talep
        </Button>
        <Button
          variant="default"
          px="md"
          aria-label="Yenile"
          onClick={() => void requests.refetch()}
          loading={requests.isRefetching}
        >
          <IconRefresh size={22} />
        </Button>
      </Group>

      <NativeSelect
        label="Durum"
        data={STATUS_OPTIONS}
        value={status}
        onChange={(event) => setStatus(event.currentTarget.value)}
      />

      {requests.isPending ? (
        <Stack align="center" py="xl" gap="xs">
          <Loader />
          <Text c="dimmed">Talepler yükleniyor...</Text>
        </Stack>
      ) : requests.isError ? (
        <Paper withBorder p="lg">
          <Stack align="center" ta="center" gap="xs">
            <IconAlertTriangle size={40} color="var(--gk-danger)" />
            <Text fw={600}>Hata Oluştu</Text>
            <Text size="sm" c="dimmed">
              Talepler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.
            </Text>
            <Button variant="light" onClick={() => void requests.refetch()}>
              Yenile
            </Button>
          </Stack>
        </Paper>
      ) : shown.length === 0 ? (
        <Paper withBorder p="lg">
          <Stack align="center" ta="center" gap="xs">
            <ThemeIcon size={56} radius="xl" variant="light">
              <IconClipboardList size={30} />
            </ThemeIcon>
            <Text fw={600}>Talep Bulunamadı</Text>
            <Text size="sm" c="dimmed">
              {all.length === 0
                ? 'Henüz hiç departman talebi oluşturulmamış.'
                : 'Seçili filtrelerle eşleşen talep bulunamadı.'}
            </Text>
          </Stack>
        </Paper>
      ) : (
        shown.map((request) => <RequestCard key={request.id} request={request} />)
      )}

      {requests.hasNextPage ? (
        <Button
          variant="light"
          onClick={() => void requests.fetchNextPage()}
          loading={requests.isFetchingNextPage}
        >
          Daha fazla
        </Button>
      ) : null}
    </Stack>
  );
}
