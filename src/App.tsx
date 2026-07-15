/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WineItem, BidRecord, AppView } from './types';
import { 
  db, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from './lib/firebase';
import DashboardView from './components/DashboardView';
import BidderView from './components/BidderView';
import AdminView from './components/AdminView';
import { Layers, Tv, Smartphone, ShieldCheck, ChevronUp, ChevronDown } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [wine, setWine] = useState<WineItem | null>(null);
  const [bids, setBids] = useState<BidRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Controls for the floating quick-view switcher
  const [isSwitcherOpen, setIsSwitcherOpen] = useState<boolean>(false);

  // 1. Listen to URL changes or scan query parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'bid' || mode === 'bidder') {
      setActiveView('bidder');
    } else if (mode === 'admin') {
      setActiveView('admin');
    } else if (mode === 'dashboard') {
      setActiveView('dashboard');
    }
  }, []);

  // 2. Real-time Firebase Firestore Sync for current auction item
  useEffect(() => {
    const wineDocRef = doc(db, 'auctions', 'active_wine');

    // Self-bootstrap initial luxurious auction item if it doesn't exist
    const bootstrapDefaultWine = async () => {
      try {
        const docSnap = await getDoc(wineDocRef);
        if (!docSnap.exists()) {
          const defaultWine: WineItem = {
            id: 'active_wine',
            name: "Château Margaux Grand Cru 2015",
            imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800",
            startingPrice: 38000,
            currentBid: 38000,
            highestBidderId: null,
            highestBidderName: null,
            bidIncrementSteps: [500, 1000, 5000, 10000],
            status: 'active',
            updatedAt: Date.now()
          };
          await setDoc(wineDocRef, defaultWine);
        }
      } catch (err) {
        console.error("Firebase auto-bootstrap failed: ", err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapDefaultWine();

    // Attach real-time Firestore listener
    const unsubscribe = onSnapshot(wineDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setWine(docSnap.data() as WineItem);
      } else {
        setWine(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore error listening to active_wine: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Real-time Firebase Firestore Sync for bids history log
  useEffect(() => {
    const bidsCollectionRef = collection(db, 'bids');
    const bidsQuery = query(bidsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(bidsQuery, (snapshot) => {
      const records: BidRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push({ ...docSnap.data(), id: docSnap.id } as BidRecord);
      });
      setBids(records);
    }, (error) => {
      console.error("Firestore error listening to bids: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Quick helper to switch view and update browser URL hash without full reload
  const handleViewChange = (view: AppView) => {
    setActiveView(view);
    
    // Update the URL query params so copying link or scanning QR code preserves state
    const url = new URL(window.location.href);
    url.searchParams.set('mode', view);
    window.history.pushState({}, '', url.toString());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d090a] text-stone-100 font-sans flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-wine-800 border-t-gold-400 animate-spin" />
        <p className="text-sm font-mono tracking-wider text-stone-400">CONNECTING TO FIREBASE REAL-TIME SECURE ENGINE...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0d090a]">
      {/* Dynamic Main View Loader */}
      {activeView === 'dashboard' && (
        <DashboardView wine={wine} bids={bids} onViewChange={handleViewChange} />
      )}
      
      {activeView === 'bidder' && (
        <BidderView wine={wine} bids={bids} onViewChange={handleViewChange} />
      )}
      
      {activeView === 'admin' && (
        <AdminView wine={wine} bids={bids} onViewChange={handleViewChange} />
      )}

      {/* ======================================================== */}
      {/* QUICK ACCESSIBLE VIEW SWITCHER DOCK (FAB) */}
      {/* ======================================================== */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className="flex flex-col items-end gap-2">
          {/* Collapsible Switcher Menu */}
          {isSwitcherOpen && (
            <div className="bg-[#160f11]/95 backdrop-blur-md border border-wine-900/40 p-3 rounded-2xl shadow-2xl flex flex-col gap-2 min-w-[200px] animate-fade-in text-stone-200">
              <div className="text-[10px] font-mono font-bold tracking-widest text-gold-400 px-2 py-1 border-b border-wine-950">
                SATELLITE SWITCHER
              </div>
              
              <button
                id="fab-switch-dashboard"
                onClick={() => {
                  handleViewChange('dashboard');
                  setIsSwitcherOpen(false);
                }}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${
                  activeView === 'dashboard' 
                    ? 'bg-wine-900/60 text-gold-300 font-semibold border border-wine-800/30' 
                    : 'hover:bg-[#201517] text-stone-300'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>จอกลางนำเสนอ (Dashboard)</span>
              </button>

              <button
                id="fab-switch-bidder"
                onClick={() => {
                  handleViewChange('bidder');
                  setIsSwitcherOpen(false);
                }}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${
                  activeView === 'bidder' 
                    ? 'bg-wine-900/60 text-gold-300 font-semibold border border-wine-800/30' 
                    : 'hover:bg-[#201517] text-stone-300'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>หน้าจอมือถือ (Bidder Portal)</span>
              </button>

              <button
                id="fab-switch-admin"
                onClick={() => {
                  handleViewChange('admin');
                  setIsSwitcherOpen(false);
                }}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs rounded-xl transition-all cursor-pointer ${
                  activeView === 'admin' 
                    ? 'bg-wine-900/60 text-gold-300 font-semibold border border-wine-800/30' 
                    : 'hover:bg-[#201517] text-stone-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>ส่วนแอดมิน (Admin Panel)</span>
              </button>
            </div>
          )}

          {/* Main Floating Trigger Button */}
          <button
            id="fab-trigger-menu"
            onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
            className="w-12 h-12 bg-gradient-to-br from-wine-800 to-wine-950 text-gold-300 hover:text-white rounded-full flex items-center justify-center shadow-2xl border border-wine-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="สลับหน้าจอทดสอบ"
          >
            {isSwitcherOpen ? (
              <ChevronDown className="w-6 h-6" />
            ) : (
              <div className="relative">
                <Layers className="w-5 h-5 animate-pulse" />
                <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
