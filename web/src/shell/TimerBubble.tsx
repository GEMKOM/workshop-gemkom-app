import { Badge, Button, Drawer, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconClockPlay, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { formatElapsed, syncServerTime, useSyncedNow } from '@/api/time';
import { activeTimersQueryOptions, timerLabel, timerPath, type ActiveTimer } from '@/api/timers';
import { useAuth } from '@/auth/AuthProvider';
import { SiteLink } from './SiteLink';
import classes from './TimerBubble.module.css';

// The legacy floating timer widget (components/timerWidget.js), for phones: a
// round button with the number of running timers, draggable by touch or mouse,
// that opens a bottom sheet listing them. The per-timer stop button was
// commented out in the legacy widget ("for future use") and stays out.

const DRAG_THRESHOLD_PX = 5;
const CLOCK_CHECK_MS = 30 * 1000;

/** The timer areas: the bubble shows for users of any of them. */
export const TIMER_PERMISSIONS = ['access_machining', 'access_cnc_cutting', 'access_maintenance'];

/** A task page whose timer (by `timer_id`) is no longer running goes back to its list. */
export function stoppedTimerRedirect(
  pathname: string,
  search: string,
  timers: ActiveTimer[],
): string | null {
  const match = /^\/(machining|cnc_cutting)\/tasks\/?$/.exec(pathname);
  const timerId = new URLSearchParams(search).get('timer_id');
  if (!match || !timerId) return null;
  const running = timers.some((t) => t.module !== 'maintenance_fault' && String(t.id) === timerId);
  return running ? null : `/${match[1]}/`;
}

function TimerRow({ timer, now, onOpen }: { timer: ActiveTimer; now: number; onOpen: () => void }) {
  return (
    <UnstyledButton
      component={SiteLink}
      to={timerPath(timer)}
      className={classes.row}
      onClick={onOpen}
    >
      <div className={classes.rowText}>
        <Text fw={600} truncate>
          {timerLabel(timer)}
        </Text>
        <Text size="sm" c="dimmed" truncate>
          {timer.machine_name || 'Bilinmeyen'}
        </Text>
      </div>
      <Text className={classes.elapsed}>{formatElapsed((now - timer.start_time) / 1000)}</Text>
    </UnstyledButton>
  );
}

export function TimerBubble() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const timers = useQuery(activeTimersQueryOptions());
  const list = timers.data ?? [];
  const [open, setOpen] = useState(false);
  const now = useSyncedNow(open && list.length > 0);

  // Keep the server clock fresh while timers run.
  useEffect(() => {
    if (list.length === 0) return;
    void syncServerTime();
    const id = window.setInterval(() => void syncServerTime(), CLOCK_CHECK_MS);
    return () => window.clearInterval(id);
  }, [list.length]);

  // A timer stopped elsewhere (another phone, an admin) closes its task page.
  useEffect(() => {
    if (!timers.isSuccess) return;
    const target = stoppedTimerRedirect(location.pathname, location.search, timers.data);
    if (target) void navigate(target, { replace: true });
  }, [timers.isSuccess, timers.data, location.pathname, location.search, navigate]);

  // ---- dragging (pointer events: touch, pen and mouse) ----
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const clamp = (x: number, y: number) => {
    const el = buttonRef.current;
    if (!el) return { x, y };
    // The button's resting place is bottom-right; keep it fully on screen.
    const rect = el.getBoundingClientRect();
    const restLeft = rect.left - offset.x;
    const restTop = rect.top - offset.y;
    return {
      x: Math.min(window.innerWidth - rect.width - restLeft, Math.max(-restLeft, x)),
      y: Math.min(window.innerHeight - rect.height - restTop, Math.max(-restTop, y)),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    setOffset(clamp(d.baseX + dx, d.baseY + dy));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setOpen(true);
  };

  // Back on screen after a rotation or resize.
  useEffect(() => {
    const onResize = () => setOffset((o) => clamp(o.x, o.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  const newTimerPath = auth.can('access_cnc_cutting')
    ? '/cnc_cutting/'
    : auth.can('access_machining')
      ? '/machining/'
      : '/';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={classes.bubble}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        aria-label={`Aktif zamanlayıcılar (${list.length})`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <IconClockPlay size={28} aria-hidden />
        {list.length > 0 ? (
          <Badge className={classes.badge} color="red" size="md" circle>
            {list.length}
          </Badge>
        ) : null}
      </button>
      <Drawer
        opened={open}
        onClose={() => setOpen(false)}
        position="bottom"
        title="Aktif Zamanlayıcılar"
        classNames={{ content: classes.sheet }}
      >
        <Stack gap="sm" pb="md">
          {list.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">
              {timers.isPending ? 'Yükleniyor...' : 'Aktif zamanlayıcı bulunmuyor'}
            </Text>
          ) : (
            list.map((timer) => (
              <TimerRow key={timer.id} timer={timer} now={now} onOpen={() => setOpen(false)} />
            ))
          )}
          <Button
            component={SiteLink}
            to={newTimerPath}
            variant="light"
            leftSection={<IconPlus size={18} />}
            onClick={() => setOpen(false)}
          >
            Yeni Zamanlayıcı
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
