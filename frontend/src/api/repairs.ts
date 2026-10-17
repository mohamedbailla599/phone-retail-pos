import api from './client';

export type RepairStatus =
  | 'RECEIVED'
  | 'DIAGNOSING'
  | 'WAITING_PARTS'
  | 'IN_PROGRESS'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export type IssueType =
  | 'SCREEN'
  | 'BATTERY'
  | 'CHARGING_PORT'
  | 'BACK_GLASS'
  | 'CAMERA'
  | 'WATER_DAMAGE'
  | 'SPEAKER_MIC'
  | 'SOFTWARE'
  | 'MOTHERBOARD'
  | 'OTHER';

export interface RepairTicket {
  id: number;
  ticket_number: string;
  customer: number | null;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_color: string | null;
  imei_or_serial: string | null;
  passcode: string | null;
  issue_type: IssueType;
  issue_type_display: string;
  issue_description: string;
  technician_notes: string | null;
  status: RepairStatus;
  status_display: string;
  estimated_cost: string;
  final_cost: string;
  deposit_paid: string;
  remaining_balance: number;
  is_paid: boolean;
  payment_method: string | null;
  warranty_days: number;
  created_by: number;
  created_by_username: string;
  created_by_name?: string;
  assigned_technician: number | null;
  assigned_technician_username: string | null;
  estimated_completion_date: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRepairPayload {
  customer_name: string;
  customer_phone: string;
  customer_id?: number | null;
  device_brand: string;
  device_model: string;
  device_color?: string;
  imei_or_serial?: string;
  passcode?: string;
  issue_type: IssueType;
  issue_description: string;
  estimated_cost?: number;
  deposit_paid?: number;
  estimated_completion_date?: string | null;
}

export interface UpdateRepairStatusPayload {
  status: RepairStatus;
  technician_notes?: string;
  final_cost?: number;
  assigned_technician_id?: number | null;
}

export interface DeliverRepairPayload {
  payment_method: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
}

export const repairsApi = {
  getRepairs: async (params?: { status?: string; search?: string }): Promise<RepairTicket[]> => {
    const res = await api.get('/warranty/repairs/', { params });
    return res.data;
  },

  getRepair: async (id: number): Promise<RepairTicket> => {
    const res = await api.get(`/warranty/repairs/${id}/`);
    return res.data;
  },

  createRepair: async (payload: CreateRepairPayload): Promise<RepairTicket> => {
    const res = await api.post('/warranty/repairs/', payload);
    return res.data;
  },

  updateStatus: async (id: number, payload: UpdateRepairStatusPayload): Promise<RepairTicket> => {
    const res = await api.post(`/warranty/repairs/${id}/status/`, payload);
    return res.data;
  },

  deliverRepair: async (id: number, payload: DeliverRepairPayload): Promise<RepairTicket> => {
    const res = await api.post(`/warranty/repairs/${id}/deliver/`, payload);
    return res.data;
  },
};
