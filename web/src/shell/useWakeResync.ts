import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { syncServerTime } from '@/api/time';
import { timersChanged } from '@/api/timers';

/**
 * When the phone wakes or the app comes back to the front (or the browser
 * restores the page from its back/forward cache), re-sync the server clock and
 * reload the running timers, so a long sleep or a timer stopped elsewhere never
 * shows stale times. The legacy app had no such handling.
 */
export function useWakeResync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const resync = () => {
      void syncServerTime({ force: true });
      void timersChanged(queryClient);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [queryClient]);
}
