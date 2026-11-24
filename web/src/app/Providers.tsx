import 'dayjs/locale/tr';

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/api/queryClient';
import { AuthProvider } from '@/auth/AuthProvider';
import { theme } from '@/theme';

dayjs.locale('tr');

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ModalsProvider labels={{ confirm: 'Onayla', cancel: 'İptal' }}>
            {/* Top of the screen, clear of the bottom bar and the thumb. */}
            <Notifications position="top-center" zIndex={1000} />
            {children}
          </ModalsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
