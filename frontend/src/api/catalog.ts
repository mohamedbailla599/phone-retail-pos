import client from './client';

export interface Category {
  id: number;
  name: string;
  is_device: boolean;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  brand: string;
  platform: string;
  storage_gb: number | null;
  ram_gb: number | null;
  is_active: boolean;
  category: Category;
  created_at: string;
}

export const catalogApi = {
  getProducts: async (params?: Record<string, any>) => {
    const { data } = await client.get<Product[]>('/catalog/products/', { params });
    return data;
  },

  getCategories: async () => {
    const { data } = await client.get<Category[]>('/catalog/categories/');
    return data;
  },

  createCategory: async (categoryData: { name: string; is_device: boolean }) => {
    const { data } = await client.post<Category>('/catalog/categories/', categoryData);
    return data;
  },

  createProduct: async (productData: any) => {
    const { data } = await client.post<Product>('/catalog/products/', productData);
    return data;
  }
};
