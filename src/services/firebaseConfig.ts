import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

export interface StorageAdapter {
  getTransactions: () => Promise<any[]>;
  saveTransactions: (txs: any[]) => Promise<void>;
  getProjects: () => Promise<any[]>;
  saveProjects: (projects: any[]) => Promise<void>;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
}

// Configuração lida das variáveis de ambiente do Vite/Vercel (VITE_FIREBASE_*)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID
);

// Firebase Initialization
const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const db = app ? getFirestore(app) : null;

// Firestore Database Adapter
class FirestoreStorageAdapter implements StorageAdapter {
  async getTransactions(): Promise<any[]> {
    if (!db) {
      const data = localStorage.getItem('dre_transactions');
      return data ? JSON.parse(data) : [];
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'transactions'));
      const txs: any[] = [];
      querySnapshot.forEach((doc) => txs.push(doc.data()));
      return txs;
    } catch (err) {
      console.warn('Fallback para localStorage (Firestore erro):', err);
      const data = localStorage.getItem('dre_transactions');
      return data ? JSON.parse(data) : [];
    }
  }

  async saveTransactions(txs: any[]): Promise<void> {
    localStorage.setItem('dre_transactions', JSON.stringify(txs));
    if (db) {
      try {
        for (const tx of txs) {
          await setDoc(doc(db, 'transactions', tx.id), tx);
        }
      } catch (err) {
        console.error('Erro ao salvar no Firestore:', err);
      }
    }
  }

  async getProjects(): Promise<any[]> {
    if (!db) {
      const data = localStorage.getItem('dre_projects');
      return data ? JSON.parse(data) : [];
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const projects: any[] = [];
      querySnapshot.forEach((doc) => projects.push(doc.data()));
      return projects;
    } catch (err) {
      const data = localStorage.getItem('dre_projects');
      return data ? JSON.parse(data) : [];
    }
  }

  async saveProjects(projects: any[]): Promise<void> {
    localStorage.setItem('dre_projects', JSON.stringify(projects));
    if (db) {
      try {
        for (const p of projects) {
          await setDoc(doc(db, 'projects', p.id), p);
        }
      } catch (err) {
        console.error('Erro ao salvar projetos no Firestore:', err);
      }
    }
  }

  async getSettings(): Promise<any> {
    const data = localStorage.getItem('dre_settings');
    return data ? JSON.parse(data) : null;
  }

  async saveSettings(settings: any): Promise<void> {
    localStorage.setItem('dre_settings', JSON.stringify(settings));
    if (db && settings) {
      try {
        await setDoc(doc(db, 'settings', 'global'), settings);
      } catch (err) {
        console.error('Erro ao salvar settings no Firestore:', err);
      }
    }
  }
}

export const storageService = new FirestoreStorageAdapter();
