import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconExclamationCircle, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  cncKeys,
  cncTaskQueryOptions,
  createCncManualTime,
  finishCncTask,
  HOLD_TASKS_WITHOUT_COMMENT,
  MACHINE_FAULT_HOLD,
  startCncTimer,
  type CncTask,
} from '@/api/cnc';
import { activeOnMachineQueryOptions, machineQueryOptions, stopModuleTimer } from '@/api/machining';
import { createMaintenanceRequest } from '@/api/maintenance';
import { syncedNow, syncServerTime } from '@/api/time';
import { timersChanged } from '@/api/timers';
import { errorText, notify } from '@/ui/notify';
import { StickyActions } from '@/ui/StickyActions';
import { TimerScreen, type TimerDetail } from '@/ui/TimerScreen';
import { useLeaveGuard } from '@/ui/useLeaveGuard';
import { cutTaskPath } from './CncPage';
import { CutDetails } from './CncOverview';
import { RemnantCodesModal, RemnantSheet, remnantCodes, type RemnantCode } from './RemnantSheets';

// Legacy cnc_cutting/tasks: a cut's (or a hold task's) timer. Start / stop on
// server time, manual time, Tamamla with the remnants (and their codes to
// print), Arıza (a fault report, or the machine-fault hold task).

const LIST = '/cnc_cutting/';
const SHEETS_WAITING_FINISH =
  "Bu kesimin sacı henüz Mal Kabul'den geçmedi; sac gelince bitirilebilir.";

export function CncTaskPage() {
  const [params] = useSearchParams();
  const machineId = params.get('machine_id');
  const key = params.get('key');
  if (!machineId || !key) return <Navigate to={LIST} replace />;
  return (
    <CncTaskScreen
      key={params.toString()}
      machineId={machineId}
      taskKey={key}
      hold={params.get('hold') === '1' ? { name: params.get('name') || key } : null}
    />
  );
}

/** A hold task (W-…) is not a real cut: it is built from the URL, as the legacy page did. */
function holdTask(key: string, name: string): CncTask {
  return { key, name, nesting_id: key, job_no: name, is_hold_task: true } as CncTask;
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, in the phone's time zone. */
function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function durationText(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const minutes = Math.round(ms / 60000);
  return `${Math.floor(minutes / 60)} saat ${minutes % 60} dakika`;
}

function CncTaskScreen({
  machineId,
  taskKey,
  hold,
}: {
  machineId: string;
  taskKey: string;
  hold: { name: string } | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const machine = useQuery(machineQueryOptions(machineId));
  const fetched = useQuery({ ...cncTaskQueryOptions(taskKey), enabled: !hold });
  const timers = useQuery(activeOnMachineQueryOptions('cnc_cutting', machineId, taskKey));
  const running = timers.data?.[0] ?? null;
  const guard = useLeaveGuard(running != null);

  const [busy, setBusy] = useState(false);
  const [commentFor, setCommentFor] = useState<'start' | null>(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ start: '', end: '', comment: '', error: '' });
  const [confirmDone, setConfirmDone] = useState(false);
  const [remnantsOpen, setRemnantsOpen] = useState(false);
  const [codes, setCodes] = useState<RemnantCode[] | null>(null);
  const [faultStep, setFaultStep] = useState<null | 'status' | 'report' | 'redirect'>(null);
  const [faultText, setFaultText] = useState('');
  const [faultError, setFaultError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  // As the legacy page: a cut that can't be loaded goes back to the list.
  useEffect(() => {
    if (!fetched.isError) return;
    notify.error('Görev bulunamadı.');
    guard.allowNextLeave();
    void navigate(LIST, { replace: true });
  }, [fetched.isError, guard, navigate]);

  const task = hold ? holdTask(taskKey, hold.name) : fetched.data;
  if (machine.isPending || timers.isPending || !task) {
    return (
      <Center mih="50dvh">
        <Loader />
      </Center>
    );
  }
  if (machine.isError) return <Navigate to={LIST} replace />;

  const isHold = !!hold || task.is_hold_task === true;
  const needsComment = isHold && !HOLD_TASKS_WITHOUT_COMMENT.has(task.key);
  const sheetsWaiting = Number(task.sheets_waiting) || 0;
  const underMaintenance = !!machine.data.is_under_maintenance;
  const busyElsewhere = !running && !!machine.data.has_active_timer;
  const parts = task.parts ?? [];
  const totalKg = parts.reduce((sum, p) => sum + (Number.parseFloat(String(p.weight_kg)) || 0), 0);
  const jobs = new Set(parts.map((p) => p.job_no).filter(Boolean)).size;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['moduleTimers', 'cnc_cutting'] }),
      queryClient.invalidateQueries({ queryKey: ['machines'] }),
    ]);
    void timersChanged(queryClient);
  };

  const start = async (withComment?: string) => {
    setBusy(true);
    try {
      await syncServerTime({ force: true });
      await startCncTimer({
        issue_key: task.key,
        start_time: syncedNow(),
        machine_fk: machine.data.id,
        ...(withComment ? { comment: withComment } : {}),
      });
      await refresh();
    } catch (err) {
      notify.error(errorText(err, 'Zamanlayıcı başlatılırken bir hata oluştu.'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!running) return;
    setBusy(true);
    try {
      // The legacy page used the phone's clock here; the server clock keeps durations right.
      await stopModuleTimer('cnc_cutting', running.id, syncedNow(), true);
      await refresh();
    } catch (err) {
      notify.error(errorText(err, 'Zamanlayıcı durdurulurken bir hata oluştu.'));
    } finally {
      setBusy(false);
    }
  };

  const openManual = () => {
    const now = new Date();
    setManual({
      start: localInput(now),
      end: localInput(new Date(now.getTime() + 60 * 60 * 1000)),
      comment: '',
      error: '',
    });
    setManualOpen(true);
  };

  const saveManual = async () => {
    const startMs = new Date(manual.start).getTime();
    const endMs = new Date(manual.end).getTime();
    if (!manual.start || !manual.end)
      return setManual((m) => ({ ...m, error: 'Lütfen tüm alanları doldurun.' }));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return setManual((m) => ({ ...m, error: 'Geçersiz tarih/saat formatı.' }));
    }
    if (endMs <= startMs) {
      return setManual((m) => ({
        ...m,
        error: 'Bitiş zamanı başlangıç zamanından sonra olmalıdır.',
      }));
    }
    if (needsComment && !manual.comment.trim()) {
      return setManual((m) => ({ ...m, error: 'Lütfen bir açıklama giriniz.' }));
    }
    setBusy(true);
    try {
      await createCncManualTime({
        issue_key: task.key,
        start_time: startMs,
        finish_time: endMs,
        machine_fk: machine.data.id,
        ...(needsComment ? { comment: manual.comment.trim() } : {}),
      });
      setManualOpen(false);
      notify.success('Manuel süre kaydedildi.');
      void refresh();
    } catch (err) {
      setManual((m) => ({ ...m, error: errorText(err, 'Hata oluştu. Lütfen tekrar deneyin.') }));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (payload: { remnants: unknown[]; no_remnant: boolean }) => {
    const result = await finishCncTask(task.key, payload);
    setRemnantsOpen(false);
    void refresh();
    void queryClient.invalidateQueries({ queryKey: cncKeys.task(task.key) });
    const booked = remnantCodes(result?.booked);
    guard.allowNextLeave();
    if (booked.length) {
      setCodes(booked);
    } else {
      notify.success('Görev tamamlandı olarak işaretlendi.');
      void navigate(`${LIST}?machine_id=${encodeURIComponent(machineId)}`, { replace: true });
    }
  };

  const sendFault = async () => {
    const text = faultText.trim();
    if (!text) return setFaultError('Lütfen arıza açıklaması girin.');
    setBusy(true);
    try {
      await createMaintenanceRequest({
        kind: 'fault',
        description: text,
        operable: true,
        machineId: machine.data.id,
      });
      setFaultStep(null);
      setFaultText('');
      notify.success('Arıza bildirimi başarıyla gönderildi.');
    } catch (err) {
      setFaultError(errorText(err, 'Arıza bildirimi gönderilirken hata oluştu.'));
    } finally {
      setBusy(false);
    }
  };

  const details: TimerDetail[] = isHold
    ? [{ label: 'Görev', value: task.name || task.key, wide: true }]
    : [
        { label: 'Nesting ID', value: task.nesting_id || '-' },
        { label: 'Malzeme', value: task.material || '-' },
        { label: 'Boyutlar', value: task.dimensions || '-' },
        { label: 'Kalınlık', value: task.thickness_mm ? `${task.thickness_mm} mm` : '-' },
        {
          label: 'Parçalar',
          value: parts.length ? (
            <Text
              span
              c="blue"
              td="underline"
              onClick={() => setDetailsOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              {parts.length} parça · {totalKg.toFixed(2)} kg · {jobs} iş emri
            </Text>
          ) : (
            String(task.parts_count ?? '-')
          ),
          wide: true,
        },
        {
          label: 'Dosyalar',
          value: task.files?.length ? (
            <Text
              span
              c="blue"
              td="underline"
              onClick={() => setDetailsOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              {task.files.length} dosya
            </Text>
          ) : (
            '0'
          ),
        },
        {
          label: 'Tahmini Süre',
          value: task.estimated_hours ? `${task.estimated_hours} saat` : '-',
        },
      ];

  // ---- the main button ----
  const main: { label: string; disabled?: boolean; stop?: boolean; onClick?: () => void } =
    underMaintenance
      ? { label: 'Makine bakımda', disabled: true }
      : running
        ? { label: 'Durdur', stop: true, onClick: () => void stop() }
        : busyElsewhere
          ? { label: 'Makine kullanımda', disabled: true }
          : sheetsWaiting > 0
            ? { label: 'Sac bekleniyor', disabled: true }
            : {
                label: 'Başlat',
                onClick: () => {
                  if (needsComment) {
                    setComment('');
                    setCommentError('');
                    setCommentFor('start');
                  } else void start();
                },
              };

  return (
    <>
      <TimerScreen
        title={task.nesting_id || task.key || 'Görev'}
        subtitle={machine.data.name}
        startTime={running ? Number(running.start_time) : null}
        details={details}
      >
        {sheetsWaiting > 0 ? (
          <Alert color="orange" icon={<IconExclamationCircle size={20} />}>
            Bu kesimin sacı henüz Mal Kabul&apos;den geçmedi ({sheetsWaiting} sac bekleniyor); sac
            gelince başlatılabilir.
          </Alert>
        ) : task.key === MACHINE_FAULT_HOLD.key && running ? (
          <Alert color="orange" icon={<IconExclamationCircle size={20} />}>
            Zamanlayıcı arızanız bakım ekibi tarafından çözüldüğünde otomatik olarak
            durdurulacaktır.
          </Alert>
        ) : null}
      </TimerScreen>

      <StickyActions columns="1fr" rows={2}>
        <Button
          color={main.stop ? 'red' : undefined}
          disabled={main.disabled}
          loading={busy}
          leftSection={main.stop ? <IconPlayerStop size={20} /> : <IconPlayerPlay size={20} />}
          onClick={main.onClick}
        >
          {main.label}
        </Button>
        <Group grow gap="xs">
          <Button
            size="md"
            variant="light"
            px={6}
            disabled={underMaintenance || sheetsWaiting > 0}
            onClick={openManual}
          >
            Manuel
          </Button>
          {isHold ? null : (
            <Button
              size="md"
              variant="light"
              color="green"
              px={6}
              disabled={underMaintenance}
              onClick={() => {
                if (sheetsWaiting > 0) notify.warning(SHEETS_WAITING_FINISH);
                else setConfirmDone(true);
              }}
            >
              Tamamla
            </Button>
          )}
          <Button
            size="md"
            variant="light"
            color="orange"
            px={6}
            onClick={() => setFaultStep('status')}
          >
            Arıza
          </Button>
        </Group>
      </StickyActions>

      {/* Starting a hold task asks why (except lunch and the like). */}
      <Modal
        opened={commentFor === 'start'}
        onClose={() => setCommentFor(null)}
        title="Bekletme Görevi Başlatma"
      >
        <Stack gap="sm">
          <Textarea
            label="Açıklama"
            required
            autosize
            minRows={3}
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            error={commentError}
            data-autofocus
          />
          <Button
            onClick={() => {
              if (!comment.trim()) return setCommentError('Lütfen bir açıklama giriniz.');
              setCommentFor(null);
              void start(comment.trim());
            }}
          >
            Başlat
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={manualOpen}
        onClose={() => setManualOpen(false)}
        title={needsComment ? 'Bekletme Görevi Manuel Giriş' : 'Manuel Süre Girişi'}
      >
        <Stack gap="sm">
          <TextInput
            type="datetime-local"
            label="Başlangıç"
            value={manual.start}
            onChange={(e) => setManual({ ...manual, start: e.currentTarget.value, error: '' })}
          />
          <TextInput
            type="datetime-local"
            label="Bitiş"
            value={manual.end}
            onChange={(e) => setManual({ ...manual, end: e.currentTarget.value, error: '' })}
          />
          {durationText(manual.start, manual.end) ? (
            <Text size="sm" c="dimmed">
              Süre: {durationText(manual.start, manual.end)}
            </Text>
          ) : null}
          {needsComment ? (
            <Textarea
              label="Açıklama"
              required
              autosize
              minRows={2}
              value={manual.comment}
              onChange={(e) => setManual({ ...manual, comment: e.currentTarget.value, error: '' })}
            />
          ) : null}
          {manual.error ? (
            <Alert color="red" role="alert">
              {manual.error}
            </Alert>
          ) : null}
          <Button loading={busy} onClick={() => void saveManual()}>
            Kaydet
          </Button>
        </Stack>
      </Modal>

      <Modal opened={confirmDone} onClose={() => setConfirmDone(false)} title="Görevi Tamamla">
        <Stack gap="sm">
          <Text>
            {task.nesting_id || 'Bu nesting'} tamamen kesildi, markalandı ve makineden kaldırıldı
            mı?
          </Text>
          <Group grow>
            <Button variant="default" onClick={() => setConfirmDone(false)}>
              İptal
            </Button>
            <Button
              color="green"
              onClick={() => {
                setConfirmDone(false);
                setRemnantsOpen(true);
              }}
            >
              Evet
            </Button>
          </Group>
        </Stack>
      </Modal>

      <RemnantSheet
        opened={remnantsOpen}
        onClose={() => setRemnantsOpen(false)}
        onConfirm={finish}
      />

      <RemnantCodesModal
        codes={codes}
        title={task.nesting_id || task.key}
        onPrintBlocked={() =>
          notify.error(
            'Yazdırma penceresi açılamadı; tarayıcının açılır pencere iznini kontrol edin.',
          )
        }
        onDone={() => {
          setCodes(null);
          void navigate(`${LIST}?machine_id=${encodeURIComponent(machineId)}`, { replace: true });
        }}
      />

      {/* Arıza: is the machine working? Yes → a fault report; no → the machine-fault hold task. */}
      <Modal
        opened={faultStep === 'status'}
        onClose={() => setFaultStep(null)}
        title="Makine Durumu"
      >
        <Stack gap="sm">
          <Text>Makine çalışır durumda mı?</Text>
          <Group grow>
            <Button variant="default" onClick={() => setFaultStep('redirect')}>
              Hayır
            </Button>
            <Button
              onClick={() => {
                setFaultText('');
                setFaultError('');
                setFaultStep('report');
              }}
            >
              Evet
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={faultStep === 'report'}
        onClose={() => setFaultStep(null)}
        title="Arıza Bildirimi"
      >
        <Stack gap="sm">
          <Textarea
            label="Arıza detaylarını giriniz"
            placeholder="Arıza detaylarını buraya yazın..."
            required
            autosize
            minRows={4}
            value={faultText}
            onChange={(e) => setFaultText(e.currentTarget.value)}
            error={faultError}
            data-autofocus
          />
          <Button loading={busy} onClick={() => void sendFault()}>
            Gönder
          </Button>
        </Stack>
      </Modal>
      <Modal
        opened={faultStep === 'redirect'}
        onClose={() => setFaultStep(null)}
        title="Yönlendirme Uyarısı"
      >
        <Stack gap="sm">
          <Text>
            Makine çalışmıyor olarak işaretlendi. Bekletme sayfasına yönlendirileceksiniz.
          </Text>
          <Button
            onClick={() => {
              setFaultStep(null);
              guard.allowNextLeave();
              void navigate(
                cutTaskPath(MACHINE_FAULT_HOLD.machineId, MACHINE_FAULT_HOLD.key, {
                  name: MACHINE_FAULT_HOLD.name,
                }),
              );
            }}
          >
            Tamam
          </Button>
        </Stack>
      </Modal>

      {isHold ? null : (
        <CutDetails taskKey={detailsOpen ? task.key : null} onClose={() => setDetailsOpen(false)} />
      )}
    </>
  );
}
