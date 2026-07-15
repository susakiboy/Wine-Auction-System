/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WineItem, Bidder, BidRecord, AppView } from '../types';
import { 
  db, 
  doc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch,
  onSnapshot,
  deleteDoc,
  updateDoc
} from '../lib/firebase';
import { 
  ShieldCheck, 
  Settings, 
  RotateCcw, 
  Users, 
  Save, 
  Wine, 
  Image, 
  DollarSign, 
  Layers, 
  Sparkles,
  Tv,
  Smartphone,
  Check,
  Edit,
  Trash2,
  X
} from 'lucide-react';

interface AdminViewProps {
  wine: WineItem | null;
  bids: BidRecord[];
  onViewChange: (view: AppView) => void;
}

// Luxurious premium presets to easily configure with one click
const WINE_PRESETS = [
  {
    name: "Château Margaux Grand Cru 2015",
    startingPrice: 38000,
    imageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=600",
    steps: [500, 1000, 5000, 10000]
  },
  {
    name: "Dom Pérignon Brut Vintage Rose",
    startingPrice: 15500,
    imageUrl: "https://images.unsplash.com/photo-1594498653385-d5172b5357ef?auto=format&fit=crop&q=80&w=600",
    steps: [200, 500, 1000, 2000]
  },
  {
    name: "Romanée-Conti Grand Cru 2010",
    startingPrice: 185000,
    imageUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&q=80&w=600",
    steps: [1000, 5000, 10000, 20000]
  },
  {
    name: "Penfolds Grange Hermitage Shiraz",
    startingPrice: 32000,
    imageUrl: "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&q=80&w=600",
    steps: [500, 1000, 2000, 5000]
  }
];

export default function AdminView({ wine, bids, onViewChange }: AdminViewProps) {
  // Input fields state
  const [wineName, setWineName] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [startingPrice, setStartingPrice] = useState<number>(5000);
  const [step1, setStep1] = useState<number>(500);
  const [step2, setStep2] = useState<number>(1000);
  const [step3, setStep3] = useState<number>(5000);
  const [step4, setStep4] = useState<number>(10000);

  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Bidder Edit and Delete State
  const [editingBidder, setEditingBidder] = useState<Bidder | null>(null);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');

  const startEditBidder = (bidder: Bidder) => {
    setEditingBidder(bidder);
    setEditFirstName(bidder.firstName);
    setEditLastName(bidder.lastName);
    setEditPhone(bidder.phone);
  };

  const handleUpdateBidder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBidder) return;

    if (!editFirstName.trim() || !editLastName.trim() || !editPhone.trim()) {
      triggerStatus('กรุณากรอกข้อมูลให้ครบถ้วน', true);
      return;
    }

    try {
      const bidderRef = doc(db, 'bidders', editingBidder.id);
      const updatedBidder: Bidder = {
        ...editingBidder,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phone: editPhone.trim()
      };

      await setDoc(bidderRef, updatedBidder);

      // If this bidder was the highest bidder, we should also update the highestBidderName in active_wine
      if (wine && wine.highestBidderId === editingBidder.id) {
        const updatedWine: WineItem = {
          ...wine,
          highestBidderName: `${editFirstName.trim()} ${editLastName.trim().charAt(0)}.`,
          updatedAt: Date.now()
        };
        await setDoc(doc(db, 'auctions', 'active_wine'), updatedWine);
      }

      triggerStatus('แก้ไขข้อมูลผู้ลงทะเบียนเรียบร้อยแล้ว!', false);
      setEditingBidder(null);
    } catch (err: any) {
      console.error(err);
      triggerStatus('เกิดข้อผิดพลาดในการแก้ไขข้อมูล', true);
    }
  };

  const handleDeleteBidder = async (bidderId: string) => {
    if (!window.confirm(`🚨 คุณมั่นใจหรือไม่ที่จะลบผู้ลงทะเบียนรหัส ${bidderId} ออกจากระบบ?`)) {
      return;
    }

    try {
      // 1. Delete bidder from Firestore
      await deleteDoc(doc(db, 'bidders', bidderId));

      // 2. If the deleted bidder is currently the highest bidder on the active wine, reset the wine's highest bidder
      if (wine && wine.highestBidderId === bidderId) {
        const updatedWine: WineItem = {
          ...wine,
          highestBidderId: null,
          highestBidderName: null,
          updatedAt: Date.now()
        };
        await setDoc(doc(db, 'auctions', 'active_wine'), updatedWine);
      }

      triggerStatus(`ลบผู้ลงทะเบียนรหัส ${bidderId} เรียบร้อยแล้ว`, false);
    } catch (err: any) {
      console.error(err);
      triggerStatus('เกิดข้อผิดพลาดในการลบผู้ลงทะเบียน', true);
    }
  };

  // Load pre-existing configuration into form fields
  useEffect(() => {
    if (wine) {
      setWineName(wine.name);
      setImageUrl(wine.imageUrl);
      setStartingPrice(wine.startingPrice);
      if (wine.bidIncrementSteps.length >= 4) {
        setStep1(wine.bidIncrementSteps[0]);
        setStep2(wine.bidIncrementSteps[1]);
        setStep3(wine.bidIncrementSteps[2]);
        setStep4(wine.bidIncrementSteps[3]);
      }
    }
  }, [wine]);

  // Read registered bidders list from Firestore in real-time
  useEffect(() => {
    const q = collection(db, 'bidders');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Bidder[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data() } as Bidder);
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      setBidders(list);
    });
    return () => unsubscribe();
  }, []);

  const triggerStatus = (text: string, error: boolean = false) => {
    setStatusMessage({ text, error });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Apply a wine preset to the admin form fields
  const applyPreset = (preset: typeof WINE_PRESETS[0]) => {
    setWineName(preset.name);
    setStartingPrice(preset.startingPrice);
    setImageUrl(preset.imageUrl);
    if (preset.steps.length >= 4) {
      setStep1(preset.steps[0]);
      setStep2(preset.steps[1]);
      setStep3(preset.steps[2]);
      setStep4(preset.steps[3]);
    }
    triggerStatus(`โหลดข้อมูลเทมเพลต "${preset.name}" ลงฟอร์มเรียบร้อย!`, false);
  };

  // Save changes and start/reset the wine auction item
  const handleSaveAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wineName.trim()) {
      triggerStatus('กรุณากรอกชื่อไวน์ให้ถูกต้อง', true);
      return;
    }
    setIsSaving(true);

    try {
      // Build updated wine document
      const updatedWine: WineItem = {
        id: 'active_wine',
        name: wineName.trim(),
        imageUrl: imageUrl.trim(),
        startingPrice: startingPrice,
        currentBid: startingPrice, // Reset current bid back to baseline
        highestBidderId: null,
        highestBidderName: null,
        bidIncrementSteps: [step1, step2, step3, step4],
        status: 'active',
        updatedAt: Date.now()
      };

      // Set new wine item to Firestore document path auctions/active_wine
      await setDoc(doc(db, 'auctions', 'active_wine'), updatedWine);

      // Wipe current bidding logs so the history resets for the new wine lot
      const bidsCollection = collection(db, 'bids');
      const bidSnap = await getDocs(bidsCollection);
      const batch = writeBatch(db);
      
      bidSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      triggerStatus('บันทึกและเริ่มประมูลรายการใหม่เรียบร้อยแล้ว!', false);

    } catch (err: any) {
      console.error(err);
      triggerStatus('เกิดข้อผิดพลาดในการตั้งค่าระบบประมูล', true);
    } finally {
      setIsSaving(false);
    }
  };

  // Atomic auction reset (resets the current bid of current wine to its starting price, wipes bid log)
  const handleResetAuction = async () => {
    if (!wine) {
      triggerStatus('ไม่มีรอบประมูลให้รีเซ็ต', true);
      return;
    }

    if (!window.confirm('🚨 คุณมั่นใจหรือไม่ที่จะ "รีเซ็ตราคาและประวัติประมูล" ของไวน์ล็อตปัจจุบันทั้งหมดกลับสู่ค่าเริ่มต้น?')) {
      return;
    }

    setIsSaving(true);
    try {
      const resetWine: WineItem = {
        ...wine,
        currentBid: wine.startingPrice,
        highestBidderId: null,
        highestBidderName: null,
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'auctions', 'active_wine'), resetWine);

      // Clean up the bids logs collection
      const bidsCollection = collection(db, 'bids');
      const bidSnap = await getDocs(bidsCollection);
      const batch = writeBatch(db);
      bidSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      triggerStatus('รีเซ็ตราคาประมูลล็อตปัจจุบันเรียบร้อยแล้ว!', false);
    } catch (err: any) {
      console.error(err);
      triggerStatus('รีเซ็ตข้อมูลผิดพลาด', true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d090a] text-stone-100 font-sans flex flex-col justify-between overflow-x-hidden relative">
      <div className="absolute top-0 right-1/4 w-[450px] h-[450px] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />
      
      {/* Header bar */}
      <header className="border-b border-gold-400/20 bg-[#0a0a0a]/95 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border-2 border-gold-400 rotate-45 flex items-center justify-center shrink-0">
              <div className="w-6 h-6 bg-wine-700 -rotate-45" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-serif tracking-[0.2em] text-gold-400 uppercase leading-none font-medium">
                VINTAGE RESERVE
              </h1>
              <p className="text-[9px] text-stone-400 font-mono tracking-widest uppercase mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
                Admin control center
              </p>
            </div>
          </div>

          {/* Quick View Switches */}
          <div className="flex items-center gap-2">
            <button
              id="btn-admin-switch-dashboard"
              onClick={() => onViewChange('dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#202020] border border-gold-400/10 text-stone-300 hover:text-white text-xs cursor-pointer transition-all font-mono tracking-wider uppercase text-[11px]"
            >
              <Tv className="w-4 h-4 text-gold-400" />
              <span>เปิดจอแสดงผลหลัก</span>
            </button>
            <button
              id="btn-admin-switch-bidder"
              onClick={() => onViewChange('bidder')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#202020] border border-gold-400/10 text-stone-300 hover:text-white text-xs cursor-pointer transition-all font-mono tracking-wider uppercase text-[11px]"
            >
              <Smartphone className="w-4 h-4 text-gold-400" />
              <span>เปิดหน้าจอมือถือ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Content Area */}
      <main className="flex-grow p-6 lg:p-8 max-w-7xl mx-auto w-full z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Wine Lot Config Form (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0a0a0a] rounded-3xl border border-gold-400/20 p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-gold-400/10 pb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gold-400" />
              <h2 className="text-lg font-serif font-medium text-stone-100">ตั้งค่าไวน์ล็อตประมูล</h2>
            </div>
            <span className="text-[10px] bg-wine-900/40 text-gold-400 px-3 py-1 rounded-full border border-wine-800/40 font-mono uppercase tracking-wider">
              {wine ? 'LOT ACTIVE' : 'NO ACTIVE LOT'}
            </span>
          </div>

          {/* Preset Buttons Board */}
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-stone-400 mb-2 font-mono">
              ⚡️ PRESET SAMPLES (คลิกเพื่อดึงข้อมูลไวน์ล็อตจำลองแบบรวดเร็ว)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WINE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  id={`btn-preset-${idx}`}
                  onClick={() => applyPreset(p)}
                  className="p-2 text-[11px] bg-[#141414] hover:bg-wine-900/20 border border-gold-400/10 rounded-xl text-stone-300 hover:text-gold-400 text-left transition-colors font-sans truncate cursor-pointer"
                >
                  <span className="font-semibold block text-white truncate mb-0.5">{p.name.split(' ')[0]}</span>
                  <span className="text-stone-400">฿{p.startingPrice.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>

          {statusMessage && (
            <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
              statusMessage.error 
                ? 'bg-[#291316] border-rose-500/30 text-rose-200' 
                : 'bg-[#142318] border-emerald-500/30 text-emerald-200'
            }`}>
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveAuction} className="space-y-4">
            {/* Wine Name */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">ชื่อขวดไวน์ / แบรนด์ (Wine Name)</label>
              <div className="relative">
                <Wine className="w-4 h-4 text-stone-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  id="admin-wine-name"
                  required
                  placeholder="เช่น Château Margaux Grand Cru 2015"
                  value={wineName}
                  onChange={(e) => setWineName(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Starting Price */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">ราคากลางตั้งต้น (฿ Starting Price)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-stone-500 absolute left-3 top-3.5" />
                  <input
                    type="number"
                    id="admin-starting-price"
                    required
                    min="1"
                    placeholder="5000"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">รูปภาพลิงก์สินค้า (Wine Image URL)</label>
                <div className="relative">
                  <Image className="w-4 h-4 text-stone-500 absolute left-3 top-3.5" />
                  <input
                    type="url"
                    id="admin-image-url"
                    required
                    placeholder="https://images.unsplash.com/..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Step Increments */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-gold-400" />
                <span>กำหนดสเต็ปปุ่มกดราคา (Bid Increase Steps)</span>
              </label>
              
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <span className="block text-[9px] text-stone-500 mb-1 font-mono tracking-wider">STEP 1</span>
                  <input
                    type="number"
                    id="admin-step-1"
                    required
                    min="1"
                    value={step1}
                    onChange={(e) => setStep1(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-lg p-2 text-center text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono"
                  />
                </div>
                <div>
                  <span className="block text-[9px] text-stone-500 mb-1 font-mono tracking-wider">STEP 2</span>
                  <input
                    type="number"
                    id="admin-step-2"
                    required
                    min="1"
                    value={step2}
                    onChange={(e) => setStep2(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-lg p-2 text-center text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono"
                  />
                </div>
                <div>
                  <span className="block text-[9px] text-stone-500 mb-1 font-mono tracking-wider">STEP 3</span>
                  <input
                    type="number"
                    id="admin-step-3"
                    required
                    min="1"
                    value={step3}
                    onChange={(e) => setStep3(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-lg p-2 text-center text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono"
                  />
                </div>
                <div>
                  <span className="block text-[9px] text-stone-500 mb-1 font-mono tracking-wider">STEP 4</span>
                  <input
                    type="number"
                    id="admin-step-4"
                    required
                    min="1"
                    value={step4}
                    onChange={(e) => setStep4(Number(e.target.value))}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-lg p-2 text-center text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 border-t border-gold-400/10 flex flex-wrap gap-4 items-center justify-between">
              <button
                type="button"
                id="btn-reset-auction-data"
                disabled={isSaving || !wine}
                onClick={handleResetAuction}
                className="flex items-center gap-1.5 py-2.5 px-4 bg-transparent hover:bg-wine-950/40 border border-wine-800/40 hover:border-wine-700/60 disabled:opacity-40 rounded-xl text-stone-300 hover:text-rose-400 text-xs font-semibold cursor-pointer transition-all font-mono uppercase tracking-wider"
              >
                <RotateCcw className="w-4 h-4 text-wine-500" />
                <span>รีเซ็ตราคาและประวัติของล็อตเดิม</span>
              </button>

              <button
                type="submit"
                id="btn-save-auction-setup"
                disabled={isSaving}
                className="flex items-center gap-2 py-2.5 px-6 bg-gradient-to-r from-wine-800 via-wine-900 to-wine-950 hover:from-wine-700 hover:to-wine-900 disabled:opacity-50 rounded-xl text-gold-200 text-xs font-mono uppercase tracking-wider cursor-pointer border border-gold-400/20 shadow-lg hover:scale-[1.01] transition-all"
              >
                <Save className="w-4 h-4 text-gold-400" />
                <span>บันทึกและเริ่มประมูลรายการใหม่</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Registered Bidders Listing (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0a0a0a] rounded-3xl border border-gold-400/20 p-6 shadow-2xl flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between border-b border-gold-400/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-400" />
              <h2 className="text-lg font-serif font-medium text-stone-100">ผู้ลงทะเบียนเข้าร่วม ({bidders.length})</h2>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto space-y-2.5 max-h-[420px] pr-1">
            {bidders.length === 0 ? (
              <div className="h-full py-20 text-center text-stone-500 flex flex-col items-center justify-center">
                <Users className="w-10 h-10 opacity-25 mb-2" />
                <p className="text-xs font-light">ยังไม่มีผู้เข้าร่วมลงทะเบียน</p>
                <p className="text-[10px] text-stone-600 max-w-xs mt-1">
                  เมื่อผู้ใช้สแกน QR Code และกรอกแบบฟอร์ม รายชื่อจะปรากฏตรงนี้แบบเรียลไทม์
                </p>
              </div>
            ) : (
              bidders.map((b) => {
                // Check if this bidder has placed any bids
                const hasBid = bids.some(log => log.bidderId === b.id);
                return (
                  <div 
                    key={b.id}
                    className="p-3 bg-[#141414]/60 hover:bg-[#1f1f1f]/60 border border-gold-400/5 rounded-xl flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1b1214] border border-gold-400/20 flex items-center justify-center font-mono text-xs font-bold text-gold-400">
                        {b.id}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-stone-200">
                          {b.firstName} {b.lastName}
                        </div>
                        <div className="text-xs text-stone-500 font-mono">
                          โทร: {b.phone}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1.5">
                      {hasBid ? (
                        <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                          ร่วมเคาะแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] bg-stone-900/80 text-stone-500 border border-stone-800/40 px-2 py-0.5 rounded-full font-mono">
                          ยังไม่เคาะ
                        </span>
                      )}
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditBidder(b)}
                          className="p-1 text-stone-400 hover:text-gold-400 hover:bg-gold-400/10 rounded-md transition-colors cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBidder(b.id)}
                          className="p-1 text-stone-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-colors cursor-pointer"
                          title="ลบผู้ลงทะเบียน"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>

      {/* Bidder Edit Modal */}
      {editingBidder && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#0c0c0c] border border-gold-400/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative space-y-6">
            <button
              type="button"
              onClick={() => setEditingBidder(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 hover:bg-stone-900 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-gold-400/10 pb-3">
              <Users className="w-5 h-5 text-gold-400" />
              <h3 className="text-lg font-serif font-medium text-stone-100">
                แก้ไขข้อมูลผู้ลงทะเบียน (ID: {editingBidder.id})
              </h3>
            </div>

            <form onSubmit={handleUpdateBidder} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">
                  ชื่อจริง (First Name)
                </label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 px-4 text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">
                  นามสกุล (Last Name)
                </label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 px-4 text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">
                  เบอร์โทรศัพท์ (Phone)
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 px-4 text-sm text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono"
                  required
                />
              </div>

              <div className="pt-4 border-t border-gold-400/10 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingBidder(null)}
                  className="py-2.5 px-5 bg-[#141414] hover:bg-[#202020] border border-gold-400/10 rounded-xl text-stone-400 hover:text-white text-xs font-mono uppercase tracking-wider cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-gradient-to-r from-wine-800 via-wine-900 to-wine-950 hover:from-wine-700 hover:to-wine-900 rounded-xl text-gold-200 text-xs font-mono uppercase tracking-wider cursor-pointer border border-gold-400/20 shadow-lg transition-all"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer info */}
      <footer className="border-t border-gold-400/10 bg-[#0a0a0a] py-6 px-6 text-center text-xs text-stone-500 font-mono">
        © 2026 Wine Auction Platform Admin Suite • Live Firestore Synced
      </footer>
    </div>
  );
}
