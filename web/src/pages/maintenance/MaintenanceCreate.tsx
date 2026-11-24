import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconSearch, IconSettings } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  createMaintenanceRequest,
  maintenanceKeys,
  maintenanceMachinesQueryOptions,
  type Machine,
} from '@/api/maintenance';
import { useAuth } from '@/auth/AuthProvider';
import { errorText, notify } from '@/ui/notify';
import { StickyActions } from '@/ui/StickyActions';
import classes from './Maintenance.module.css';

// Legacy maintenance/create: a machine from the list (or equipment that isn't
// in it, after a warning), maintenance or fault, "is the machine operable" for
// faults, and a description.

function machineText(machine: Machine): string {
  return [
    machine.name,
    machine.code,
    machine.machine_type_label,
    ...(machine.assigned_users ?? []).map((u) => u.username),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr');
}

function MachinePicker({
  opened,
  onClose,
  onPick,
}: {
  opened: boolean;
  onClose: () => void;
  onPick: (machine: Machine) => void;
}) {
  const machines = useQuery({ ...maintenanceMachinesQueryOptions(), enabled: opened });
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase('tr');
  const list = (machines.data ?? []).filter((m) => !term || machineText(m).includes(term));

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      title="Makine Seçin"
      classNames={{ content: classes.sheet }}
    >
      <Stack gap="sm" pb="md">
        <TextInput
          leftSection={<IconSearch size={18} />}
          placeholder="Makine adı, tür veya kullanıcı ara..."
          aria-label="Makine ara"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          data-autofocus
        />
        {machines.isPending ? (
          <Group justify="center" py="lg">
            <Loader />
          </Group>
        ) : machines.isError ? (
          <Text c="red">Makineler yüklenirken hata oluştu</Text>
        ) : list.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">
            Makine bulunamadı
          </Text>
        ) : (
          list.map((machine) => (
            <UnstyledButton
              key={machine.id}
              className={classes.machineRow}
              onClick={() => {
                onPick(machine);
                onClose();
              }}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {machine.name || '-'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {machine.code || '-'}
                    {machine.assigned_users?.length
                      ? ` · ${machine.assigned_users.map((u) => u.username).join(', ')}`
                      : ' · Atanmamış'}
                  </Text>
                </div>
                {machine.machine_type_label ? (
                  <Badge variant="light" style={{ flex: 'none' }}>
                    {machine.machine_type_label}
                  </Badge>
                ) : null}
              </Group>
            </UnstyledButton>
          ))
        )}
      </Stack>
    </Drawer>
  );
}

export function MaintenanceCreate() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [location, setLocation] = useState('');
  const [kind, setKind] = useState<'' | 'maintenance' | 'fault'>('');
  const [operable, setOperable] = useState(true);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!kind || !description.trim()) {
      setError('Lütfen talep türü ve açıklama alanlarını doldurun.');
      return;
    }
    if (custom ? !assetName.trim() || !location.trim() : !machine) {
      setError(
        custom ? 'Lütfen ekipman adı ve konum bilgilerini doldurun.' : 'Lütfen bir makine seçin.',
      );
      return;
    }
    setSaving(true);
    try {
      await createMaintenanceRequest({
        kind,
        description,
        operable,
        machineId: machine?.id,
        custom: custom ? { assetName: assetName.trim(), location: location.trim() } : null,
      });
      notify.success('Bakım talebi başarıyla oluşturuldu.');
      await queryClient.invalidateQueries({ queryKey: maintenanceKeys.allFaults });
      // The legacy page went to the home page; the open requests show the new one.
      void navigate(
        auth.can('access_maintenance_list') ? '/maintenance/?tab=fault-requests' : '/',
        { replace: true },
      );
    } catch (err) {
      setError(errorText(err, 'Bakım talebi oluşturulurken hata oluştu.'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <Stack gap="md">
        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} role="alert">
            {error}
          </Alert>
        ) : null}

        <Paper withBorder p="md">
          <Stack gap="sm">
            <Checkbox
              label="Özel Ekipman Bilgisi Gir"
              description="Sistemde kayıtlı olmayan ekipmanlar için"
              checked={custom}
              onChange={(e) => {
                if (e.currentTarget.checked) {
                  setWarningOpen(true);
                } else {
                  setCustom(false);
                  setAssetName('');
                  setLocation('');
                }
              }}
            />
            {custom ? (
              <>
                <TextInput
                  label="Ekipman Adı"
                  placeholder="Ekipman adını girin"
                  required
                  value={assetName}
                  onChange={(e) => setAssetName(e.currentTarget.value)}
                />
                <TextInput
                  label="Konum"
                  placeholder="Konum bilgisini girin"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.currentTarget.value)}
                />
              </>
            ) : (
              <div>
                <Text fw={500} mb={6}>
                  Makine
                </Text>
                {machine ? (
                  <Paper withBorder p="sm" className={classes.selected}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} truncate>
                          {machine.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {[machine.code, machine.machine_type_label].filter(Boolean).join(' · ')}
                        </Text>
                      </div>
                      <Button variant="subtle" size="sm" onClick={() => setPickerOpen(true)}>
                        Değiştir
                      </Button>
                    </Group>
                  </Paper>
                ) : (
                  <Button
                    fullWidth
                    variant="light"
                    leftSection={<IconSettings size={18} />}
                    onClick={() => setPickerOpen(true)}
                  >
                    Makine Seç
                  </Button>
                )}
              </div>
            )}

            <div>
              <Text fw={500} mb={6}>
                Talep Türü
              </Text>
              <SegmentedControl
                data={[
                  { value: 'maintenance', label: 'Bakım' },
                  { value: 'fault', label: 'Arıza' },
                ]}
                value={kind}
                onChange={(value) => setKind(value as 'maintenance' | 'fault')}
                aria-label="Talep Türü"
              />
            </div>
            {kind === 'fault' ? (
              <Checkbox
                label="Makine çalışır durumda"
                description="İşaretli değilse makine duruşta sayılır"
                checked={operable}
                onChange={(e) => setOperable(e.currentTarget.checked)}
              />
            ) : null}
            <Textarea
              label="Detaylı Açıklama"
              placeholder="Bakım/arıza detaylarını açıklayın. Mümkün olduğunca detaylı bilgi verin..."
              required
              autosize
              minRows={4}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </Stack>
        </Paper>

        <StickyActions columns="1fr">
          <Button type="submit" loading={saving}>
            Talep Oluştur
          </Button>
        </StickyActions>
      </Stack>

      <MachinePicker opened={pickerOpen} onClose={() => setPickerOpen(false)} onPick={setMachine} />

      <Modal
        opened={warningOpen}
        onClose={() => setWarningOpen(false)}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-yellow-7)" />
            Özel Ekipman Uyarısı
          </Group>
        }
      >
        <Stack gap="sm">
          <Text size="sm">
            <strong>Önemli:</strong> Özel ekipman seçeneğini kullanmadan önce, bakım yapılacak
            makinenin sistemde kayıtlı olup olmadığını kontrol etmeniz önerilir.
          </Text>
          <Text size="sm" component="ul" pl="md" m={0}>
            <li>Mevcut makine listesinde arama yapın</li>
            <li>Makine bulunamazsa özel ekipman seçeneğini kullanın</li>
            <li>Bu seçenek sadece sistemde kayıtlı olmayan ekipmanlar için kullanılmalıdır</li>
          </Text>
          <Group grow mt="xs">
            <Button variant="default" onClick={() => setWarningOpen(false)}>
              Geri Dön
            </Button>
            <Button
              onClick={() => {
                setWarningOpen(false);
                setCustom(true);
                setMachine(null);
              }}
            >
              Özel Ekipman Kullan
            </Button>
          </Group>
        </Stack>
      </Modal>
    </form>
  );
}
