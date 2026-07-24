// Firebase & Offline Storage Service Configuration

export interface StorageAdapter {
  getTransactions: () => Promise<any[]>;
  saveTransactions: (txs: any[]) => Promise<void>;
  getProjects: () => Promise<any[]>;
  saveProjects: (projects: any[]) => Promise<void>;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
}

// LocalStorage Adapter with fallback
class LocalStorageAdapter implements StorageAdapter {
  async getTransactions(): Promise<any[]> {
    const data = localStorage.getItem('dre_transactions');
    return data ? JSON.parse(data) : [];
  }

  async saveTransactions(txs: any[]): Promise<void> {
    localStorage.setItem('dre_transactions', JSON.stringify(txs));
  }

  async getProjects(): Promise<any[]> {
    const data = localStorage.getItem('dre_projects');
    return data ? JSON.parse(data) : [];
  }

  async saveProjects(projects: any[]): Promise<void> {
    localStorage.setItem('dre_projects', JSON.stringify(projects));
  }

  async getSettings(): Promise<any> {
    const data = localStorage.getItem('dre_settings');
    return data ? JSON.parse(data) : null;
  }

  async saveSettings(settings: any): Promise<void> {
    localStorage.setItem('dre_settings', JSON.stringify(settings));
  }
}

export const storageService = new LocalStorageAdapter();
