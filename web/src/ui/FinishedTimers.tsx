import { Group, Loader, Pagination, Paper, Stack, Text, TextInput } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  FINISHED_PAGE_SIZE,
  finishedTimersQueryOptions,
  type ModuleTimer,
  type TimerArea,
} from '@/api/machining';
import { formatDateTime } from '@/lib/format';
import classes from './FinishedTimers.module.css';

// The legacy "Biten" tab of machining and CNC (finishedTimers.js, the same
// page twice): finished timers, newest first, 20 a page, for a date range that
// starts as the last 30 days.

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hours (decimal) as "1s 25dk" / "45dk" / "0dk" (legacy formatDurationFromHoursToMinutes). */
export function formatDuration(hours: unknown): string {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return '0dk';
  const minutes = Math.round(h * 60);
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return whole > 0 ? `${whole}s ${rest}dk` : `${rest}dk`;
}

function TimerCard({ timer }: { timer: ModuleTimer }) {
  return (
    <Paper withBorder p="md" className={classes.card}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text fw={600} truncate>
          {timer.issue_key || 'Bilinmeyen İş'}
        </Text>
        <Text fw={600} c="green.8" style={{ flex: 'none' }}>
          {formatDuration(timer.duration)}
        </Text>
      </Group>
      <Text size="sm" c="dimmed" truncate>
        {timer.issue_name || 'Açıklama yok'}
      </Text>
      <div className={classes.fields}>
        <span>Makine</span>
        <b>{timer.machine_name || 'Bilinmeyen'}</b>
        <span>Kullanıcı</span>
        <b>{timer.username || 'Bilinmeyen'}</b>
        <span>Başlangıç</span>
        <b>{formatDateTime(timer.start_time) || '-'}</b>
        <span>Bitiş</span>
        <b>{formatDateTime(timer.finish_time) || '-'}</b>
        <span>İş Emri</span>
        <b>{timer.job_no || '-'}</b>
      </div>
    </Paper>
  );
}

export function FinishedTimers({ area }: { area: TimerArea }) {
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  });
  const [end, setEnd] = useState(() => isoDate(new Date()));
  const [page, setPage] = useState(1);
  const timers = useQuery(finishedTimersQueryOptions(area, page, start, end));
  const count = timers.data?.count ?? timers.data?.results.length ?? 0;
  const pages = Math.ceil(count / FINISHED_PAGE_SIZE);

  return (
    <Stack gap="sm">
      <div className={classes.range}>
        <TextInput
          type="date"
          label="Başlangıç Tarihi"
          value={start}
          onChange={(e) => {
            setStart(e.currentTarget.value);
            setPage(1);
          }}
        />
        <TextInput
          type="date"
          label="Bitiş Tarihi"
          value={end}
          onChange={(e) => {
            setEnd(e.currentTarget.value);
            setPage(1);
          }}
        />
      </div>
      {timers.isPending ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : timers.isError ? (
        <Text c="red">Zamanlayıcılar yüklenemedi.</Text>
      ) : timers.data.results.length === 0 ? (
        <Paper withBorder p="lg">
          <Group gap="xs" justify="center" c="dimmed">
            <IconCircleCheck size={20} />
            <Text>Bu aralıkta biten zamanlayıcı yok.</Text>
          </Group>
        </Paper>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            {count} kayıt
          </Text>
          {timers.data.results.map((timer) => (
            <TimerCard key={timer.id} timer={timer} />
          ))}
          {pages > 1 ? (
            <Group justify="center">
              <Pagination total={pages} value={page} onChange={setPage} siblings={0} size="md" />
            </Group>
          ) : null}
        </>
      )}
    </Stack>
  );
}
