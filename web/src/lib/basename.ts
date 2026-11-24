// Where the app's pages live. During the pilot the React app is published under
// /beta/ (VITE_BASENAME=/beta) next to the legacy pages; after the cutover it is
// served at the root and the basename is empty.

const raw = (import.meta.env.VITE_BASENAME as string | undefined) ?? '';

/** '' or '/beta' (no trailing slash), for React Router's basename. */
export const BASENAME = raw.replace(/\/+$/, '');

/** A path of the app as the browser sees it: '/machining/' → '/beta/machining/'. */
export function appUrl(path: string): string {
  return `${BASENAME}${path.startsWith('/') ? path : `/${path}`}`;
}
