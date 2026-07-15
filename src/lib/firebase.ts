/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  runTransaction,
  writeBatch,
  where,
  getDocs,
  deleteDoc,
  updateDoc
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

// Core DB operations helper functions
export { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  runTransaction,
  writeBatch,
  where,
  getDocs,
  deleteDoc,
  updateDoc
};
