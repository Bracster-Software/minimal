import { Database } from './database';

declare global {
  interface DB extends Database {}
  interface WorkspaceUser extends Database['public']['Tables']['workspace_users'] {}
  interface BackupStatus extends Database['public']['Enums']['backup_status'] {}
}

export {};
