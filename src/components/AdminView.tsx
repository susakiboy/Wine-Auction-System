/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WineItem, Bidder, BidRecord, AppView, CompletedLot } from '../types';
import { 
  db, 
  doc, 
  setDoc, 
  getDoc,
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
  X,
  Lock,
  LogOut,
  Award,
  FileSpreadsheet,
  Upload,
  UserPlus
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
  // Admin Login States
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('admin_authenticated') === 'true';
  });
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'Administrator' && password === 'm2k3ddhpsk') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('admin_authenticated', 'true');
      setLoginError('');
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('admin_authenticated');
    setUsername('');
    setPassword('');
  };

  // Input fields state
  const [wineName, setWineName] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [startingPrice, setStartingPrice] = useState<number>(5000);
  const [step1, setStep1] = useState<number>(500);
  const [step2, setStep2] = useState<number>(1000);
  const [step3, setStep3] = useState<number>(5000);
  const [step4, setStep4] = useState<number>(10000);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("ไฟล์รูปภาพมีขนาดใหญ่เกินไป (กรุณาเลือกไฟล์รูปภาพขนาดไม่เกิน 15MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Safe resizing limit to ensure firestore maximum payload limit is never exceeded
        const canvas = window.document.createElement('canvas');
        const MAX_WIDTH = 700;
        const MAX_HEIGHT = 700;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to jpeg with 0.70 quality to be extremely lightweight (usually 25-50KB)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
          setImageUrl(dataUrl);
          triggerStatus('อัปโหลดและบีบอัดรูปภาพสำเร็จ!', false);
        } else {
          // Fallback
          setImageUrl(event.target?.result as string);
          triggerStatus('โหลดรูปภาพสำเร็จ!', false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [completedLots, setCompletedLots] = useState<CompletedLot[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Bidder Edit and Delete State
  const [editingBidder, setEditingBidder] = useState<Bidder | null>(null);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');

  // Manual Bidder Registration State
  const [manualId, setManualId] = useState<string>('');
  const [manualFirstName, setManualFirstName] = useState<string>('');
  const [manualLastName, setManualLastName] = useState<string>('');
  const [manualPhone, setManualPhone] = useState<string>('');
  const [isRegisteringManual, setIsRegisteringManual] = useState<boolean>(false);

  const handleRegisterManualBidder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = manualId.trim();
    const cleanFirstName = manualFirstName.trim();
    const cleanLastName = manualLastName.trim();
    const cleanPhone = manualPhone.trim();

    if (!cleanId || !cleanFirstName || !cleanLastName || !cleanPhone) {
      triggerStatus('กรุณากรอกข้อมูลผู้ประมูลให้ครบถ้วนทุกช่อง (ป้ายผู้ประมูล ชื่อ นามสกุล และเบอร์โทร)', true);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
      triggerStatus('เลขที่ป้ายผู้ประมูลควรเป็นตัวเลขหรือตัวอักษรภาษาอังกฤษเท่านั้น', true);
      return;
    }

    setIsRegisteringManual(true);
    try {
      const bidderRef = doc(db, 'bidders', cleanId);
      const bidderSnap = await getDoc(bidderRef);

      if (bidderSnap.exists()) {
        triggerStatus(`ขออภัย! เลขที่ป้ายผู้ประมูลหมายเลข ${cleanId} นี้ได้รับการลงทะเบียนไว้แล้ว`, true);
        setIsRegisteringManual(false);
        return;
      }

      const newBidder: Bidder = {
        id: cleanId,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        phone: cleanPhone,
        createdAt: Date.now()
      };

      await setDoc(bidderRef, newBidder);
      triggerStatus(`ลงทะเบียนผู้เข้าร่วมหมายเลข ${cleanId} สำเร็จ!`, false);
      
      // Reset manual fields
      setManualId('');
      setManualFirstName('');
      setManualLastName('');
      setManualPhone('');
    } catch (err: any) {
      console.error(err);
      triggerStatus('เกิดข้อผิดพลาดในการลงทะเบียนผู้เข้าร่วม', true);
    } finally {
      setIsRegisteringManual(false);
    }
  };

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

  const handleResetBidders = async () => {
    if (!window.confirm('🚨🚨🚨 คุณต้องการลบ "รายชื่อผู้ลงทะเบียนทั้งหมด" ใช่หรือไม่? ข้อมูลผู้ประมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้!')) {
      return;
    }
    if (!window.confirm('⚠️ ยืนยันอีกครั้ง: คุณมั่นใจจริงๆ หรือไม่ว่าต้องการรีเซ็ตผู้ลงทะเบียนทั้งหมด?')) {
      return;
    }

    try {
      const q = collection(db, 'bidders');
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Also reset highest bidder on active wine
      if (wine && (wine.highestBidderId || wine.highestBidderName)) {
        const updatedWine: WineItem = {
          ...wine,
          highestBidderId: null,
          highestBidderName: null,
          updatedAt: Date.now()
        };
        await setDoc(doc(db, 'auctions', 'active_wine'), updatedWine);
      }

      triggerStatus('รีเซ็ตรายชื่อผู้ลงทะเบียนทั้งหมดสำเร็จแล้ว!', false);
    } catch (err: any) {
      console.error("Error resetting bidders: ", err);
      alert("เกิดข้อผิดพลาดในการรีเซ็ตผู้ลงทะเบียน: " + err.message);
    }
  };

  const handleResetCompletedLots = async () => {
    if (!window.confirm('🚨🚨🚨 คุณต้องการลบ "ประวัติผลผู้ชนะการประมูลทั้งหมด" ใช่หรือไม่? ข้อมูลล็อตที่จบไปแล้วทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้!')) {
      return;
    }
    if (!window.confirm('⚠️ ยืนยันอีกครั้ง: คุณมั่นใจจริงๆ หรือไม่ว่าต้องการรีเซ็ตทำเนียบผู้ชนะทั้งหมด?')) {
      return;
    }

    try {
      const q = collection(db, 'completed_lots');
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      triggerStatus('รีเซ็ตทำเนียบผู้ชนะทั้งหมดสำเร็จแล้ว!', false);
    } catch (err: any) {
      console.error("Error resetting completed lots: ", err);
      alert("เกิดข้อผิดพลาดในการรีเซ็ตผู้ชนะ: " + err.message);
    }
  };

  const [isEnding, setIsEnding] = useState<boolean>(false);

  const handleEndAuction = async () => {
    if (!wine) return;
    if (wine.status === 'ended') {
      alert('การประมูลล็อตนี้ถูกปิดไปแล้ว');
      return;
    }

    const confirmEnd = window.confirm(`🚨 คุณต้องการปิดประมูลล็อต "${wine.name}" ใช่หรือไม่?\nการดำเนินการนี้จะปิดรับยอดราคา และบันทึกประวัติผู้ชนะล็อตทันที`);
    if (!confirmEnd) return;

    setIsEnding(true);
    try {
      // 1. Fetch winner phone number from the bidders collection
      let winnerPhone = null;
      if (wine.highestBidderId) {
        const bidderDoc = await getDoc(doc(db, 'bidders', wine.highestBidderId));
        if (bidderDoc.exists()) {
          winnerPhone = bidderDoc.data().phone;
        }
      }

      // 2. Add document to completed_lots collection
      const completedLotId = `lot_${Date.now()}`;
      const newCompletedLot: CompletedLot = {
        id: completedLotId,
        wineId: wine.id,
        name: wine.name,
        imageUrl: wine.imageUrl || '',
        startingPrice: wine.startingPrice,
        finalPrice: wine.currentBid,
        winnerId: wine.highestBidderId || 'ไม่มีผู้เสนอราคา',
        winnerName: wine.highestBidderName || 'ไม่มีผู้ชนะ',
        winnerPhone: winnerPhone || 'ไม่มีเบอร์โทรศัพท์',
        endedAt: Date.now()
      };

      await setDoc(doc(db, 'completed_lots', completedLotId), newCompletedLot);

      // 3. Mark the active wine as ended
      await setDoc(doc(db, 'auctions', 'active_wine'), {
        ...wine,
        status: 'ended',
        updatedAt: Date.now()
      });

      alert(`🎉 ปิดประมูลและบันทึกผู้ชนะประมูลล็อต "${wine.name}" เรียบร้อยแล้ว!`);
    } catch (err: any) {
      console.error("Error closing auction: ", err);
      alert("เกิดข้อผิดพลาดในการปิดประมูล: " + err.message);
    } finally {
      setIsEnding(false);
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

  // Real-time Firestore Sync for completed lots history in admin
  useEffect(() => {
    const q = collection(db, 'completed_lots');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: CompletedLot[] = [];
      snapshot.forEach((doc) => {
        records.push({ ...doc.data() } as CompletedLot);
      });
      // Sort by endedAt descending to show latest first
      records.sort((a, b) => b.endedAt - a.endedAt);
      setCompletedLots(records);
    }, (error) => {
      console.error("Firestore error listening to completed_lots: ", error);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteCompletedLot = async (lotId: string) => {
    if (!window.confirm('⚠️ คุณแน่ใจหรือไม่ที่จะลบข้อมูลรายงานผู้ชนะของล็อตนี้? การกระทำนี้ไม่สามารถย้อนคืนได้')) return;
    try {
      await deleteDoc(doc(db, 'completed_lots', lotId));
      triggerStatus('ลบรายงานผลสำเร็จลุล่วง', false);
    } catch (err: any) {
      console.error("Error deleting completed lot: ", err);
      alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
    }
  };

  const exportToCSV = () => {
    if (completedLots.length === 0) {
      alert('ไม่มีข้อมูลผู้ชนะการประมูลที่สามารถส่งออกได้');
      return;
    }

    // Define CSV Headers with UTF-8 BOM so MS Excel displays Thai names correctly
    const headers = ['Lot ID', 'Wine Name', 'Starting Price (THB)', 'Winning Price (THB)', 'Winner ID', 'Winner Name', 'Phone Number', 'Completed At'];
    
    const rows = completedLots.map(lot => [
      lot.id,
      `"${lot.name.replace(/"/g, '""')}"`,
      lot.startingPrice,
      lot.finalPrice,
      lot.winnerId || '-',
      `"${(lot.winnerName || '-').replace(/"/g, '""')}"`,
      `"${(lot.winnerPhone || '-').replace(/"/g, '""')}"`,
      `"${new Date(lot.endedAt).toLocaleString('th-TH')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wine_auction_winners_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0d090a] text-stone-100 font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative glowing background elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-wine-900/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-gold-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#0a0a0a] border border-gold-400/20 rounded-3xl p-8 shadow-2xl relative z-10 space-y-8 backdrop-blur-sm">
          {/* Logo Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 border-2 border-gold-400 rotate-45 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-5 h-5 text-gold-400 -rotate-45" />
            </div>
            <h1 className="text-2xl font-serif tracking-[0.2em] text-gold-400 uppercase leading-none font-medium">
              VINTAGE RESERVE
            </h1>
            <p className="text-[10px] text-stone-400 font-mono tracking-widest uppercase">
              ADMINISTRATOR GATEWAY
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase tracking-wider text-stone-300">
                ชื่อผู้ใช้ / Username
              </label>
              <input
                id="admin-login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ระบุชื่อผู้ใช้งานแอดมิน"
                className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all font-sans"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase tracking-wider text-stone-300">
                รหัสผ่าน / Password
              </label>
              <input
                id="admin-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ระบุรหัสผ่านเข้าสู่ระบบ"
                className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all font-sans"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2 animate-fade-in font-sans">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            <button
              id="btn-admin-login-submit"
              type="submit"
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-wine-800 to-wine-950 hover:from-wine-700 hover:to-wine-900 border border-gold-400/20 text-gold-200 hover:text-white text-xs font-mono font-bold uppercase tracking-widest cursor-pointer shadow-lg transition-all"
            >
              เข้าสู่ระบบ / Authentication
            </button>
          </form>

          {/* Quick exit option */}
          <div className="border-t border-white/5 pt-4 text-center">
            <button
              id="btn-admin-login-back"
              onClick={() => onViewChange('dashboard')}
              className="text-xs text-stone-400 hover:text-gold-400 transition-colors font-mono uppercase tracking-wider cursor-pointer"
            >
              ← กลับไปยังหน้าจอแสดงผลหลัก
            </button>
          </div>
        </div>

        {/* Small System Status Stamp */}
        <div className="mt-8 text-center text-[10px] font-mono text-stone-600 tracking-wider">
          SECURED GATEWAY • VINTAGE RESERVE SYSTEM v1.0.4
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2.5">
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
            <button
              id="btn-admin-logout"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a0f11] hover:bg-wine-950/60 border border-rose-500/20 text-rose-300 hover:text-rose-100 text-xs cursor-pointer transition-all font-mono tracking-wider uppercase text-[11px]"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Content Area */}
      <main className="flex-grow p-6 lg:p-8 max-w-7xl mx-auto w-full z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Active Status & Config Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Live Auction Control Panel */}
          {wine && (
            <div className="bg-[#0a0a0a] rounded-3xl border border-wine-900/40 p-6 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-wine-800 via-gold-400 to-wine-800" />
              
              <div className="flex items-center justify-between border-b border-gold-400/10 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-gold-400" />
                  <h2 className="text-md font-serif font-medium text-stone-100">แผงควบคุมสถานะและปิดประมูลสด</h2>
                </div>
                <span className={`text-[9px] font-mono px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  wine.status === 'active' 
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20 animate-pulse' 
                    : 'bg-stone-900/60 text-stone-500 border-stone-800'
                }`}>
                  {wine.status === 'active' ? '🟢 LIVE NOW' : '🔒 ENDED'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#120d0f]/40 p-4 rounded-2xl border border-wine-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#1a1a1a] border border-gold-400/10 overflow-hidden shrink-0 flex items-center justify-center">
                    <img 
                      src={wine.imageUrl || "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=805"} 
                      alt={wine.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=805";
                      }}
                    />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold text-stone-200 line-clamp-1">{wine.name}</h3>
                    <p className="text-xs text-stone-400 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>ราคากลางตั้งต้น: ฿{wine.startingPrice.toLocaleString()}</span>
                      <span className="text-wine-400">•</span>
                      <span>เสนอราคาสูงสุด: <strong className="text-gold-400 font-mono">฿{wine.currentBid.toLocaleString()}</strong></span>
                    </p>
                    {wine.highestBidderId ? (
                      <p className="text-xs text-stone-300 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>ผู้เสนอราคาสูงสุด:</span>
                        <span className="bg-gold-400/20 text-gold-300 font-mono font-black border border-gold-400/30 px-2 py-0.5 rounded text-xs">
                          ID: {wine.highestBidderId}
                        </span>
                        <span className="font-semibold text-white">({wine.highestBidderName})</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-stone-500 mt-0.5">ยังไม่มีผู้เสนอราคา</p>
                    )}
                  </div>
                </div>

                {wine.status === 'active' ? (
                  <button
                    type="button"
                    id="btn-admin-end-auction"
                    disabled={isEnding}
                    onClick={handleEndAuction}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-wine-800 to-wine-950 hover:from-wine-700 hover:to-wine-900 border border-gold-400/20 text-gold-200 hover:text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Award className="w-4 h-4 text-gold-400 animate-pulse" />
                    <span>{isEnding ? 'กำลังปิดประมูล...' : 'ปิดประมูลล็อตนี้'}</span>
                  </button>
                ) : (
                  <div className="w-full sm:w-auto text-center px-4 py-2 bg-stone-900/60 border border-stone-800 text-stone-500 rounded-xl text-xs font-semibold shrink-0">
                    🔒 การประมูลล็อตนี้สิ้นสุดลงแล้ว
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wine Lot Config Form (Card Container) */}
          <div className="bg-[#0a0a0a] rounded-3xl border border-gold-400/20 p-6 shadow-2xl space-y-6">
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

            <div className="grid grid-cols-1 gap-5">
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

              {/* Image Input Selection */}
              <div className="bg-[#0c0c0c] border border-gold-400/10 rounded-2xl p-5 space-y-4">
                <span className="block text-xs font-mono uppercase tracking-wider text-stone-400">รูปภาพสินค้าประจำล็อต (Lot Product Image)</span>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Left: Preview */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center bg-[#141414] rounded-xl border border-gold-400/5 p-2 aspect-square relative group overflow-hidden max-w-[180px] mx-auto md:mx-0 w-full">
                    {imageUrl ? (
                      <>
                        <img 
                          src={imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=805";
                          }}
                        />
                        <button
                          type="button"
                          id="btn-admin-clear-image"
                          onClick={() => setImageUrl('')}
                          className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-rose-400 text-xs font-mono font-bold cursor-pointer"
                        >
                          ลบรูปภาพ (Clear)
                        </button>
                      </>
                    ) : (
                      <div className="text-stone-600 flex flex-col items-center justify-center gap-1.5 p-4 text-center">
                        <Image className="w-8 h-8 opacity-40 text-gold-400" />
                        <span className="text-[10px] font-sans">ไม่มีพรีวิว (No Preview)</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Input Methods */}
                  <div className="md:col-span-8 space-y-3">
                    <div>
                      <span className="block text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-2">เลือกรูปภาพจากเครื่องคอมพิวเตอร์ของคุณ</span>
                      <label className="flex flex-col items-center justify-center gap-3 px-6 py-6 bg-wine-950/20 hover:bg-wine-900/40 border border-dashed border-gold-400/20 hover:border-gold-400/40 text-gold-200 hover:text-white rounded-2xl text-xs font-mono font-medium tracking-wide transition-all cursor-pointer shadow-md w-full">
                        <Upload className="w-6 h-6 text-gold-400 animate-pulse" />
                        <div className="text-center space-y-1">
                          <span className="block text-stone-200 font-sans font-semibold">คลิกเพื่อเลือกไฟล์รูปภาพ</span>
                          <span className="block text-[10px] text-stone-500 font-sans">รองรับไฟล์รูปภาพ PNG, JPG, JPEG (บีบอัดไฟล์โดยอัตโนมัติ)</span>
                        </div>
                        <input
                          type="file"
                          id="admin-file-upload"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
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
      </div>

        {/* Right Side: Registered Bidders Listing (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0a0a0a] rounded-3xl border border-gold-400/20 p-6 shadow-2xl flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between border-b border-gold-400/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gold-400" />
              <h2 className="text-lg font-serif font-medium text-stone-100">ผู้ลงทะเบียนเข้าร่วม ({bidders.length})</h2>
            </div>
            {bidders.length > 0 && (
              <button
                type="button"
                onClick={handleResetBidders}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                title="รีเซ็ตผู้ลงทะเบียนทั้งหมด"
              >
                <RotateCcw className="w-3 h-3 text-rose-400" />
                <span>รีเซ็ตผู้ลงทะเบียน</span>
              </button>
            )}
          </div>

          {/* Manual Bidder Registration Form */}
          <form onSubmit={handleRegisterManualBidder} className="mb-6 p-4 bg-wine-950/15 border border-gold-400/10 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-gold-400/5 pb-2">
              <UserPlus className="w-4 h-4 text-gold-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gold-400">ลงทะเบียนผู้ประมูลด้วยตนเอง</span>
            </div>
            
            <div className="grid grid-cols-12 gap-3">
              {/* Paddle ID / Bidder ID */}
              <div className="col-span-4">
                <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-1">เลขป้ายผู้ประมูล</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น 1024"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-1.5 px-3 text-xs text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono placeholder:text-stone-700"
                />
              </div>
              
              {/* Phone */}
              <div className="col-span-8">
                <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  required
                  placeholder="08xxxxxxxx"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-1.5 px-3 text-xs text-stone-200 focus:outline-none focus:border-gold-400 transition-colors font-mono placeholder:text-stone-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* First name */}
              <div>
                <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-1">ชื่อจริง</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย"
                  value={manualFirstName}
                  onChange={(e) => setManualFirstName(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-1.5 px-3 text-xs text-stone-200 focus:outline-none focus:border-gold-400 transition-colors placeholder:text-stone-700"
                />
              </div>

              {/* Last name */}
              <div>
                <label className="block text-[9px] font-mono text-stone-400 uppercase tracking-wider mb-1">นามสกุล</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น รักดี"
                  value={manualLastName}
                  onChange={(e) => setManualLastName(e.target.value)}
                  className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-1.5 px-3 text-xs text-stone-200 focus:outline-none focus:border-gold-400 transition-colors placeholder:text-stone-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isRegisteringManual}
              className="w-full py-2 px-4 bg-gradient-to-r from-wine-900 to-wine-950 hover:from-wine-800 hover:to-wine-900 disabled:opacity-50 border border-gold-400/20 hover:border-gold-400/40 text-gold-200 hover:text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5 text-gold-400" />
              <span>{isRegisteringManual ? 'กำลังบันทึกข้อมูล...' : 'ลงทะเบียนผู้เข้าร่วม (Register)'}</span>
            </button>
          </form>

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
                      <div className="px-3 py-1.5 bg-gradient-to-b from-[#1b1214] to-black border border-gold-400/30 rounded-xl flex items-center justify-center font-mono text-sm font-black text-gold-400 shadow-md min-w-[54px]">
                        ID: {b.id}
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

        {/* Full Width: Winners Dashboard / Completed Lots History */}
        <div className="lg:col-span-12 space-y-6 mt-8 border-t border-gold-400/10 pt-8">
          <div className="flex items-center gap-2 border-b border-gold-400/10 pb-4">
            <Award className="w-5 h-5 text-gold-400" />
            <h2 className="text-lg font-serif font-medium text-stone-100">🏆 ทำเนียบผู้ชนะแต่ละล็อต (Winners History)</h2>
          </div>

          {/* Stats Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0a0a0a] border border-gold-400/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-1 bg-wine-700" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-1">ล็อตประมูลเสร็จสิ้นทั้งหมด</span>
              <span className="text-3xl font-serif font-bold text-stone-100">{completedLots.length} ล็อต</span>
            </div>
            <div className="bg-[#0a0a0a] border border-gold-400/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-1 bg-gold-500" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-1">ยอดเงินระดมทุนประมูลสะสม</span>
              <span className="text-3xl font-serif font-bold text-gold-400">
                ฿{completedLots.reduce((acc, curr) => acc + curr.finalPrice, 0).toLocaleString('th-TH')}
              </span>
            </div>
            <div className="bg-[#0a0a0a] border border-gold-400/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-1 bg-emerald-700" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-1">จำนวนผู้ประมูลที่ชนะรางวัล</span>
              <span className="text-3xl font-serif font-bold text-stone-100 font-mono">
                {Array.from(new Set(completedLots.map(l => l.winnerId).filter(id => id && id !== 'ไม่มีผู้เสนอราคา'))).length} ท่าน
              </span>
            </div>
          </div>

          {/* Main historical list */}
          <div className="bg-[#0a0a0a] border border-gold-400/20 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gold-400/10 pb-4">
              <div className="text-left">
                <h3 className="text-md font-serif font-medium text-stone-200">ประวัติผลผู้ชนะการประมูลไวน์ในแต่ละล็อต</h3>
                <p className="text-xs text-stone-400 mt-0.5">รวมรายการไวน์พรีเมียมทั้งหมดที่ปิดการเคาะราคาอย่างเป็นทางการแล้ว</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {completedLots.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetCompletedLots}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 shadow-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>รีเซ็ตผู้ชนะทั้งหมด</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#112419] hover:bg-[#183525] text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 shadow-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>ส่งออกไฟล์รายงานผู้ชนะ (.CSV)</span>
                </button>
              </div>
            </div>

            {completedLots.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center text-stone-500">
                <Award className="w-16 h-16 opacity-20 mb-4 text-gold-400 animate-pulse" />
                <p className="text-sm">ยังไม่มีรายการล็อตประมูลที่บันทึกผลเสร็จสิ้นในระบบขณะนี้</p>
                <p className="text-xs text-stone-500 mt-1">เมื่อคุณกด "ปิดประมูล" ในส่วนแผงควบคุมด้านบน ข้อมูลล็อตพร้อมผู้ชนะจะบันทึกมาที่นี่ทันที</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedLots.map((lot) => {
                  const priceDiff = lot.finalPrice - lot.startingPrice;
                  const percentInc = lot.startingPrice > 0 ? ((priceDiff / lot.startingPrice) * 100).toFixed(0) : '0';
                  const defaultWineImg = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800";

                  return (
                    <div 
                      key={lot.id} 
                      className="bg-[#121212]/50 border border-gold-400/5 hover:border-gold-400/15 rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all"
                    >
                      <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="w-16 h-16 rounded-xl bg-[#1f1f1f] border border-gold-400/10 overflow-hidden shrink-0 flex items-center justify-center">
                          <img 
                            src={lot.imageUrl || defaultWineImg} 
                            alt={lot.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = defaultWineImg;
                            }}
                          />
                        </div>
                        <div className="text-left">
                          <span className="text-[9px] font-mono text-gold-400 bg-gold-400/5 border border-gold-400/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            LOT ID: {lot.id.substring(4)}
                          </span>
                          <h4 className="text-base font-serif font-medium text-stone-100 mt-1">{lot.name}</h4>
                          <p className="text-[10px] text-stone-400 font-mono mt-1">
                            เวลาปิดล็อต: {new Date(lot.endedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'medium' })}
                          </p>
                        </div>
                      </div>

                      {/* Financial stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 bg-[#161616]/40 px-5 py-3.5 rounded-xl border border-white/5 w-full lg:w-auto lg:min-w-[400px] text-left">
                        <div>
                          <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block">Starting</span>
                          <span className="text-sm font-semibold text-stone-300">฿{lot.startingPrice.toLocaleString('th-TH')}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-gold-400 uppercase tracking-wider block">Winning Price</span>
                          <span className="text-sm font-semibold text-gold-300">฿{lot.finalPrice.toLocaleString('th-TH')}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider block">Increase</span>
                          <span className="text-sm font-bold text-emerald-400">
                            +{percentInc}% (+฿{priceDiff.toLocaleString('th-TH')})
                          </span>
                        </div>
                      </div>

                      {/* Winner details */}
                      <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-2 bg-gradient-to-r from-gold-400 via-amber-500 to-gold-400 border border-gold-300 rounded-xl flex items-center justify-center font-mono text-stone-950 text-sm font-black shadow-lg min-w-[54px]">
                            ID: {lot.winnerId || '-'}
                          </div>
                          <div className="text-left">
                            <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wider block">Winner info</span>
                            <span className="text-xs font-bold text-stone-200 block">{lot.winnerName}</span>
                            <span className="text-[10px] text-stone-400 font-mono">{lot.winnerPhone}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCompletedLot(lot.id)}
                          className="p-2 text-stone-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-colors cursor-pointer"
                          title="ลบรายงานผลล็อตนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
