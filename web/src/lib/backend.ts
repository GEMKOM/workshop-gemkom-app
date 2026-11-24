// The API every request goes to, as the legacy base.js picks it: a page opened
// from localhost or 127.0.0.1 talks to a local backend, everything else to
// production. VITE_BACKEND_URL overrides it (e.g. the dev server against a
// staging backend).

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

const override = import.meta.env.VITE_BACKEND_URL as string | undefined;

export const backendBase: string =
  override ||
  (LOCAL_HOSTS.has(window.location.hostname)
    ? 'http://127.0.0.1:8001'
    : 'https://gemkom-backend-716746493353.europe-west3.run.app');
