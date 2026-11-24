import { modals } from '@mantine/modals';
import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

/**
 * While `active` (a timer runs on this page), leaving it in the app (the back
 * arrow, the bottom bar, the phone's back gesture) asks first, as the legacy
 * task pages' back button did. `allowNextLeave()` lets one navigation through
 * without asking (after the page itself stopped or completed the work).
 */
export function useLeaveGuard(
  active: boolean,
  message = 'Zamanlayıcı aktif. Geri dönmek istediğinize emin misiniz?',
) {
  const allowed = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      !allowed.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    modals.openConfirmModal({
      title: 'Sayfadan çıkılsın mı?',
      children: message,
      labels: { confirm: 'Çık', cancel: 'Kal' },
      confirmProps: { color: 'red' },
      onConfirm: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
  }, [blocker, message]);

  return {
    allowNextLeave: () => {
      allowed.current = true;
    },
  };
}
