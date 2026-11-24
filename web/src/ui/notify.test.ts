import { ApiError } from '@/api/client';
import { errorText, OFFLINE_TEXT } from './notify';

it('reads a request that never reached the server in Turkish', () => {
  expect(errorText(new TypeError('Failed to fetch'))).toBe(OFFLINE_TEXT); // Chrome
  expect(errorText(new TypeError('Load failed'))).toBe(OFFLINE_TEXT); // Safari
  expect(errorText(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
    OFFLINE_TEXT,
  ); // Firefox
});

it('keeps server messages and falls back otherwise', () => {
  expect(errorText(new ApiError(400, { error: 'x' }, 'Makine bakımda'))).toBe('Makine bakımda');
  expect(errorText(undefined, 'Olmadı')).toBe('Olmadı');
});
