import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

export interface StorageAdapter {
  getData: () => Promise<{ transactions: any[]; projects: any[]; settings: any } | null>;
  saveData: (data: { transactions: any[]; projects: any[]; settings: any }) => Promise<{ success: boolean; error?: string }>;
  subscribeData: (callback: (data: { transactions: any[]; projects: any[]; settings: any }) => void) => () => void;
  clearAll: () => Promise<void>;
  clearTransactions: () => Promise<void>;
  clearProjects: () => Promise<void>;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID
);

const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const db = app ? getFirestore(app) : null;

function sanitizePayload(payload: any): any {
  return JSON.parse(JSON.stringify(payload));
}

class FirestoreStorageAdapter implements StorageAdapter {
  async getData(): Promise<{ transactions: any[]; projects: any[]; settings: any } | null> {
    if (!db) {
      const txs = localStorage.getItem('dre_transactions');
      const projs = localStorage.getItem('dre_projects');
      const stgs = localStorage.getItem('dre_settings');
      return {
        transactions: txs ? JSON.parse(txs) : [],
        projects: projs ? JSON.parse(projs) : [],
        settings: stgs ? JSON.parse(stgs) : null,
      };
    }
    try {
      const docSnap = await getDoc(doc(db, 'dre_store', 'main_db'));
      if (docSnap.exists()) {
        const remoteData = docSnap.data();
        return {
          transactions: remoteData.transactions || [],
          projects: remoteData.projects || [],
          settings: remoteData.settings || null,
        };
      }
    } catch (err) {
      console.error('Erro ao ler do Firestore:', err);
    }
    return null;
  }

  async saveData(data: { transactions: any[]; projects: any[]; settings: any }): Promise<{ success: boolean; error?: string }> {
    const cleanData = sanitizePayload({
      transactions: data.transactions || [],
      projects: data.projects || [],
      settings: data.settings || {},
      updatedAt: new Date().toISOString(),
    });

    localStorage.setItem('dre_transactions', JSON.stringify(cleanData.transactions));
    localStorage.setItem('dre_projects', JSON.stringify(cleanData.projects));
    if (cleanData.settings) {
      localStorage.setItem('dre_settings', JSON.stringify(cleanData.settings));
    }

    if (!isFirebaseConfigured) {
      return { success: false, error: 'Chaves de ambiente Firebase não encontradas (VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID).' };
    }

    if (!db) {
      return { success: false, error: 'Conexão Firestore não inicializada.' };
    }

    try {
      await setDoc(doc(db, 'dre_store', 'main_db'), cleanData);
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao salvar no Firestore:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  async clearAll(): Promise<void> {
    localStorage.setItem('dre_transactions', '[]');
    localStorage.setItem('dre_projects', '[]');
    if (!db) return;
    try {
      const payload = sanitizePayload({
        transactions: [],
        projects: [],
        settings: {},
        updatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'dre_store', 'main_db'), payload);
    } catch (err) {
      console.error('Erro ao limpar Firestore:', err);
    }
  }

  async clearTransactions(): Promise<void> {
    localStorage.setItem('dre_transactions', '[]');
    if (!db) return;
    try {
      const current = await this.getData();
      const payload = sanitizePayload({
        transactions: [],
        projects: current?.projects || [],
        settings: current?.settings || {},
        updatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'dre_store', 'main_db'), payload);
    } catch (err) {
      console.error('Erro ao limpar transactions no Firestore:', err);
    }
  }

  async clearProjects(): Promise<void> {
    localStorage.setItem('dre_projects', '[]');
    if (!db) return;
    try {
      const current = await this.getData();
      const payload = sanitizePayload({
        transactions: current?.transactions || [],
        projects: [],
        settings: current?.settings || {},
        updatedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'dre_store', 'main_db'), payload);
    } catch (err) {
      console.error('Erro ao limpar projetos no Firestore:', err);
    }
  }

  subscribeData(callback: (data: { transactions: any[]; projects: any[]; settings: any }) => void): () => void {
    if (!db) return () => {};
    return onSnapshot(
      doc(db, 'dre_store', 'main_db'),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data() as any;
          const txs = remoteData.transactions || [];
          const projs = remoteData.projects || [];
          const stgs = remoteData.settings || {};

          localStorage.setItem('dre_transactions', JSON.stringify(txs));
          localStorage.setItem('dre_projects', JSON.stringify(projs));
          if (Object.keys(stgs).length > 0) {
            localStorage.setItem('dre_settings', JSON.stringify(stgs));
          }

          callback({ transactions: txs, projects: projs, settings: stgs });
        }
      },
      (error) => {
        console.error('Erro no listener em tempo real dre_store:', error);
      }
    );
  }
}

export const storageService = new FirestoreStorageAdapter();
