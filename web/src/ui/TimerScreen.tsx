import { Badge, Group, Paper, Text, Title } from '@mantine/core';
import { IconClock, IconPlayerPlay } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { formatElapsed, useSyncedNow } from '@/api/time';
import classes from './TimerScreen.module.css';

export interface TimerDetail {
  label: string;
  value: ReactNode;
  /** Takes the whole row (long text). */
  wide?: boolean;
}

/**
 * The task timer screen shared by machining, CNC and fault tasks (the legacy
 * pages each had their own): what is being worked on, a large elapsed time on
 * server time, its details, and below them whatever the page adds. The page
 * puts its buttons in a StickyActions bar.
 */
export function TimerScreen({
  title,
  subtitle,
  startTime,
  details,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Epoch ms of the running timer; null when none runs. */
  startTime: number | null;
  details: TimerDetail[];
  children?: ReactNode;
}) {
  const running = startTime != null;
  const now = useSyncedNow(running);

  return (
    <div className={classes.screen}>
      <Paper withBorder p="md" className={classes.head}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <div className={classes.titles}>
            <Title order={2} fz={22} className={classes.title}>
              {title}
            </Title>
            {subtitle ? (
              <Text c="dimmed" size="sm">
                {subtitle}
              </Text>
            ) : null}
          </div>
          <Badge
            size="lg"
            variant={running ? 'filled' : 'light'}
            color={running ? 'green' : 'gray'}
            leftSection={running ? <IconPlayerPlay size={14} /> : <IconClock size={14} />}
          >
            {running ? 'Çalışıyor' : 'Beklemede'}
          </Badge>
        </Group>
        <div className={classes.clock} data-running={running || undefined} role="timer">
          {formatElapsed(running ? (now - startTime) / 1000 : 0)}
        </div>
      </Paper>

      {details.length > 0 ? (
        <div className={classes.details}>
          {details.map((detail) => (
            <Paper
              key={detail.label}
              withBorder
              p="sm"
              className={classes.detail}
              data-wide={detail.wide || undefined}
            >
              <Text size="xs" c="dimmed">
                {detail.label}
              </Text>
              <Text size="sm" fw={500} className={classes.detailValue}>
                {detail.value ?? '-'}
              </Text>
            </Paper>
          ))}
        </div>
      ) : null}

      {children}
    </div>
  );
}
