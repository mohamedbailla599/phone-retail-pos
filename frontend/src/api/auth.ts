import client from './client';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role?: string;
}

export interface AuthState {
  authenticated: boolean;
  user: User | null;
  operator: User | null;
}

export interface SelectOperatorResponse {
  operator: User;
  operator_context: string;
  expires_in: number;
}

export const authApi = {
  login: async (credentials: Record<string, string>) => {
    // Before login, it's often good practice to get the CSRF cookie if it's not present.
    // In DRF, session auth requires a valid CSRF token. 
    // We'll rely on the server to set it or we might need a dedicated CSRF endpoint.
    // Assuming DRF sets it on standard requests or login doesn't strictly require it 
    // if using AllowAny, but POSTs usually do.
    const { data } = await client.post<AuthState>('/auth/login/', credentials);
    return data;
  },

  logout: async () => {
    await client.post('/auth/logout/');
  },

  me: async () => {
    const { data } = await client.get<AuthState>('/auth/me/');
    return data;
  },

  getOperators: async () => {
    const { data } = await client.get<User[]>('/auth/operators/');
    return data;
  },

  selectOperator: async (operatorId: number) => {
    const { data } = await client.post<SelectOperatorResponse>('/auth/operators/select/', {
      operator_id: operatorId,
    });
    return data;
  },

  clearOperator: async () => {
    const { data } = await client.post('/auth/operators/clear/');
    return data;
  },
};
