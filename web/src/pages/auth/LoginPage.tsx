import { Alert, Anchor, Button, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { forgotPassword, login, NoWorkshopAccessError } from '@/auth/authService';
import { AuthScreen } from './AuthScreen';

// Legacy login/login.js. The separate "Admin Girişi" form called the same
// login(); one form serves both here. After a successful login the session
// changes and the login route's guard moves on (reset page or home).

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('Lütfen kullanıcı adınızı girin.');
      return;
    }
    if (!password.trim()) {
      setError('Lütfen şifrenizi girin.');
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(
        err instanceof NoWorkshopAccessError
          ? 'Bu portala giriş yetkiniz bulunmuyor.'
          : 'Kullanıcı adı veya şifre hatalı. Lütfen tekrar deneyin.',
      );
      setBusy(false);
    }
  };

  return (
    <AuthScreen subtitle="Atölye Personel Giriş Sistemi">
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />} role="alert">
              {error}
            </Alert>
          ) : null}
          <TextInput
            label="Kullanıcı Adı"
            placeholder="Kullanıcı adınızı girin"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          <PasswordInput
            label="Şifre"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button type="submit" loading={busy} fullWidth mt="xs">
            Giriş Yap
          </Button>
          <Anchor component="button" type="button" ta="center" onClick={() => setForgotOpen(true)}>
            Şifremi unuttum
          </Anchor>
        </Stack>
      </form>
      {forgotOpen ? <ForgotPasswordModal onClose={() => setForgotOpen(false)} /> : null}
    </AuthScreen>
  );
}

/**
 * Legacy forgot-password modal. It reports "iletildi" whatever the server says,
 * so the answer doesn't reveal which usernames exist; only a network failure
 * shows an error.
 */
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('Lütfen kullanıcı adınızı girin.');
      return;
    }
    setState('busy');
    try {
      await forgotPassword(username.trim());
      setState('sent');
      window.setTimeout(onClose, 2000);
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.');
      setState('idle');
    }
  };

  return (
    <Modal opened onClose={onClose} title="Şifremi Unuttum">
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          <Text size="sm" c="dimmed">
            Kullanıcı adınızı girin; şifre sıfırlama isteğiniz yöneticinize iletilir.
          </Text>
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          ) : null}
          {state === 'sent' ? (
            <Alert color="green" icon={<IconCheck size={18} />}>
              Şifre sıfırlama isteğiniz yöneticinize iletildi.
            </Alert>
          ) : null}
          <TextInput
            label="Kullanıcı Adı"
            placeholder="Kullanıcı adınızı girin"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            data-autofocus
          />
          <Button type="submit" loading={state === 'busy'} disabled={state === 'sent'} fullWidth>
            Gönder
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
