import {
  Accordion,
  Anchor,
  Badge,
  Drawer,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconFile } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  cncMachinesQueryOptions,
  cncTaskQueryOptions,
  groupCuts,
  openCutsQueryOptions,
  type CncTask,
} from '@/api/cnc';
import { formatDateTime } from '@/lib/format';
import sheets from '@/ui/Sheets.module.css';
import classes from './Cnc.module.css';

// Legacy cnc_cutting/taskOverview.js: every open cut, grouped (Rezerv, planned
// without a machine, then each machine in order), each opening its details:
// the cut, its parts with the total weight, and its files.

function OverviewCard({ task, onOpen }: { task: CncTask; onOpen: () => void }) {
  return (
    <UnstyledButton className={classes.card} onClick={onOpen}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text fw={700} className={classes.code} truncate>
          {task.nesting_id || '-'}
        </Text>
        {task.plan_order != null ? (
          <Badge variant="light" style={{ flex: 'none' }}>
            #{task.plan_order}
          </Badge>
        ) : null}
      </Group>
      <Text size="sm" c="dimmed">
        {task.key}
      </Text>
      <div className={classes.fields}>
        <span>
          <small>Malzeme</small> {task.material || '-'}
        </span>
        <span>
          <small>Boyut</small> {task.dimensions || '-'}
        </span>
        <span>
          <small>Kalınlık</small> {task.thickness_mm ? `${task.thickness_mm} mm` : '-'}
        </span>
        <span>
          <small>Parça</small> {task.parts?.length ?? task.parts_count ?? 0}
        </span>
      </div>
    </UnstyledButton>
  );
}

export function CutDetails({ taskKey, onClose }: { taskKey: string | null; onClose: () => void }) {
  const task = useQuery({ ...cncTaskQueryOptions(taskKey ?? ''), enabled: !!taskKey });
  const t = task.data;
  const parts = t?.parts ?? [];
  const totalKg = parts.reduce((sum, p) => sum + (Number.parseFloat(String(p.weight_kg)) || 0), 0);
  const files = t?.files ?? [];

  return (
    <Drawer
      opened={!!taskKey}
      onClose={onClose}
      position="bottom"
      title={taskKey ? `${taskKey} - Görev Detayları` : ''}
      classNames={{ content: sheets.sheet }}
    >
      {task.isPending ? (
        <Group justify="center" py="lg">
          <Loader />
        </Group>
      ) : task.isError || !t ? (
        <Text c="red">Görev detayları yüklenemedi</Text>
      ) : (
        <Stack gap="md" pb="md">
          <div className={classes.detailGrid}>
            {(
              [
                ['Görev', t.key],
                ['Makine', t.machine_name || '-'],
                ['Nesting', t.nesting_id || '-'],
                ['Malzeme', t.material || '-'],
                ['Boyutlar', t.dimensions || '-'],
                ['Kalınlık', t.thickness_mm ? `${t.thickness_mm} mm` : '-'],
                ['Tahmini', t.estimated_hours ? `${t.estimated_hours} sa` : '-'],
                ['Harcanan', t.total_hours_spent ? `${t.total_hours_spent.toFixed(2)} sa` : '0 sa'],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
                <Text size="sm" fw={500}>
                  {value}
                </Text>
              </div>
            ))}
          </div>

          <div>
            <Text fw={600} mb={6}>
              Dosyalar
            </Text>
            {files.length === 0 ? (
              <Text size="sm" c="dimmed">
                Dosya yok
              </Text>
            ) : (
              <Stack gap={6}>
                {files.map((file, i) => (
                  <Anchor
                    key={file.id ?? i}
                    href={file.file_url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes.file}
                  >
                    <IconFile size={18} />
                    <span>{file.file_name || file.name || 'Dosya'}</span>
                    {file.uploaded_at ? (
                      <Text span size="xs" c="dimmed">
                        {formatDateTime(file.uploaded_at)}
                      </Text>
                    ) : null}
                  </Anchor>
                ))}
              </Stack>
            )}
          </div>

          <div>
            <Text fw={600} mb={6}>
              Parçalar ({t.parts_count ?? parts.length})
            </Text>
            {parts.length === 0 ? (
              <Text size="sm" c="dimmed">
                Parça yok
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={360}>
                <Table striped fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>İş Emri No</Table.Th>
                      <Table.Th>Resim No</Table.Th>
                      <Table.Th>Poz. No</Table.Th>
                      <Table.Th ta="right">kg</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {parts.map((part, i) => (
                      <Table.Tr key={part.id ?? i}>
                        <Table.Td>{i + 1}</Table.Td>
                        <Table.Td>{part.job_no || '-'}</Table.Td>
                        <Table.Td>{part.image_no || '-'}</Table.Td>
                        <Table.Td>{part.position_no || '-'}</Table.Td>
                        <Table.Td ta="right">
                          {part.weight_kg
                            ? Number.parseFloat(String(part.weight_kg)).toFixed(2)
                            : '-'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                  <Table.Tfoot>
                    <Table.Tr>
                      <Table.Th colSpan={4}>Toplam</Table.Th>
                      <Table.Th ta="right">{totalKg.toFixed(2)} kg</Table.Th>
                    </Table.Tr>
                  </Table.Tfoot>
                </Table>
              </Table.ScrollContainer>
            )}
          </div>
        </Stack>
      )}
    </Drawer>
  );
}

export function CncOverview() {
  const machines = useQuery(cncMachinesQueryOptions());
  const cuts = useQuery(openCutsQueryOptions());
  const [open, setOpen] = useState<string | null>(null);

  if (machines.isPending || cuts.isPending) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }
  if (machines.isError || cuts.isError) {
    return <Text c="red">Görevler yüklenirken bir hata oluştu.</Text>;
  }
  const groups = groupCuts(cuts.data);
  const columns = [
    { id: 'reserve', title: 'Rezerv', tasks: groups.reserve },
    { id: 'planned', title: 'Yapılacaklar (Planlı)', tasks: groups.planned },
    ...machines.data.map((m) => ({
      id: `machine-${m.id}`,
      title: m.name,
      tasks: groups.machines.get(m.id) ?? [],
    })),
  ];

  return (
    <>
      <Accordion multiple defaultValue={[]} variant="separated" chevronPosition="right">
        {columns.map((col) => (
          <Accordion.Item key={col.id} value={col.id}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap" pr="xs">
                <Text fw={600}>{col.title}</Text>
                <Badge variant="light" color={col.tasks.length ? 'gemkom' : 'gray'}>
                  {col.tasks.length}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {col.tasks.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Görev bulunamadı
                </Text>
              ) : (
                <Stack gap="sm">
                  {col.tasks.map((task) => (
                    <OverviewCard key={task.key} task={task} onOpen={() => setOpen(task.key)} />
                  ))}
                </Stack>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
      <CutDetails taskKey={open} onClose={() => setOpen(null)} />
    </>
  );
}
