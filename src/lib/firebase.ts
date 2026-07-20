/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc as rawSetDoc, 
  getDoc as rawGetDoc, 
  collection, 
  addDoc as rawAddDoc, 
  onSnapshot as rawOnSnapshot, 
  query, 
  orderBy, 
  limit, 
  runTransaction as rawRunTransaction,
  writeBatch,
  where,
  getDocs as rawGetDocs,
  deleteDoc as rawDeleteDoc,
  updateDoc as rawUpdateDoc
} from 'firebase/firestore';

// Environment variables configuration with active workspace fallbacks
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "AIzaSyCGbzJQ5mr7lllWQWqM45u_8xbf8ETndGw",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "gen-lang-client-0166435621.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "gen-lang-client-0166435621",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "gen-lang-client-0166435621.firebasestorage.app",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "979679550621",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:979679550621:web:a0d6c3c3c8ec32ac6b4874",
};

const databaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) || "ai-studio-4d507254-7345-47e3-88fa-bfd44c03a244";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if provided
export const db = getFirestore(app, databaseId);

// Initialize Auth
export const auth = getAuth(app);

// Error Handling Infrastructure
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Wrappers for DB operations helper functions
export const getDoc = async <T = any>(reference: any): Promise<any> => {
  try {
    return await rawGetDoc(reference);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, reference?.path || null);
    throw error;
  }
};

export const setDoc = async (reference: any, data: any, options?: any): Promise<any> => {
  try {
    return await rawSetDoc(reference, data, options);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reference?.path || null);
    throw error;
  }
};

export const addDoc = async (reference: any, data: any): Promise<any> => {
  try {
    return await rawAddDoc(reference, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, reference?.path || null);
    throw error;
  }
};

export const getDocs = async (queryRef: any): Promise<any> => {
  try {
    return await rawGetDocs(queryRef);
  } catch (error) {
    const path = queryRef?.path || (queryRef?.query?.path) || null;
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
};

export const deleteDoc = async (reference: any): Promise<any> => {
  try {
    return await rawDeleteDoc(reference);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, reference?.path || null);
    throw error;
  }
};

export const updateDoc = async (reference: any, data: any): Promise<any> => {
  try {
    return await rawUpdateDoc(reference, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reference?.path || null);
    throw error;
  }
};

export const onSnapshot = (ref: any, ...args: any[]): any => {
  const nextOrObserver: any = args[0];
  const errorCb: any = args[1];
  const completeCb: any = args[2];
  
  if (typeof nextOrObserver === 'function') {
    const wrappedError = (error: any) => {
      const path = ref?.path || null;
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrappedErr) {
        if (errorCb) {
          errorCb(wrappedErr);
        } else {
          console.error("Uncaught onSnapshot error: ", wrappedErr);
        }
      }
    };
    return rawOnSnapshot(ref, nextOrObserver, wrappedError, completeCb);
  } else {
    const observer = nextOrObserver;
    if (observer && typeof observer.error === 'function') {
      const originalError = observer.error;
      observer.error = (error: any) => {
        const path = ref?.path || null;
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (wrappedErr) {
          originalError(wrappedErr);
        }
      };
    }
    return rawOnSnapshot(ref, observer);
  }
};

export const runTransaction = async (firestore: any, updateFunction: any, options?: any): Promise<any> => {
  try {
    return await rawRunTransaction(firestore, updateFunction, options);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, null);
    throw error;
  }
};

export { 
  doc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  writeBatch,
  where
};
