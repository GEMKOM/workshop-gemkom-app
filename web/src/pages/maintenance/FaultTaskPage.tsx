import { Button, Center, Loader, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconCheck, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  completeFault,
  faultQueryOptions,
  faultTimerQueryOptions,
  maintenanceKeys,
  startFaultTimer,
  stopFaultTimer,
} from '@/api/maintenance';
import { syncedNow, syncServerTime } from '@/api/time';
import { timersChanged } from '@/api/timers';
import { formatDateTime } from '@/lib/format';
import { errorText, notify } from '@/ui/notify';
import { StickyActions } from '@/ui/StickyActions';
import { TimerScreen } from '@/ui/TimerScreen';
import { useLeaveGuard } from '@/ui/useLeaveGuard';

// Legacy maintenance/faults/task: the fault's timer (start/stop on server time)
// and completing the fault with a resolution.

const LIST = '/maintenance/?tab=fault-requests';

export function FaultTaskPage() {
  const [params] = useSearchParams();
  const faultId = params.get('fault_id');
  if (!faultId) return <Navigate to={LIST} replace />;
  return <FaultTask faultId={faultId} />;
}

function FaultTask({ faultId }: { faultId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fault = useQuery(faultQueryOptions(faultId));
  const timer = useQuery(faultTimerQueryOptions(faultId));
  const [busy, setBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const running = timer.data ?? null;
  const startTime = running?.start_time != null ? Number(running.start_time) : null;
  const guard = useLeaveGuard(running != null);

  // As the legacy page: a fault that can't be loaded goes back to the list.
  useEffect(() => {
    if (!fault.isError) return;
    notify.error('Sayfa yüklenirken hata oluştu.');
    guard.allowNextLeave();
    void navigate(LIST, { replace: true });
  }, [fault.isError, guard, navigate]);

  if (fault.isPending || timer.isPending || !fault.data) {
    return (
      <Center mih="50dvh">
        <Loader />
      </Center>
    );
  }
  const data = fault.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: maintenanceKeys.faultTimers(faultId) });
    void timersChanged(queryClient);
  };

  const startStop = async () => {
    setBusy(true);
    try {
      if (!running) {
        await syncServerTime({ force: true });
        await startFaultTimer(data, syncedNow());
      } else {
        await stopFaultTimer(running.id, syncedNow());
      }
      await refresh();
    } catch (err) {
      notify.error(errorText(err, 'İşlem sırasında hata oluştu.'));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    const text = resolution.trim();
    if (!text) {
      setResolutionError('Lütfen çözüm açıklaması girin.');
      return;
    }
    setCompleting(true);
    try {
      await completeFault(data.id, text);
      void timersChanged(queryClient);
      await queryClient.invalidateQueries({ queryKey: maintenanceKeys.allFaults });
      notify.success('Arıza başarıyla tamamlandı.');
      guard.allowNextLeave();
      void navigate(LIST, { replace: true });
    } catch (err) {
      setResolutionError(errorText(err, 'Arıza tamamlanırken hata oluştu.'));
      setCompleting(false);
    }
  };

  return (
    <>
      <TimerScreen
        title={`ARIZA-${data.id}`}
        subtitle={data.machine_name || data.asset_name || 'Makine'}
        startTime={startTime}
        details={[
          { label: 'Bildirim', value: formatDateTime(data.reported_at) || '-' },
          { label: 'Bildiren', value: data.reported_by_username || 'Bilinmiyor' },
          { label: 'Duruş', value: data.is_breaking ? 'Evet' : 'Hayır' },
          { label: 'Tür', value: data.is_maintenance ? 'Bakım' : 'Arıza' },
          { label: 'Açıklama', value: data.description || '-', wide: true },
        ]}
      />
      <StickyActions columns="2fr 1fr">
        <Button
          color={running ? 'red' : undefined}
          loading={busy}
          leftSection={running ? <IconPlayerStop size={20} /> : <IconPlayerPlay size={20} />}
          onClick={() => void startStop()}
        >
          {running ? 'Durdur' : 'Başlat'}
        </Button>
        <Button
          variant="light"
          color="green"
          leftSection={<IconCheck size={20} />}
          onClick={() => {
            setResolutionError(null);
            setCompleteOpen(true);
          }}
        >
          Tamamla
        </Button>
      </StickyActions>

      <Modal opened={completeOpen} onClose={() => setCompleteOpen(false)} title="Arızayı Tamamla">
        <Stack gap="sm">
          <Textarea
            label="Çözüm Açıklaması"
            placeholder="Yapılan işlemi açıklayın..."
            required
            autosize
            minRows={4}
            value={resolution}
            onChange={(e) => setResolution(e.currentTarget.value)}
            error={resolutionError}
            data-autofocus
          />
          <Text size="xs" c="dimmed">
            Tamamlanan arıza açık talepler listesinden kalkar.
          </Text>
          <Button color="green" loading={completing} onClick={() => void complete()}>
            Tamamla
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
