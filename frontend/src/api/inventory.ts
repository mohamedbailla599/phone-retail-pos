import client from './client';

export interface ProductRef {
  id: number;
  sku: string;
  name: string;
  brand: string;
}

export interface DeviceItem {
  id: number;
  product: ProductRef;
  imei_1: string | null;
  imei_2: string | null;
  serial_number: string | null;
  cost_price: string;
  default_selling_price: string;
  minimum_selling_price: string;
  battery_health: number | null;
  condition: string;
  status: string;
  received_at: string;
}

export interface AccessoryStock {
  id: number;
  product: ProductRef;
  quantity: number;
  cost_price: string;
  selling_price: string;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export const inventoryApi = {
  getDevices: async (params?: Record<string, any>) => {
    const { data } = await client.get<DeviceItem[]>('/inventory/devices/', { params });
    return data;
  },

  getAccessories: async (params?: Record<string, any>) => {
    const { data } = await client.get<AccessoryStock[]>('/inventory/accessories/', { params });
    return data;
  },

  receiveDevice: async (deviceData: any) => {
    const { data } = await client.post<DeviceItem>('/inventory/receive/device/', deviceData);
    return data;
  },

  receiveAccessory: async (accessoryData: { accessory_stock_id: number; quantity: number }) => {
    const { data } = await client.post<AccessoryStock>('/inventory/receive/accessory/', accessoryData);
    return data;
  },

  adjustAccessoryStock: async (data: { accessory_stock_id: number; quantity_delta: number; reason: string }) => {
    const response = await client.post<AccessoryStock>('/inventory/adjust/accessory/', data);
    return response.data;
  },
  
  changeDeviceStatus: async (data: { device_id: number; target_status: string; reason: string }) => {
    const response = await client.post<DeviceItem>('/inventory/device/status/', data);
    return response.data;
  }
};
