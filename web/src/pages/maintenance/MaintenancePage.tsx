import { SegmentedControl, Stack } from '@mantine/core';
import { useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { FaultList } from './FaultList';
import { MaintenanceCreate } from './MaintenanceCreate';

// Legacy maintenance/: three tabs in ?tab= (the URL is replaced, not pushed).
// The open-faults tab needs access_maintenance_list, as its URL always did;
// it is hidden from users without it instead of refusing them on reload.

type Tab = 'create-request' | 'fault-requests' | 'resolved-requests';

export function MaintenancePage() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const canList = auth.can('access_maintenance_list');
  const requested = params.get('tab');
  const tab: Tab =
    requested === 'resolved-requests' || (requested === 'fault-requests' && canList)
      ? requested
      : 'create-request';

  const tabs = [
    { value: 'create-request', label: 'Yeni Talep' },
    ...(canList ? [{ value: 'fault-requests', label: 'Açık Talepler' }] : []),
    { value: 'resolved-requests', label: 'Çözülen' },
  ];

  return (
    <Stack gap="md">
      <SegmentedControl
        data={tabs}
        value={tab}
        onChange={(value) => setParams({ tab: value }, { replace: true })}
        aria-label="Bakım sekmeleri"
      />
      {tab === 'create-request' ? <MaintenanceCreate /> : null}
      {tab === 'fault-requests' ? <FaultList unresolved /> : null}
      {tab === 'resolved-requests' ? <FaultList unresolved={false} /> : null}
    </Stack>
  );
}
