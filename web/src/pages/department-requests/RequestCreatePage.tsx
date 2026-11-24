import {
  Alert,
  Button,
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  createDepartmentRequest,
  myRequestKeys,
  PRIORITY_OPTIONS,
  REQUEST_TYPES,
  UNIT_OPTIONS,
  type NewRequestItem,
  type RequestPriority,
} from '@/api/departmentRequests';
import { errorText, notify } from '@/ui/notify';
import { StickyActions } from '@/ui/StickyActions';
import classes from './DepartmentRequests.module.css';

// Legacy department-requests/create: the request, its type (an expense account)
// and its items. The legacy page used alert() for problems; they show inline.

interface ItemDraft extends NewRequestItem {
  key: number;
}

let nextKey = 1;
const newItem = (): ItemDraft => ({
  key: nextKey++,
  name: '',
  quantity: 1,
  unit: 'adet',
  description: '',
});

/** Today as YYYY-MM-DD in the phone's time zone (the legacy page used UTC). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function RequestCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [neededDate, setNeededDate] = useState(today);
  const [priority, setPriority] = useState<RequestPriority>('normal');
  const [requestType, setRequestType] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemDraft[]>(() => [newItem()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const updateItem = (key: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const fail = (message: string) => {
    setError(message);
    window.setTimeout(() => errorRef.current?.scrollIntoView?.({ block: 'center' }), 0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !neededDate || !description.trim()) {
      fail('Lütfen başlık, ihtiyaç tarihi ve açıklamayı doldurun.');
      return;
    }
    if (items.length === 0) {
      fail('Lütfen en az bir ürün ekleyin.');
      return;
    }
    if (items.some((item) => !item.name.trim() || !item.unit || !(item.quantity >= 1))) {
      fail('Lütfen tüm ürün bilgilerini eksiksiz doldurun.');
      return;
    }
    if (!requestType) {
      fail('Lütfen talep tipini seçin.');
      return;
    }
    setSaving(true);
    try {
      await createDepartmentRequest({
        title,
        neededDate,
        description,
        priority,
        requestType,
        items: items.map(({ name, quantity, unit, description: spec }) => ({
          name,
          quantity: Math.trunc(quantity),
          unit,
          description: spec,
        })),
      });
      notify.success('Departman talebi başarıyla oluşturuldu.');
      await queryClient.invalidateQueries({ queryKey: myRequestKeys.all });
      void navigate('/department-requests/');
    } catch (err) {
      fail(`Talep oluşturulurken hata oluştu: ${errorText(err)}`);
      setSaving(false);
    }
  };

  const selectedType = REQUEST_TYPES.find((t) => t.value === requestType);

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <Stack gap="md">
        <div>
          <Title order={2} fz={22}>
            Yeni Departman Talebi
          </Title>
          <Text size="sm" c="dimmed">
            Talebiniz oluşturulduktan sonra departman yöneticinizin onayına sunulur.
          </Text>
        </div>

        {error ? (
          <Alert ref={errorRef} color="red" icon={<IconAlertCircle size={18} />} role="alert">
            {error}
          </Alert>
        ) : null}

        <Paper withBorder p="md">
          <Stack gap="sm">
            <Text fw={600}>Talep Bilgileri</Text>
            <TextInput
              label="Talep Başlığı"
              placeholder="Talep başlığını girin"
              required
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <TextInput
              label="İhtiyaç Tarihi"
              type="date"
              required
              value={neededDate}
              onChange={(e) => setNeededDate(e.currentTarget.value)}
            />
            <NativeSelect
              label="Öncelik"
              data={PRIORITY_OPTIONS}
              value={priority}
              onChange={(e) => setPriority(e.currentTarget.value as RequestPriority)}
              description="Normal: standart · Acil: öncelikli işlem · Kritik: acil müdahale"
            />
            <div>
              <Text size="md" fw={500} mb={6}>
                Talep Tipi <span style={{ color: 'var(--gk-danger)' }}>*</span>
              </Text>
              <Stack gap={8} role="radiogroup" aria-label="Talep Tipi">
                {REQUEST_TYPES.map((type) => (
                  <UnstyledButton
                    key={type.value}
                    role="radio"
                    aria-checked={requestType === type.value}
                    data-checked={requestType === type.value || undefined}
                    className={classes.typeCard}
                    onClick={() => setRequestType(type.value)}
                  >
                    <Text fw={600}>{type.label}</Text>
                    <Text size="sm" c="dimmed">
                      {type.description}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
              {selectedType ? null : (
                <Text size="xs" c="dimmed" mt={4}>
                  Talebin hangi gider kalemine yazılacağını seçin.
                </Text>
              )}
            </div>
            <Textarea
              label="Detaylı Açıklama"
              placeholder="Talep detaylarını açıklayın..."
              required
              autosize
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </Stack>
        </Paper>

        <Text fw={600}>Ürünler</Text>
        {items.map((item, index) => (
          <Paper key={item.key} withBorder p="md" className={classes.itemCard}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600}>Ürün {index + 1}</Text>
                {items.length > 1 ? (
                  <Button
                    variant="subtle"
                    color="red"
                    size="sm"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                  >
                    Sil
                  </Button>
                ) : null}
              </Group>
              <TextInput
                label="Ürün Adı"
                placeholder="Ürün adını girin"
                required
                value={item.name}
                onChange={(e) => updateItem(item.key, { name: e.currentTarget.value })}
              />
              <div className={classes.itemRow}>
                <NumberInput
                  label="Miktar"
                  min={1}
                  allowDecimal={false}
                  allowNegative={false}
                  inputMode="numeric"
                  required
                  value={item.quantity}
                  onChange={(value) =>
                    updateItem(item.key, { quantity: typeof value === 'number' ? value : 0 })
                  }
                />
                <NativeSelect
                  label="Birim"
                  data={UNIT_OPTIONS}
                  value={item.unit}
                  onChange={(e) => updateItem(item.key, { unit: e.currentTarget.value })}
                />
              </div>
              <Textarea
                label="Açıklama"
                placeholder="Ürün detaylarını girin, link varsa ekleyin..."
                autosize
                minRows={2}
                value={item.description}
                onChange={(e) => updateItem(item.key, { description: e.currentTarget.value })}
              />
            </Stack>
          </Paper>
        ))}
        <Button
          variant="light"
          leftSection={<IconPlus size={18} />}
          onClick={() => setItems((list) => [...list, newItem()])}
        >
          Ürün Ekle
        </Button>

        <StickyActions>
          <Button variant="default" component={Link} to="/department-requests/">
            İptal
          </Button>
          <Button type="submit" loading={saving}>
            Talep Oluştur
          </Button>
        </StickyActions>
      </Stack>
    </form>
  );
}
