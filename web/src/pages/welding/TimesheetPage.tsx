import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconEraser,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconRotate,
  IconRotateClockwise,
  IconSearch,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  searchTimesheetJobs,
  submitTimesheet,
  timesheetDayQueryOptions,
  timesheetKeys,
  type SuggestedJob,
  type TimesheetDay,
  type TimesheetRow,
} from '@/api/welding';
import { formatTime } from '@/lib/format';
import { errorText, notify } from '@/ui/notify';
import { StickyActions } from '@/ui/StickyActions';
import classes from './Timesheet.module.css';
import {
  cellLabel,
  cellOwner,
  dateLabel,
  formatHours,
  jobNumber,
  jobTitle,
  quickFill,
  REGULAR_CELLS,
  rowHours,
  toggleCell,
  totalHours,
} from './timesheetLogic';

// Legacy welding/timesheet (Kaynak Puantaj): the welder picks the day's jobs and
// taps the hours worked; the office approves on the office app.

const SEARCH_MIN = 2;
const SEARCH_DELAY_MS = 300;
const ORIGIN_TAG: Record<string, string> = { team: 'ekibinizin işi', recent: 'son günlerde' };

interface Draft {
  rows: TimesheetRow[];
  blankDay: boolean;
  note: string;
  dirty: boolean;
}

function draftFrom(day: TimesheetDay): Draft {
  const sub = day.submission;
  return {
    rows: (sub?.rows ?? []).map((r) => ({
      job_no: r.job_no,
      title: r.title ?? '',
      cells: (r.cells ?? []).map(Boolean),
    })),
    blankDay: !!sub?.blank_day,
    note: sub?.note ?? '',
    dirty: false,
  };
}

function Banner({ day }: { day: TimesheetDay }) {
  const sub = day.submission;
  if (day.locked) {
    return (
      <Alert color="green" icon={<IconCircleCheck size={20} />}>
        <strong>Onaylandı.</strong> Bu günün puantajı kayıtlara geçti. Değişiklik için ofise
        söyleyin.
      </Alert>
    );
  }
  if (!sub && day.rejection) {
    return (
      <Alert color="red" icon={<IconRotate size={20} />}>
        <strong>Ofis geri gönderdi.</strong>{' '}
        {day.rejection.reason || 'Lütfen kontrol edip tekrar gönderin.'}
        <Text size="xs" mt={4}>
          Düzeltip tekrar <strong>GÖNDER</strong>&apos;e basın.
        </Text>
      </Alert>
    );
  }
  if (sub) {
    const when = sub.submitted_at ? formatTime(sub.submitted_at) : '';
    return (
      <Alert color="orange" icon={<IconClock size={20} />}>
        <strong>Gönderildi{when ? ` · ${when}` : ''}.</strong> Ofis onayı bekleniyor. Yanlış bir şey
        varsa düzeltip tekrar gönderin.
      </Alert>
    );
  }
  return (
    <Alert color="blue" icon={<IconPencil size={20} />}>
      Bugün hangi işlerde, hangi saatlerde çalıştınız? İşi seçin, çalıştığınız saat aralıklarına
      dokunun, <strong>GÖNDER</strong>&apos;e basın.
      <Text size="xs" mt={4}>
        Her kutu bir saat aralığıdır: <strong>08–09</strong> = saat 8&apos;den 9&apos;a kadar.
      </Text>
    </Alert>
  );
}

function AddJobButton({ job, onAdd, tag }: { job: SuggestedJob; onAdd: () => void; tag?: string }) {
  return (
    <UnstyledButton className={classes.add} onClick={onAdd}>
      <span className={classes.addNo}>{jobNumber(job.job_no)}</span>
      <span className={classes.addTitle}>{jobTitle(job.job_no, job.title)}</span>
      {tag ? <span className={classes.addTag}>{tag}</span> : null}
      <IconPlus size={18} className={classes.addIcon} />
    </UnstyledButton>
  );
}

export function TimesheetPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string | null>(null);
  const day = useQuery(timesheetDayQueryOptions(date));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftFor, setDraftFor] = useState<TimesheetDay | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollTo = useRef<string | null>(null);

  // A freshly loaded (or submitted) day resets the draft to what was sent.
  if (day.data && day.data !== draftFor) {
    setDraftFor(day.data);
    setDraft(draftFrom(day.data));
  }

  // Job search: at least 2 characters, 300 ms after typing stops.
  const [debounced] = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  const jobSearch = useQuery({
    queryKey: ['welding', 'timesheetJobs', debounced],
    queryFn: ({ signal }) => searchTimesheetJobs(debounced, signal),
    enabled: debounced.length >= SEARCH_MIN,
    staleTime: 60 * 1000,
  });
  const results =
    search.trim().length >= SEARCH_MIN && debounced.length >= SEARCH_MIN
      ? jobSearch.isError
        ? []
        : (jobSearch.data ?? null)
      : null;
  useEffect(() => {
    if (jobSearch.isError) notify.error(errorText(jobSearch.error));
  }, [jobSearch.isError, jobSearch.error]);

  // A just-added job scrolls into view.
  useEffect(() => {
    if (!scrollTo.current) return;
    document
      .querySelector(`[data-row="${CSS.escape(scrollTo.current)}"]`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    scrollTo.current = null;
  });

  if (day.isError) {
    return (
      <Alert color="orange" icon={<IconAlertTriangle size={20} />}>
        {errorText(day.error)}
      </Alert>
    );
  }
  if (!day.data || !draft) {
    return (
      <Center mih="50dvh">
        <Loader />
      </Center>
    );
  }

  const data = day.data;
  const locked = !!data.locked;
  const sub = data.submission;
  const cells = data.cells;
  const total = totalHours(draft.rows, cells);
  const added = new Set(draft.rows.map((r) => r.job_no));
  const suggestions = (data.suggested_jobs ?? []).filter((j) => !added.has(j.job_no));
  const searchResults = (results ?? []).filter((j) => !added.has(j.job_no));

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch, dirty: true } : d));

  const addJob = (job: SuggestedJob) => {
    if (added.has(job.job_no)) return;
    update({
      rows: [
        ...draft.rows,
        { job_no: job.job_no, title: job.title ?? '', cells: cells.map(() => false) },
      ],
    });
    setSearch('');
    scrollTo.current = job.job_no;
  };

  const pickDate = (next: string) => {
    if (next === data.date) return;
    const go = () => {
      setSearch('');
      setDate(next);
    };
    if (!draft.dirty) return go();
    modals.openConfirmModal({
      title: 'Gün değiştirilsin mi?',
      children: 'Gönderilmemiş değişiklikler var. Yine de gün değiştirilsin mi?',
      labels: { confirm: 'Değiştir', cancel: 'Vazgeç' },
      onConfirm: go,
    });
  };

  const submit = async () => {
    if (saving || locked) return;
    const rows = draft.blankDay
      ? []
      : draft.rows
          .filter((r) => r.cells.some(Boolean))
          .map((r) => ({ job_no: r.job_no, cells: r.cells }));
    if (!draft.blankDay && rows.length === 0) {
      notify.error('Önce bir iş seçip saatleri işaretleyin');
      return;
    }
    setSaving(true);
    try {
      const fresh = await submitTimesheet({
        date: data.date,
        blank_day: draft.blankDay,
        rows,
        note: draft.note,
      });
      queryClient.setQueryData(timesheetKeys.day(date), fresh);
      notify.success('Gönderildi ✓ Ofis onayından sonra kayıtlara geçer.');
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (err) {
      notify.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const canSend = draft.blankDay || total > 0;
  const submitLabel = locked
    ? 'ONAYLANDI'
    : saving
      ? 'GÖNDERİLİYOR'
      : sub && !draft.dirty
        ? 'TEKRAR GÖNDER'
        : 'GÖNDER';

  return (
    <div className={classes.page}>
      <Paper withBorder p="md">
        <Text fw={700} fz={20}>
          Kaynak Puantaj
        </Text>
        <Text size="sm" c="dimmed">
          {data.employee.full_name}
        </Text>
        <div className={classes.dates} role="group" aria-label="Gün">
          {data.allowed_dates.map((iso) => {
            const label = dateLabel(iso, data.allowed_dates);
            return (
              <UnstyledButton
                key={iso}
                className={classes.date}
                data-active={iso === data.date || undefined}
                aria-pressed={iso === data.date}
                onClick={() => pickDate(iso)}
              >
                {label.main}
                <small>{label.sub}</small>
              </UnstyledButton>
            );
          })}
        </div>
      </Paper>

      <Banner day={data} />
      {data.kind && data.kind !== 'weekday' ? (
        <Alert color="gray" icon={<IconCalendarEvent size={20} />}>
          {data.kind_label}
        </Alert>
      ) : null}

      <fieldset className={classes.body} disabled={locked}>
        <UnstyledButton
          className={classes.toggle}
          data-on={draft.blankDay || undefined}
          aria-pressed={draft.blankDay}
          onClick={() => update({ blankDay: !draft.blankDay })}
        >
          <span className={classes.check}>{draft.blankDay ? <IconCheck size={16} /> : null}</span>
          <span>
            Bugün çalışmadım <small>(izin / rapor / görevli değilim)</small>
          </span>
        </UnstyledButton>

        {draft.blankDay ? null : (
          <>
            {draft.rows.length > 0 ? <div className={classes.section}>Bugünkü işler</div> : null}
            {draft.rows.map((row) => (
              <Paper
                key={row.job_no}
                withBorder
                p="md"
                className={classes.job}
                data-row={row.job_no}
              >
                <div className={classes.jobHead}>
                  <div className={classes.jobNo}>{jobNumber(row.job_no)}</div>
                  <div className={classes.jobTitle}>{jobTitle(row.job_no, row.title)}</div>
                  <UnstyledButton
                    className={classes.remove}
                    aria-label={`${jobNumber(row.job_no)} kaldır`}
                    onClick={() =>
                      update({ rows: draft.rows.filter((r) => r.job_no !== row.job_no) })
                    }
                  >
                    <IconX size={18} />
                  </UnstyledButton>
                </div>
                <div className={classes.quick}>
                  <UnstyledButton
                    onClick={() =>
                      update({ rows: quickFill(draft.rows, row.job_no, 'day', cells.length) })
                    }
                  >
                    Gündüz 07:30–17:00
                  </UnstyledButton>
                  <UnstyledButton
                    onClick={() =>
                      update({ rows: quickFill(draft.rows, row.job_no, 'evening', cells.length) })
                    }
                  >
                    Akşam 17–21
                  </UnstyledButton>
                  <UnstyledButton
                    className={classes.clear}
                    aria-label="Temizle"
                    onClick={() =>
                      update({ rows: quickFill(draft.rows, row.job_no, 'clear', cells.length) })
                    }
                  >
                    <IconEraser size={18} />
                  </UnstyledButton>
                </div>
                <div className={classes.grid}>
                  {cells.map((cell, idx) => {
                    const on = row.cells[idx];
                    const owner = on ? null : cellOwner(draft.rows, idx, row.job_no);
                    const half = Number(cell.hours) < 1;
                    const sub = owner
                      ? jobNumber(owner)
                      : half
                        ? '½ saat'
                        : idx >= REGULAR_CELLS
                          ? 'mesai'
                          : '';
                    return (
                      <UnstyledButton
                        key={idx}
                        className={classes.cell}
                        data-on={on || undefined}
                        data-used={owner ? true : undefined}
                        data-ot={idx >= REGULAR_CELLS || undefined}
                        data-half={half || undefined}
                        aria-pressed={on}
                        aria-label={`${row.job_no} ${cell.start}-${cell.end}`}
                        onClick={() => update({ rows: toggleCell(draft.rows, row.job_no, idx) })}
                      >
                        {cellLabel(cell)}
                        <small>{sub}</small>
                      </UnstyledButton>
                    );
                  })}
                </div>
                <div className={classes.jobTotal}>
                  <span>bu iş</span>
                  {formatHours(rowHours(row, cells))}
                </div>
              </Paper>
            ))}

            <div className={classes.section}>
              {draft.rows.length ? 'Başka iş ekle' : 'Hangi işte çalıştınız?'}
            </div>
            <div className={classes.addList}>
              {suggestions.map((job) => (
                <AddJobButton
                  key={job.job_no}
                  job={job}
                  tag={job.origin ? ORIGIN_TAG[job.origin] : undefined}
                  onAdd={() => addJob(job)}
                />
              ))}
            </div>
            <TextInput
              type="search"
              inputMode="search"
              autoComplete="off"
              leftSection={<IconSearch size={18} />}
              placeholder="Listede yoksa iş emri no yazın (örn. 293-11)"
              aria-label="İş emri ara"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            {results !== null ? (
              <div className={classes.addList}>
                {searchResults.length === 0 ? (
                  <Text size="sm" c="dimmed" px={4}>
                    Eşleşen iş emri yok.
                  </Text>
                ) : (
                  searchResults.map((job) => (
                    <AddJobButton
                      key={job.job_no}
                      job={job}
                      tag={job.closed ? 'kapalı' : undefined}
                      onAdd={() => addJob(job)}
                    />
                  ))
                )}
              </div>
            ) : null}

            <div className={classes.section}>
              Not <small>(isteğe bağlı)</small>
            </div>
            <TextInput
              maxLength={200}
              aria-label="Not"
              value={draft.note}
              onChange={(e) => update({ note: e.currentTarget.value })}
            />
          </>
        )}
        {sub?.flags?.length && !locked ? (
          <Text size="sm" c="dimmed" className={classes.flags}>
            <IconInfoCircle size={16} /> {sub.flags.map((f) => f.text).join(' · ')}
          </Text>
        ) : null}
      </fieldset>

      <StickyActions columns="auto 1fr">
        <div className={classes.total}>
          <span>Toplam</span>
          <strong>{draft.blankDay ? 'Çalışılmadı' : formatHours(total)}</strong>
        </div>
        <Button
          color={locked ? 'green' : undefined}
          disabled={locked || !canSend || saving}
          loading={saving}
          leftSection={
            locked ? (
              <IconCheck size={20} />
            ) : sub && !draft.dirty ? (
              <IconRotateClockwise size={20} />
            ) : (
              <IconSend size={20} />
            )
          }
          onClick={() => void submit()}
        >
          {submitLabel}
        </Button>
      </StickyActions>
    </div>
  );
}
