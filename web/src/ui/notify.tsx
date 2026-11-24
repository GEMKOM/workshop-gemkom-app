import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';

// Toasts, as the office app's ui/notify.tsx (with Tabler icons). They replace
// the legacy app's alert() calls.

export type NotifyType = 'success' | 'error' | 'info' | 'warning';

export interface NotifyOptions {
  title?: ReactNode;
  /** Milliseconds, or false to keep it until closed. Default 5000. */
  autoClose?: number | false;
  id?: string;
}

const STYLE: Record<NotifyType, { color: string; icon: Icon }> = {
  success: { color: 'green', icon: IconCheck },
  error: { color: 'red', icon: IconX },
  info: { color: 'blue', icon: IconInfoCircle },
  warning: { color: 'yellow', icon: IconAlertTriangle },
};

/** What the browsers say when a request never reached the server. */
const NETWORK_ERROR = /Failed to fetch|NetworkError|Load failed|network connection was lost/i;

export const OFFLINE_TEXT =
  'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';

/**
 * The text to show for a caught error: its `.message`, or the fallback. A
 * request that never reached the server (shop-floor Wi-Fi) reads in Turkish.
 */
export function errorText(error: unknown, fallback = 'Bir hata oluştu'): string {
  if (error instanceof TypeError && NETWORK_ERROR.test(error.message)) return OFFLINE_TEXT;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function show(type: NotifyType, message: ReactNode, options: NotifyOptions = {}): string {
  const { color, icon: StyleIcon } = STYLE[type];
  return notifications.show({
    id: options.id,
    title: options.title,
    message,
    color,
    icon: <StyleIcon size={18} aria-hidden />,
    autoClose: options.autoClose ?? 5000,
  });
}

export const notify = {
  success: (message: ReactNode, options?: NotifyOptions) => show('success', message, options),
  info: (message: ReactNode, options?: NotifyOptions) => show('info', message, options),
  warning: (message: ReactNode, options?: NotifyOptions) => show('warning', message, options),
  /** A message, or anything caught (its `.message` is shown). */
  error: (error: unknown, options: NotifyOptions & { fallback?: string } = {}) =>
    show('error', typeof error === 'string' ? error : errorText(error, options.fallback), options),
  hide: (id: string) => notifications.hide(id),
};
