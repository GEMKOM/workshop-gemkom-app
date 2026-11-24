import { Button, Modal, Stack, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { reloadUser } from '@/auth/authService';
import { errorText, notify } from '@/ui/notify';

/** Legacy "Profili Düzenle": PUT /users/me/, then the stored user is re-read. */
export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/users/me/', {
        method: 'PUT',
        body: { first_name: firstName, last_name: lastName, email },
      });
      await reloadUser();
      notify.success('Bilgiler güncellendi.');
      onClose();
    } catch (error) {
      notify.error(errorText(error, 'Güncelleme başarısız.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened onClose={onClose} title="Kullanıcı Bilgileri">
      <form onSubmit={(event) => void submit(event)}>
        <Stack>
          <TextInput
            label="Ad"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.currentTarget.value)}
          />
          <TextInput
            label="Soyad"
            required
            value={lastName}
            onChange={(e) => setLastName(e.currentTarget.value)}
          />
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <Button type="submit" loading={saving} fullWidth>
            Kaydet
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
