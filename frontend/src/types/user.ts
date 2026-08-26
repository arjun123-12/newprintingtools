import { Address } from './common';

export type UserRole = 'customer' | 'admin' | 'production_manager' | 'prepress_operator' | 'support';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  company_name?: string;
  abn?: string;
  addresses: Address[];
  created_at: string;
  updated_at: string;
}
