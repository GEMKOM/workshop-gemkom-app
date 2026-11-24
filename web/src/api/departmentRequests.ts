import { infiniteQueryOptions } from '@tanstack/react-query';
import { apiFetch } from './client';

// Department requests, as the legacy generic/purchaseRequest.js used them.

export type RequestStatus =
  'draft' | 'submitted' | 'approved' | 'rejected' | 'transferred' | 'cancelled';

export type RequestPriority = 'normal' | 'urgent' | 'critical';

export interface DepartmentRequest {
  id: number;
  request_number: string;
  title?: string | null;
  status: RequestStatus | string;
  status_label?: string | null;
  priority?: RequestPriority | string | null;
  requestor_full_name?: string | null;
  requestor_username?: string | null;
  department?: string | null;
  needed_date?: string | null;
  created_at?: string | null;
  description?: string | null;
  items?: unknown[] | null;
  [key: string]: unknown;
}

interface Page<T> {
  count?: number;
  next?: string | null;
  results: T[];
}

export const STATUS_OPTIONS: { value: RequestStatus | ''; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'draft', label: 'Taslak' },
  { value: 'submitted', label: 'Onay Bekliyor' },
  { value: 'approved', label: 'Onaylandı' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'transferred', label: 'Satın Almaya Aktarıldı' },
  { value: 'cancelled', label: 'İptal Edildi' },
];

export const PRIORITY_OPTIONS: { value: RequestPriority; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Acil' },
  { value: 'critical', label: 'Kritik' },
];

export const UNIT_OPTIONS = [
  { value: 'adet', label: 'Adet' },
  { value: 'kg', label: 'KG' },
  { value: 'metre', label: 'Metre' },
  { value: 'litre', label: 'Litre' },
  { value: 'paket', label: 'Paket' },
  { value: 'kutu', label: 'Kutu' },
];

/** The request types: an expense account code, its label and its account name. */
export const REQUEST_TYPES = [
  {
    value: '730.06.004',
    label: 'Fabrika Bakım Onarım',
    description: 'Atölye bakımı için gerekli giderler, ekipmanlar, malzemeler, parçalar',
    itemName: 'FABRİKA BAKIM ONARIM GİDERLERİ',
  },
  {
    value: '730.06.005',
    label: 'Makine Bakım Onarım',
    description:
      'Belirli bir makinenin/ekipmanın bakımı için gerekli giderler, ekipmanlar, parçalar',
    itemName: 'FABRİKA MAKİNE BAKIM ONARIM GİDERİ',
  },
  {
    value: '730.10.004',
    label: 'Makine Kiralama',
    description: 'Kiralanması gereken makineler (vinç, kaynak ekipmanı vb.)',
    itemName: 'MAKİNA KİRALAMA GİDERİ',
  },
] as const;

export const myRequestKeys = {
  all: ['departmentRequests', 'mine'] as const,
};

/**
 * The user's requests, a page at a time (GET my_requests/). The backend's
 * my_requests ignores filters, so the status filter is applied on the phone.
 */
export function myRequestsQueryOptions() {
  return infiniteQueryOptions({
    queryKey: myRequestKeys.all,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      apiFetch<Page<DepartmentRequest> | DepartmentRequest[]>(
        '/planning/department-requests/my_requests/',
        { params: { page: pageParam }, signal },
      ).then((data): Page<DepartmentRequest> => (Array.isArray(data) ? { results: data } : data)),
    getNextPageParam: (last, _all, page) => (last.next ? page + 1 : undefined),
  });
}

export interface NewRequestItem {
  name: string;
  quantity: number;
  unit: string;
  description: string;
}

export interface NewRequest {
  title: string;
  neededDate: string;
  description: string;
  priority: RequestPriority;
  requestType: string;
  items: NewRequestItem[];
}

/** The legacy create payload: each item carries the request type's account code and name. */
export function createRequestBody(request: NewRequest) {
  const type = REQUEST_TYPES.find((t) => t.value === request.requestType);
  return {
    title: request.title,
    needed_date: request.neededDate,
    description: request.description,
    priority: request.priority,
    items: request.items.map((item) => ({
      name: type?.itemName,
      item_code: request.requestType,
      item_description: item.name,
      quantity: item.quantity,
      unit: item.unit,
      item_specifications: item.description,
    })),
  };
}

export function createDepartmentRequest(request: NewRequest) {
  return apiFetch<DepartmentRequest>('/planning/department-requests/', {
    method: 'POST',
    body: createRequestBody(request),
  });
}
