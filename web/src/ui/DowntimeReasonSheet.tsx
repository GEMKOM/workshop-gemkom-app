import { Button, Drawer, Stack, Text, Textarea, UnstyledButton } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { reasonCommentOptional, WORK_COMPLETE, type DowntimeReason } from '@/api/machining';
import { errorText } from './notify';
import classes from './Sheets.module.css';

/**
 * "Durma Nedeni" (the legacy downtime-reason modal, which existed twice), with
 * a comment unless reasonCommentOptional says otherwise. From the operations
 * list (`mode="start"`) it offers the reasons that start a timer; when stopping
 * a task (`mode="stop"`) every active reason, among them "Parça İşlemesi
 * Tamamlandı", which completes the operation. `onSubmit` sends the choice; an
 * error it throws shows in the sheet.
 */
export function DowntimeReasonSheet({
  opened,
  onClose,
  reasons,
  mode = 'start',
  title = 'Durma Nedeni Kaydet',
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  reasons: DowntimeReason[];
  mode?: 'start' | 'stop';
  title?: string;
  onSubmit: (reasonId: number, comment: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<DowntimeReason | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const list = reasons.filter((r) => (mode === 'stop' ? r.is_active !== false : r.creates_timer));
  const optional = selected ? reasonCommentOptional(selected) : true;

  const close = () => {
    setSelected(null);
    setComment('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!selected) {
      setError('Lütfen bir durma nedeni seçin.');
      return;
    }
    const text = comment.trim();
    if (!optional && !text) {
      setError('Lütfen açıklama giriniz.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(selected.id, text);
      setSelected(null);
      setComment('');
    } catch (err) {
      setError(errorText(err, 'Durma nedeni kaydedilirken hata oluştu.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={close}
      position="bottom"
      title={title}
      classNames={{ content: classes.sheet }}
    >
      <Stack gap="sm" pb="md">
        {list.length === 0 ? (
          <Text c="dimmed" ta="center">
            Durma nedeni bulunamadı.
          </Text>
        ) : (
          <div className={classes.choices} role="radiogroup" aria-label="Durma nedeni">
            {list.map((reason) => (
              <UnstyledButton
                key={reason.id}
                role="radio"
                aria-checked={selected?.id === reason.id}
                data-checked={selected?.id === reason.id || undefined}
                data-complete={reason.code === WORK_COMPLETE || undefined}
                className={classes.choice}
                onClick={() => {
                  setSelected(reason);
                  setError(null);
                }}
              >
                <span>{reason.name}</span>
                {selected?.id === reason.id ? <IconCircleCheck size={20} /> : null}
              </UnstyledButton>
            ))}
          </div>
        )}
        <Textarea
          label={optional ? 'Açıklama (Opsiyonel)' : 'Açıklama'}
          required={!optional}
          autosize
          minRows={2}
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
          error={error}
        />
        <Button loading={saving} disabled={!selected} onClick={() => void submit()}>
          Kaydet
        </Button>
      </Stack>
    </Drawer>
  );
}
