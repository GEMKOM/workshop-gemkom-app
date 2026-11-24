import { Alert, Button, PasswordInput, Stack } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { apiFetch, isApiError } from '@/api/client';
import { reloadUser } from '@/auth/authService';
import { AuthScreen } from './AuthScreen';

// Legacy login/reset-password: at least 6 characters, typed twice. Once saved,
// the stored user is re-read (must_reset_password is now false), so the reset
// route's guard sends the user home.

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const next = password.trim();
    if (next.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (next !== confirm.trim()) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setState('busy');
    try {
      await apiFetch('/users/reset-password/', { method: 'POST', body: { new_password: next } });
    } catch (err) {
      const message =
        isApiError(err) && err.data && typeof err.data === 'object' && 'message' in err.data
          ? String((err.data as { message: unknown }).message)
          : isApiError(err)
            ? 'Şifre güncellenemedi. Lütfen tekrar deneyin.'
            : 'Bir hata oluştu. Lütfen tekrar deneyin.';
      setError(message);
      setState('idle');
      return;
    }
    setState('done');
    // As the legacy page: show the success for a moment, then go on.
    window.setTimeout(() => {
      void reloadUser().catch((err: unknown) => {
        console.warn('Failed to refresh user data after password reset:', err);
      });
    }, 1500);
  };

  return (
    <AuthScreen title="Şifre Sıfırla">
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />} role="alert">
              {error}
            </Alert>
          ) : null}
          {state === 'done' ? (
            <Alert color="green" icon={<IconCheck size={18} />}>
              Şifreniz başarıyla güncellendi. Ana sayfaya yönlendiriliyorsunuz...
            </Alert>
          ) : null}
          <PasswordInput
            label="Yeni Şifre"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <PasswordInput
            label="Yeni Şifre (Tekrar)"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
          />
          <Button type="submit" loading={state === 'busy'} disabled={state === 'done'} fullWidth>
            Kaydet
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  );
}
