import { Badge, Button, Center, Loader } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  activeOnMachineQueryOptions,
  downtimeReasonsQueryOptions,
  logReason,
  machineQueryOptions,
  operationQueryOptions,
  startOperationTimer,
  stopModuleTimer,
  type ModuleTimer,
  type Operation,
} from '@/api/machining';
import { syncedNow, syncServerTime } from '@/api/time';
import { timersChanged } from '@/api/timers';
import { formatDate } from '@/lib/format';
import { DowntimeReasonSheet } from '@/ui/DowntimeReasonSheet';
import { errorText, notify } from '@/ui/notify';
import { StickyActions } from '@/ui/StickyActions';
import { TimerScreen, type TimerDetail } from '@/ui/TimerScreen';
import { useLeaveGuard } from '@/ui/useLeaveGuard';

// Legacy machining/tasks: an operation's timer (?machine_id&key), or a break /
// downtime timer (?machine_id&timer_id). Start on the operation, stop a
// productive timer with a downtime reason (then back to the list), stop other
// timers directly unless they can't be stopped by the user.

const LIST = '/machining/';

export function MachiningTaskPage() {
  const [params] = useSearchParams();
  const machineId = params.get('machine_id');
  if (!machineId) return <Navigate to={LIST} replace />;
  return (
    <MachiningTask
      key={params.toString()}
      machineId={machineId}
      operationKey={params.get('key')}
      timerId={params.get('timer_id')}
    />
  );
}

/** The page's running timer, as the legacy init picked it. */
function pickTimer(timers: ModuleTimer[], timerId: string | null): ModuleTimer | null {
  if (timerId) return timers.find((t) => String(t.id) === timerId) ?? null;
  return timers[0] ?? null;
}

function details(op: Operation | undefined): TimerDetail[] {
  if (!op) return [];
  const allocations = op.part_job_allocations ?? [];
  const multi = allocations.length > 1;
  const total = allocations.reduce(
    (sum, a) => sum + (Number.parseInt(String(a.quantity), 10) || 0),
    0,
  );
  return [
    { label: 'Sıra', value: op.order || '-' },
    {
      label: 'İş Emri',
      value: multi
        ? allocations.map((a) => `${a.job_no} (${a.quantity})`).join(' · ')
        : op.part_job_no || '-',
    },
    { label: 'Resim No', value: op.part_image_no || '-' },
    { label: 'Poz No', value: op.part_position_no || '-' },
    { label: 'Adet', value: op.part_quantity || (multi ? total : null) || '-' },
    {
      label: 'Termin',
      value: (
        <>
          {formatDate(op.due_date) || '—'}{' '}
          {op.projected_late ? (
            <Badge color="red" size="sm" title="Tahmini bitiş termini aşıyor">
              Geç
            </Badge>
          ) : null}
        </>
      ),
    },
  ];
}

function MachiningTask({
  machineId,
  operationKey,
  timerId,
}: {
  machineId: string;
  operationKey: string | null;
  timerId: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const machine = useQuery(machineQueryOptions(machineId));
  // By timer_id the page looks among all of the machine's timers; by key, the task's.
  const timers = useQuery(
    activeOnMachineQueryOptions('machining', machineId, timerId ? null : operationKey),
  );
  const running = timers.data ? pickTimer(timers.data, timerId) : null;
  // The operation: the page's key, else the running productive timer's task.
  const opKey =
    operationKey ??
    (running?.timer_type === 'productive' && running.issue_key ? running.issue_key : null);
  const operation = useQuery({ ...operationQueryOptions(opKey ?? ''), enabled: !!opKey });
  const reasons = useQuery(downtimeReasonsQueryOptions());
  const [busy, setBusy] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const guard = useLeaveGuard(running != null);

  // As the legacy page: a timer page whose timer no longer runs (stopped here,
  // elsewhere, or by an admin), or an operation that can't be loaded, goes back
  // to the list.
  const gone =
    (timerId != null && timers.isSuccess && !running) ||
    (operationKey != null && !running && operation.isError);
  useEffect(() => {
    if (!gone) return;
    guard.allowNextLeave();
    void navigate(LIST, { replace: true });
  }, [gone, guard, navigate]);

  if (machine.isPending || timers.isPending || (opKey && operation.isPending) || gone) {
    return (
      <Center mih="50dvh">
        <Loader />
      </Center>
    );
  }
  if (machine.isError) {
    return <Navigate to={LIST} replace />;
  }

  const op = operation.data;
  const productive =
    running?.timer_type === 'productive' && !!running.issue_key && !!op && !!operationKey;
  const title =
    running && running.timer_type !== 'productive' && running.downtime_reason_name
      ? running.downtime_reason_name
      : op
        ? op.part_task_key
          ? `${op.part_task_key} (${op.key})`
          : op.key
        : running?.issue_key || `TIMER-${running?.id ?? ''}`;
  const subtitle =
    op?.part_name ||
    op?.name ||
    running?.issue_name ||
    running?.downtime_reason_name ||
    machine.data.name;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['moduleTimers', 'machining'] }),
      queryClient.invalidateQueries({ queryKey: ['machines'] }),
    ]);
    void timersChanged(queryClient);
  };

  const start = async () => {
    if (!op) return;
    setBusy(true);
    try {
      await syncServerTime({ force: true });
      const result = await startOperationTimer(op.key);
      if (!result?.timer_id) throw new Error('Bir sorun oluştu. Lütfen tekrar deneyin.');
      await refresh();
    } catch (err) {
      notify.error(errorText(err, 'Zamanlayıcı başlatılırken hata oluştu.'));
    } finally {
      setBusy(false);
    }
  };

  const stopDirect = async () => {
    if (!running) return;
    setBusy(true);
    try {
      await stopModuleTimer('machining', running.id, syncedNow(), true);
      if (timerId) guard.allowNextLeave();
      await refresh();
    } catch (err) {
      notify.error(errorText(err, 'Hata oluştu. Lütfen tekrar deneyin.'));
    } finally {
      setBusy(false);
    }
  };

  // ---- the main button ----
  let button: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    color?: string;
    stop?: boolean;
  };
  if (machine.data.is_under_maintenance) {
    button = { label: 'Makine bakımda', disabled: true };
  } else if (running) {
    if (productive) {
      button = { label: 'Durdur', stop: true, color: 'red', onClick: () => setReasonOpen(true) };
    } else if (running.can_be_stopped_by_user === false) {
      button = { label: 'Durdurulamaz', stop: true, disabled: true };
    } else {
      button = { label: 'Durdur', stop: true, color: 'red', onClick: () => void stopDirect() };
    }
  } else if (machine.data.has_active_timer) {
    button = { label: 'Makine kullanımda', disabled: true };
  } else if (op && operationKey) {
    button = { label: 'Başlat', onClick: () => void start() };
  } else {
    button = { label: 'Başlatılamaz', disabled: true };
  }

  return (
    <>
      <TimerScreen
        title={title}
        subtitle={subtitle}
        startTime={running ? Number(running.start_time) : null}
        details={details(op)}
      >
        {running?.can_be_stopped_by_user === false ? (
          <Badge
            color="gray"
            variant="light"
            size="lg"
            style={{ whiteSpace: 'normal', height: 'auto' }}
          >
            Bu zamanlayıcı manuel olarak durdurulamaz. Arıza çözüldüğünde otomatik olarak
            durdurulacaktır.
          </Badge>
        ) : null}
      </TimerScreen>
      <StickyActions columns="1fr">
        <Button
          color={button.color}
          disabled={button.disabled}
          loading={busy}
          leftSection={button.stop ? <IconPlayerStop size={20} /> : <IconPlayerPlay size={20} />}
          onClick={button.onClick}
        >
          {button.label}
        </Button>
      </StickyActions>
      <DowntimeReasonSheet
        opened={reasonOpen}
        onClose={() => setReasonOpen(false)}
        title="Neden duruyorsunuz?"
        reasons={reasons.data ?? []}
        onSubmit={async (reasonId, comment) => {
          if (!running) return;
          await logReason({
            current_timer_id: running.id,
            reason_id: reasonId,
            ...(comment ? { comment } : {}),
          });
          setReasonOpen(false);
          void timersChanged(queryClient);
          // As the legacy page: always back to the operations list.
          guard.allowNextLeave();
          void navigate(`${LIST}?machine_id=${encodeURIComponent(machineId)}`, { replace: true });
        }}
      />
    </>
  );
}
