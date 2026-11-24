import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Providers } from '@/app/Providers';
import { createRouter } from '@/routes/router';
import { reloadForNewVersion } from '@/routes/staleChunk';

// A chunk failing to load (a file a deploy removed): reload for the new
// version. The error is not prevented (preventing it makes the page's import
// resolve to undefined); the route error page shows the reload in progress.
window.addEventListener('vite:preloadError', () => {
  reloadForNewVersion();
});

const router = createRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
