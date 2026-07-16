/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WineItem, BidRecord, AppView, CompletedLot } from '../types';
import { 
  Tv, 
  QrCode, 
  Award, 
  History, 
  TrendingUp, 
  Clock, 
  Smartphone, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Download,
  Trash2,
  FileSpreadsheet
} from 'lucide-react';
import { 
  db, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  deleteDoc
} from '../lib/firebase';

interface DashboardViewProps {
  wine: WineItem | null;
  bids: BidRecord[];
  onViewChange: (view: AppView) => void;
}

export default function DashboardView({ wine, bids, onViewChange }: DashboardViewProps) {
  const [time, setTime] = useState<string>('');
  const [prevBid, setPrevBid] = useState<number>(0);
  const [pulse, setPulse] = useState<boolean>(false);

  // New states for the active tabs and completed lots history
  const [activeTab, setActiveTab] = useState<'live' | 'winners'>('live');
  const [completedLots, setCompletedLots] = useState<CompletedLot[]>([]);
  const [isEnding, setIsEnding] = useState<boolean>(false);

  // Real-time Firestore Sync for completed lots history
  useEffect(() => {
    const completedQuery = query(collection(db, 'completed_lots'), orderBy('endedAt', 'desc'));
    const unsubscribe = onSnapshot(completedQuery, (snapshot) => {
      const records: CompletedLot[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as CompletedLot);
      });
      setCompletedLots(records);
    }, (error) => {
      console.error("Firestore error listening to completed_lots: ", error);
    });
    return () => unsubscribe();
  }, []);

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
      setActiveTab('winners'); // Automatically switch to the winners list dashboard
    } catch (err: any) {
      console.error("Error closing auction: ", err);
      alert("เกิดข้อผิดพลาดในการปิดประมูล: " + err.message);
    } finally {
      setIsEnding(false);
    }
  };

  const handleDeleteCompletedLot = async (lotId: string) => {
    if (!window.confirm('⚠️ คุณแน่ใจหรือไม่ที่จะลบข้อมูลรายงานผู้ชนะของล็อตนี้? การกระทำนี้ไม่สามารถย้อนคืนได้')) return;
    try {
      await deleteDoc(doc(db, 'completed_lots', lotId));
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

  // Live real-time clock for the main dashboard display
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Trigger pulse effect when highest bid changes
  useEffect(() => {
    if (wine && wine.currentBid > prevBid) {
      if (prevBid > 0) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 800);
        return () => clearTimeout(timer);
      }
      setPrevBid(wine.currentBid);
    }
  }, [wine?.currentBid, prevBid]);

  // Fallback default wine image if none is supplied or loaded
  const defaultWineImage = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800";

  // Compute mobile bidding URL for QR Code
  const mobileUrl = `${window.location.origin}${window.location.pathname}?mode=bid`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileUrl)}&color=72-47-51&bgcolor=251-249-236`;

  return (
    <div className="min-h-screen bg-[#0d090a] text-stone-100 font-sans flex flex-col justify-between overflow-x-hidden relative">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#722f37]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] rounded-full bg-[#b9932b]/5 blur-[100px] pointer-events-none" />

      {/* Header Bar */}
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                Real-time Sync Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Live Clock */}
            <div className="hidden md:flex items-center gap-2 bg-[#121212] px-4 py-2 rounded-lg border border-gold-400/10 font-mono text-sm text-gold-400">
              <Clock className="w-4 h-4 text-wine-500" />
              <span>{time || '00:00:00'}</span>
            </div>

            {/* Quick Switch Controls */}
            <div className="flex gap-2 text-xs">
              <button
                id="btn-switch-bidder"
                onClick={() => onViewChange('bidder')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161616] hover:bg-[#222222] border border-gold-400/10 text-stone-300 hover:text-white transition-all cursor-pointer font-mono tracking-wider text-[11px] uppercase"
              >
                <Smartphone className="w-3.5 h-3.5 text-gold-400" />
                <span>เปิดหน้าจอมือถือ</span>
              </button>
              <button
                id="btn-switch-admin"
                onClick={() => onViewChange('admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#221013] hover:bg-[#34181d] border border-wine-700/30 text-gold-400 hover:text-white transition-all cursor-pointer font-mono tracking-wider text-[11px] uppercase"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>แผงควบคุมแอดมิน</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-grow p-6 lg:p-10 max-w-7xl mx-auto w-full z-10">
        
        {/* Tab Switcher */}
        <div className="flex border-b border-wine-900/20 mb-8 gap-6">
          <button
            id="tab-btn-live"
            onClick={() => setActiveTab('live')}
            className={`pb-3 text-sm font-mono tracking-wider uppercase transition-all relative cursor-pointer flex items-center gap-2 ${
              activeTab === 'live'
                ? 'text-gold-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>🚨 การประมูลสด (Live Auction)</span>
            {activeTab === 'live' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400 rounded-full" />
            )}
          </button>
          <button
            id="tab-btn-winners"
            onClick={() => setActiveTab('winners')}
            className={`pb-3 text-sm font-mono tracking-wider uppercase transition-all relative cursor-pointer flex items-center gap-2 ${
              activeTab === 'winners'
                ? 'text-gold-400 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Award className="w-4 h-4 text-gold-400" />
            <span>🏆 ทำเนียบผู้ชนะแต่ละล็อต (Winners Dashboard)</span>
            {activeTab === 'winners' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400 rounded-full" />
            )}
          </button>
        </div>

        {activeTab === 'winners' ? (
          /* WINNERS DASHBOARD VIEW */
          <div className="space-y-8 animate-fade-in">
            {/* Stats Summary Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0b0708] border border-gold-400/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full w-1 bg-wine-700" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-1 font-sans">ล็อตประมูลเสร็จสิ้นทั้งหมด</span>
                <span className="text-3xl font-serif font-bold text-stone-100">{completedLots.length} ล็อต</span>
              </div>
              <div className="bg-[#0b0708] border border-gold-400/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full w-1 bg-gold-500" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-1 font-sans">ยอดเงินระดมทุนประมูลสะสม</span>
                <span className="text-3xl font-serif font-bold text-gold-400">
                  ฿{completedLots.reduce((acc, curr) => acc + curr.finalPrice, 0).toLocaleString('th-TH')}
                </span>
              </div>
              <div className="bg-[#0b0708] border border-gold-400/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full w-1 bg-emerald-700" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-1 font-sans">จำนวนผู้ประมูลที่ชนะรางวัล</span>
                <span className="text-3xl font-serif font-bold text-stone-100 font-mono">
                  {Array.from(new Set(completedLots.map(l => l.winnerId).filter(id => id && id !== 'ไม่มีผู้เสนอราคา'))).length} ท่าน
                </span>
              </div>
            </div>

            {/* Main historical grid or list */}
            <div className="bg-[#0a0a0a] border border-gold-400/10 rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gold-400/10 pb-4">
                <div>
                  <h3 className="text-lg font-serif font-medium text-stone-200">ประวัติผลผู้ชนะการประมูลไวน์ในแต่ละล๊อต</h3>
                  <p className="text-xs text-stone-400 font-sans mt-0.5">รวมรายการไวน์พรีเมียมทั้งหมดที่ปิดการเคาะราคาอย่างเป็นทางการแล้ว</p>
                </div>

                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-500/20 shadow-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>ส่งออกไฟล์รายงานผู้ชนะ (.CSV)</span>
                </button>
              </div>

              {completedLots.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center text-stone-500">
                  <Award className="w-16 h-16 opacity-20 mb-4 text-gold-400 animate-pulse" />
                  <p className="text-sm font-sans">ยังไม่มีรายการล็อตประมูลที่บันทึกผลเสร็จสิ้นในระบบขณะนี้</p>
                  <p className="text-xs text-stone-500 mt-1">เมื่อคุณกด "ปิดประมูล" ในหน้าจอหลัก ข้อมูลล็อตพร้อมผู้ชนะจะมาแสดงผลที่นี่ทันที</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedLots.map((lot) => {
                    const priceDiff = lot.finalPrice - lot.startingPrice;
                    const percentInc = lot.startingPrice > 0 ? ((priceDiff / lot.startingPrice) * 100).toFixed(0) : '0';

                    return (
                      <div 
                        key={lot.id} 
                        className="bg-[#121212]/50 border border-gold-400/5 hover:border-gold-400/15 rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all"
                      >
                        <div className="flex items-center gap-4 w-full lg:w-auto">
                          <div className="w-16 h-16 rounded-xl bg-[#1f1f1f] border border-gold-400/10 overflow-hidden shrink-0 flex items-center justify-center">
                            <img 
                              src={lot.imageUrl || defaultWineImage} 
                              alt={lot.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = defaultWineImage;
                              }}
                            />
                          </div>
                          <div>
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 bg-[#161616]/40 px-5 py-3.5 rounded-xl border border-white/5 w-full lg:w-auto lg:min-w-[400px]">
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
                            <div className="w-10 h-10 rounded-full bg-[#1c1214] border border-gold-400/30 flex items-center justify-center font-mono text-gold-400 text-xs font-bold">
                              {lot.winnerId || '-'}
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
        ) : !wine ? (
          /* Empty / Unconfigured Auction State */
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-[#160f11]/40 border border-wine-900/20 rounded-3xl backdrop-blur-sm">
            <Sparkles className="w-16 h-16 text-gold-400/80 mb-4 animate-bounce" />
            <h2 className="text-2xl font-serif text-gold-300 font-medium mb-2">ยังไม่มีการประมูลที่เปิดอยู่</h2>
            <p className="text-stone-400 max-w-md text-sm mb-6">
              ผู้ดูแลระบบยังไม่ได้ตั้งค่าไวน์หรือเปิดการประมูล กรุณาคลิกที่แผงควบคุมแอดมินเพื่อกำหนดค่าสินค้าและเริ่มประมูล
            </p>
            <button
              id="btn-goto-admin-empty"
              onClick={() => onViewChange('admin')}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-wine-800 to-wine-900 hover:from-wine-700 hover:to-wine-800 text-stone-100 font-medium tracking-wide shadow-lg border border-wine-600/30 hover:scale-105 transition-all cursor-pointer"
            >
              ไปหน้าแอดมินเพื่อเริ่ม
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Side: Wine Bottle Showcase & QR Code (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-gold-400/20 shadow-2xl flex flex-col items-center relative overflow-hidden group">
                <div className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.2em] text-gold-400 font-mono bg-black/60 px-2.5 py-1 rounded border border-gold-400/20 z-10">
                  Lot #{wine.status === 'ended' ? 'Ended' : 'Active'}
                </div>
                
                {/* Product Frame with glow */}
                <div className="w-full aspect-[4/5] rounded-2xl overflow-hidden bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-gold-400/10 relative shadow-inner flex items-center justify-center">
                  <img 
                    src={wine.imageUrl || defaultWineImage} 
                    alt={wine.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = defaultWineImage;
                    }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-black/20" />
                  
                  {/* Float item details on image bottom */}
                  <div className="absolute bottom-5 left-5 right-5 text-left">
                    <span className="text-[10px] font-mono text-gold-400 tracking-[0.2em] block mb-1">PREMIUM SELECTION</span>
                    <h3 className="text-2xl md:text-3xl font-serif text-white leading-tight font-medium tracking-wide">
                      {wine.name}
                    </h3>
                  </div>
                </div>

                {/* Price baseline info */}
                <div className="w-full grid grid-cols-2 gap-4 mt-6 border-t border-gold-400/10 pt-5">
                  <div className="text-left">
                    <span className="text-[10px] uppercase tracking-widest text-stone-400 block mb-1 font-mono">Starting Price</span>
                    <span className="text-xl font-light text-stone-200">
                      ฿{wine.startingPrice.toLocaleString('th-TH')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-stone-400 block mb-1 font-mono">Increment step</span>
                    <span className="text-xl font-light text-gold-400">
                      +฿{(wine.bidIncrementSteps[0] || 500).toLocaleString('th-TH')}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code Board */}
              <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-gold-400/20 shadow-xl flex flex-col items-center text-center">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode className="w-5 h-5 text-gold-400" />
                  <h4 className="text-[10px] font-mono tracking-[0.2em] text-gold-400 uppercase">
                    SCAN TO BID LIVE
                  </h4>
                </div>
                <p className="text-xs text-stone-400 mb-4 max-w-xs font-sans">
                  สแกนเพื่อลงทะเบียนและเข้าร่วมเคาะราคาประมูลแบบเรียลไทม์
                </p>
                
                {/* QR Code Frame */}
                <div className="p-3 bg-[#fbf9ec] rounded-2xl border border-gold-400/30 shadow-lg flex items-center justify-center">
                  <img 
                    src={qrCodeUrl} 
                    alt="Registration QR Code" 
                    className="w-[150px] h-[150px] object-contain"
                  />
                </div>
                
                {/* Direct Link Info */}
                <div className="mt-3 text-[10px] text-stone-500 font-mono select-all truncate max-w-full hover:text-stone-300 transition-colors">
                  {mobileUrl}
                </div>
              </div>
            </div>

            {/* Right Side: Active Auction & Bid History (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Grand Live Bid Panel */}
              <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-gold-400/20 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-wine-700 via-gold-400 to-wine-700" />
                <span className="text-[10px] uppercase tracking-[0.25em] text-gold-400 block mb-2">
                  {wine.status === 'ended' ? 'WINNING BID (CLOSED)' : 'CURRENT HIGHEST BID'}
                </span>
                
                {/* Big pulse price display */}
                <div className="my-6">
                  <div className="text-stone-400 text-xs font-mono tracking-wider">
                    {wine.status === 'ended' ? 'ราคาปิดประมูลสูงสุด' : 'ราคาเสนอสูงสุดล่าสุด'}
                  </div>
                  <div 
                    id="dashboard-current-price"
                    className={`text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight my-2 inline-block transition-all ${
                      pulse ? 'animate-pulse-bid scale-105 text-gold-300' : ''
                    }`}
                  >
                    ฿{wine.currentBid.toLocaleString('th-TH')}
                  </div>
                </div>

                {/* Highest Bidder Card */}
                <div className="mt-6 bg-[#050505] rounded-2xl p-4 border border-gold-400/10">
                  <span className="text-[10px] text-stone-400 tracking-wider uppercase block mb-2 font-mono">
                    {wine.status === 'ended' ? 'Winning Bidder' : 'Current Bidder'}
                  </span>
                  {wine.highestBidderId ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1c1214] border border-gold-400/40 flex items-center justify-center font-mono text-gold-400 font-bold shadow-md">
                        {wine.highestBidderId}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-stone-200">
                          {wine.highestBidderName || 'ไม่ระบุชื่อ'}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          Bidder ID #{wine.highestBidderId}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-stone-400 text-xs py-2 font-light flex items-center justify-center gap-2 font-mono">
                      <Award className="w-4 h-4 text-wine-500" />
                      <span>{wine.status === 'ended' ? 'No Bids Cast' : 'Awaiting First Bid'}</span>
                    </div>
                  )}
                </div>

                {/* End Auction Button */}
                {wine.status === 'active' ? (
                  <button
                    onClick={handleEndAuction}
                    disabled={isEnding}
                    className="mt-6 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-wine-800 to-wine-950 hover:from-wine-700 hover:to-wine-900 border border-gold-400/20 text-gold-200 hover:text-white text-xs font-mono font-bold uppercase tracking-widest cursor-pointer shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4 text-gold-400" />
                    <span>{isEnding ? 'กำลังบันทึกและปิดประมูล...' : 'ปิดประมูลล็อตนี้ (End Auction)'}</span>
                  </button>
                ) : (
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                    <span className="text-[10px] font-mono uppercase text-amber-400 block mb-1">Lot Status</span>
                    <span className="text-xs font-semibold text-amber-300">🔒 ปิดประมูลและบันทึกผลล็อตนี้แล้ว</span>
                  </div>
                )}
              </div>

              {/* Right Side: Bid History Log (Now below live panel) */}
              <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-gold-400/20 shadow-2xl flex flex-col h-[400px]">
                <div className="flex items-center justify-between border-b border-gold-400/10 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-gold-400" />
                    <h3 className="text-xs font-mono tracking-[0.15em] text-stone-300 uppercase">
                      BID HISTORY
                    </h3>
                  </div>
                  <span className="text-[10px] bg-wine-900/40 text-gold-400 font-mono px-2 py-0.5 rounded-full border border-wine-800/40">
                    {bids.length} เคาะ
                  </span>
                </div>

                {/* Timeline list */}
                <div className="flex-grow overflow-y-auto space-y-3 pr-1">
                  {bids.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20 text-stone-500">
                      <TrendingUp className="w-8 h-8 opacity-25 mb-2 text-wine-500" />
                      <p className="text-xs font-light">รอผู้ประมูลเคาะราคาแรก...</p>
                    </div>
                  ) : (
                    bids.map((b, idx) => (
                      <div 
                        key={b.id || idx}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          idx === 0 
                            ? 'bg-gradient-to-r from-wine-950 to-[#120507] border-gold-400/40 shadow-lg scale-[1.02]' 
                            : 'bg-[#141414]/40 border-gold-400/5 hover:bg-[#1f1f1f]/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                            idx === 0 
                              ? 'bg-gold-500 text-stone-900' 
                              : 'bg-wine-900 text-stone-300'
                          }`}>
                            {b.bidderId}
                          </div>
                          <div className="text-left">
                            <span className="text-xs font-semibold block text-stone-200">
                              {b.bidderName}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {new Date(b.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono text-sm font-bold block ${
                            idx === 0 ? 'text-gold-300' : 'text-stone-300'
                          }`}>
                            ฿{b.amount.toLocaleString('th-TH')}
                          </span>
                          {idx === 0 && (
                            <span className="text-[9px] text-wine-400 font-mono font-medium tracking-wider uppercase block">
                              LEADER
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-wine-900/40 bg-[#0d090a] py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-500 font-mono">
          <p>© 2026 Wine Auction System. Developed for premium display & real-time synchronization.</p>
          <div className="flex gap-4">
            <span className="text-wine-500">Firestore Live Synced</span>
            <span>•</span>
            <span className="text-gold-500">Dark Burgundy Edition</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
