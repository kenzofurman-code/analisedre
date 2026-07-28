import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';

export interface StorageAdapter {
  getTransactions: () => Promise<any[]>;
  saveTransactions: (txs: any[]) => Promise<void>;
  clearTransactions: () => Promise<void>;
  subscribeTransactions: (callback: (txs: any[]) => void) => () => void;
  getProjects: () => Promise<any[]>;
  saveProjects: (projects: any[]) => Promise<void>;
  clearProjects: () => Promise<void>;
  subscribeProjects: (callback: (projects: any[]) => void) => () => void;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<void>;
  subscribeSettings: (callback: (settings: any) => void) => () => void;
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

class FirestoreStorageAdapter implements StorageAdapter {
  async getTransactions(): Promise<any[]> {
    if (!db) {
      const data = localStorage.getItem('dre_transactions');
      return data ? JSON.parse(data) : [];
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'transactions'));
      const txs: any[] = [];
      querySnapshot.forEach((docSnapshot: any) => txs.push(docSnapshot.data()));
      return txs;
    } catch (err) {
      const data = localStorage.getItem('dre_transactions');
      return data ? JSON.parse(data) : [];
    }
  }

  async saveTransactions(txs: any[]): Promise<void> {
    localStorage.setItem('dre_transactions', JSON.stringify(txs));

    if (!db) return;

    if (txs.length === 0) {
      await this.clearTransactions();
      return;
    }

    try {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < txs.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const chunk = txs.slice(i, i + CHUNK_SIZE);
        chunk.forEach((tx) => {
          batch.set(doc(db!, 'transactions', tx.id), tx);
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Erro ao salvar no Firestore (batch):', err);
    }
  }

  async clearTransactions(): Promise<void> {
    localStorage.setItem('dre_transactions', '[]');
    if (!db) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'transactions'));
      const docs = querySnapshot.docs;
      const CHUNK_SIZE = 450;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }
    } catch (err) {
      console.error('Erro ao apagar collection transactions no Firestore:', err);
    }
  }

  subscribeTransactions(callback: (txs: any[]) => void): () => void {
    if (!db) return () => {};
    return onSnapshot(
      collection(db, 'transactions'),
      (snapshot) => {
        const txs: any[] = [];
        snapshot.forEach((docSnap) => txs.push(docSnap.data()));
        localStorage.setItem('dre_transactions', JSON.stringify(txs));
        callback(txs);
      },
      (error) => {
        console.error('Erro no listener em tempo real de transactions:', error);
      }
    );
  }

  async getProjects(): Promise<any[]> {
    if (!db) {
      const data = localStorage.getItem('dre_projects');
      return data ? JSON.parse(data) : [];
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const projects: any[] = [];
      querySnapshot.forEach((docSnapshot: any) => projects.push(docSnapshot.data()));
      return projects;
    } catch (err) {
      const data = localStorage.getItem('dre_projects');
      return data ? JSON.parse(data) : [];
    }
  }

  async saveProjects(projects: any[]): Promise<void> {
    localStorage.setItem('dre_projects', JSON.stringify(projects));

    if (!db) return;

    if (projects.length === 0) {
      await this.clearProjects();
      return;
    }

    try {
      const batch = writeBatch(db);
      projects.forEach((p) => {
        batch.set(doc(db!, 'projects', p.id), p);
      });
      await batch.commit();
    } catch (err) {
      console.error('Erro ao salvar projetos no Firestore:', err);
    }
  }

  async clearProjects(): Promise<void> {
    localStorage.setItem('dre_projects', '[]');
    if (!db) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const docs = querySnapshot.docs;
      const batch = writeBatch(db);
      docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    } catch (err) {
      console.error('Erro ao apagar collection projects no Firestore:', err);
    }
  }

  subscribeProjects(callback: (projects: any[]) => void): () => void {
    if (!db) return () => {};
    return onSnapshot(
      collection(db, 'projects'),
      (snapshot) => {
        const projects: any[] = [];
        snapshot.forEach((docSnap) => projects.push(docSnap.data()));
        localStorage.setItem('dre_projects', JSON.stringify(projects));
        callback(projects);
      },
      (error) => {
        console.error('Erro no listener em tempo real de projetos:', error);
      }
    );
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

  subscribeSettings(callback: (settings: any) => void): () => void {
    if (!db) return () => {};
    return onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          const settings = docSnap.data();
          localStorage.setItem('dre_settings', JSON.stringify(settings));
          callback(settings);
        }
      },
      (error) => {
        console.error('Erro no listener em tempo real de settings:', error);
      }
    );
  }
}

export const storageService = new FirestoreStorageAdapter();
