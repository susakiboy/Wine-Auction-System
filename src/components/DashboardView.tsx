/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WineItem, BidRecord, AppView, CompletedLot, Bidder } from '../types';
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
  FileSpreadsheet,
  Maximize2,
  X,
  Timer,
  Users,
  DollarSign
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
  const [isQrFullscreen, setIsQrFullscreen] = useState<boolean>(false);
  const [isHistoryFullscreen, setIsHistoryFullscreen] = useState<boolean>(false);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [completedLots, setCompletedLots] = useState<CompletedLot[]>([]);

  // Read registered bidders list from Firestore in real-time
  useEffect(() => {
    const q = collection(db, 'bidders');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Bidder[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data() } as Bidder);
      });
      setBidders(list);
    }, (error) => {
      console.error("Error listening to bidders in DashboardView: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Read completed lots list from Firestore in real-time
  useEffect(() => {
    const q = collection(db, 'completed_lots');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CompletedLot[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data() } as CompletedLot);
      });
      setCompletedLots(list);
    }, (error) => {
      console.error("Error listening to completed_lots in DashboardView: ", error);
    });
    return () => unsubscribe();
  }, []);

  // Calculate total funds raised from all completed lots + current lot's current bid (if there are bids on the current lot)
  const totalCompletedFunds = completedLots.reduce((sum, lot) => sum + (lot.finalPrice || 0), 0);
  const currentLotFunds = (wine && bids.length > 0) ? wine.currentBid : 0;
  const accumulatedFunds = totalCompletedFunds + currentLotFunds;

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

  const [timeLeft, setTimeLeft] = useState<number>(120);

  useEffect(() => {
    if (!wine) return;
    if (wine.timerStatus === 'running' && wine.timerEndsAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.round((wine.timerEndsAt! - Date.now()) / 1000));
        setTimeLeft(remaining);
      }, 1000);

      const initial = Math.max(0, Math.round((wine.timerEndsAt - Date.now()) / 1000));
      setTimeLeft(initial);

      return () => clearInterval(interval);
    } else if (wine.timerStatus === 'paused') {
      setTimeLeft(wine.timerDuration || 120);
    } else {
      setTimeLeft(wine.timerDuration || 120);
    }
  }, [wine?.timerStatus, wine?.timerEndsAt, wine?.timerDuration, wine?.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
            {wine?.logoUrl ? (
              <img 
                src={wine.logoUrl} 
                alt="Logo" 
                className="h-10 w-auto object-contain shrink-0" 
                onError={(e) => { 
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=100";
                }} 
              />
            ) : (
              <div className="w-10 h-10 border-2 border-gold-400 rotate-45 flex items-center justify-center shrink-0">
                <div className="w-6 h-6 bg-wine-700 -rotate-45" />
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-serif tracking-[0.2em] text-gold-400 uppercase leading-none font-medium">
                {wine?.headerTitle || 'VINTAGE RESERVE'}
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
        
        {!wine ? (
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
              <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-gold-400/20 shadow-xl flex flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-wine-950/60 border border-gold-400/30 mb-4 shadow-inner">
                  <QrCode className="w-8 h-8 text-gold-400" />
                </div>
                <h4 className="text-[10px] font-mono tracking-[0.2em] text-gold-400 uppercase mb-2">
                  SCAN TO BID LIVE
                </h4>
                <p className="text-xs text-stone-400 mb-5 max-w-xs font-sans leading-relaxed">
                  กดปุ่มด้านล่างเพื่อแสดงภาพคิวอาร์โค้ดขนาดใหญ่บนหน้าจอนำเสนอ สำหรับให้ผู้เข้าร่วมงานสแกนลงทะเบียนเคาะราคา
                </p>
                
                {/* Fullscreen Trigger Button */}
                <button
                  type="button"
                  id="btn-dashboard-fullscreen-qr"
                  onClick={() => setIsQrFullscreen(true)}
                  className="w-full py-4 px-6 bg-gradient-to-r from-wine-900 to-wine-950 hover:from-wine-800 hover:to-wine-900 border border-gold-400/20 hover:border-gold-400/40 text-gold-200 hover:text-white rounded-2xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center gap-2"
                >
                  <Maximize2 className="w-4 h-4 text-gold-400 animate-pulse" />
                  <span className="font-sans">แสดงคิวอาร์โค้ดสำหรับสแกน (Show QR Code)</span>
                </button>
                
                {/* Direct Link Info */}
                <div className="mt-4 text-[10px] text-stone-500 font-mono select-all truncate max-w-full hover:text-stone-300 transition-colors">
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
                    <div className="flex items-center justify-center gap-4">
                      <div className="px-5 py-2.5 bg-gradient-to-r from-gold-400 via-amber-500 to-gold-400 border border-gold-300 rounded-xl flex items-center justify-center font-mono text-stone-950 text-xl font-black shadow-xl tracking-wider select-all">
                        {wine.highestBidderId}
                      </div>
                      <div className="text-left">
                        <div className="text-base font-bold text-stone-100">
                          {wine.highestBidderName || 'ไม่ระบุชื่อ'}
                        </div>
                        <div className="text-xs text-gold-400 font-mono font-semibold">
                          ผู้เสนอราคาสูงสุดล่าสุด
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

                {/* Live Status & Countdown Display */}
                {wine.status === 'active' ? (
                  <div className="mt-6 space-y-4">
                    {wine.timerStatus && wine.timerStatus !== 'idle' ? (
                      <div className="p-5 bg-[#050505] border border-gold-400/20 rounded-2xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold-400 to-transparent animate-pulse" />
                        
                        <div className="flex items-center gap-2 mb-2">
                          <Timer className={`w-4 h-4 ${wine.timerStatus === 'running' ? 'text-gold-400 animate-pulse' : 'text-stone-400'}`} />
                          <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-gold-300 uppercase">
                            {wine.timerStatus === 'running' ? 'LIVE COUNTDOWN' : 'COUNTDOWN PAUSED'}
                          </span>
                        </div>

                        <div className={`font-mono text-5xl font-black tracking-[0.1em] text-white my-1 drop-shadow-[0_0_15px_rgba(250,204,21,0.2)] ${
                          wine.timerStatus === 'running' && timeLeft <= 10 ? 'text-rose-500 animate-pulse scale-105' : 'text-gold-400'
                        }`}>
                          {formatTime(timeLeft)}
                        </div>

                        <div className="text-[11px] text-stone-400 font-sans mt-2 flex items-center gap-1.5">
                          {wine.timerStatus === 'running' ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              <span>ระบบจับเวลากำลังทำงาน... กรุณาเคาะราคาในเวลาที่กำหนด</span>
                            </>
                          ) : (
                            <span>⏸️ ผู้ดูแลระบบหยุดเวลาชั่วคราว</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <span className="text-xs font-mono font-semibold tracking-wider text-emerald-400">🟢 กำลังเปิดรับยอดราคาประมูลสดแบบเรียลไทม์...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/25 rounded-2xl text-center">
                    <span className="text-[10px] font-mono uppercase text-amber-400 block mb-1">Lot Status</span>
                    <span className="text-xs font-semibold text-amber-300">🔒 ปิดประมูลและบันทึกผลล็อตนี้เสร็จสิ้นแล้ว</span>
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsHistoryFullscreen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] bg-wine-950/60 text-gold-300 hover:text-white hover:bg-wine-900/60 border border-gold-400/20 hover:border-gold-400/50 rounded-lg transition-all cursor-pointer font-mono uppercase tracking-wider"
                      title="แสดงประวัติประมูลเต็มหน้าจอ"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-gold-400" />
                      <span className="font-sans font-medium">เต็มหน้าจอ (Full Screen)</span>
                    </button>
                    <span className="text-[10px] bg-wine-900/40 text-gold-400 font-mono px-2 py-0.5 rounded-full border border-wine-800/40">
                      {bids.length} เคาะ
                    </span>
                  </div>
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
                          <div className={`px-3 py-1.5 rounded-lg flex items-center justify-center font-mono text-xs font-black tracking-wider shadow-md border ${
                            idx === 0 
                              ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-stone-950 border-gold-300' 
                              : 'bg-[#1b1214] border-gold-400/20 text-gold-400'
                          }`}>
                            ID: {b.bidderId}
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

      {/* Immersive Fullscreen QR Code Overlay Modal */}
      {isQrFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in"
          onClick={() => setIsQrFullscreen(false)}
        >
          {/* Main Modal Container */}
          <div 
            className="relative bg-[#0a0a0a] border border-gold-400/20 p-8 md:p-12 rounded-3xl max-w-lg w-full text-center shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsQrFullscreen(false)}
              className="absolute top-4 right-4 p-2.5 bg-[#141414] hover:bg-[#222222] text-stone-400 hover:text-white rounded-full transition-colors cursor-pointer border border-stone-800"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2 mt-4">
              <QrCode className="w-7 h-7 text-gold-400 animate-pulse" />
              <h3 className="text-xl font-serif text-gold-300 font-medium tracking-wide">
                สแกนเข้าร่วมการประมูลสด
              </h3>
            </div>
            
            <p className="text-xs text-stone-400 mb-8 max-w-sm">
              เปิดแอปกล้องหรือแอปสแกนคิวอาร์โค้ดบนมือถือ เพื่อลงทะเบียนและเคาะราคาสดทันที
            </p>

            {/* Immersive Large QR Code Frame */}
            <div className="p-6 bg-[#fbf9ec] rounded-3xl border border-gold-400/40 shadow-2xl flex items-center justify-center max-w-[340px] w-full aspect-square">
              <img 
                src={qrCodeUrl} 
                alt="Registration QR Code Fullscreen" 
                className="w-full h-full object-contain"
              />
            </div>

            {/* Sub-label Link display */}
            <div className="mt-8 w-full text-left">
              <span className="text-[9px] uppercase tracking-widest text-stone-500 font-mono block mb-1.5 text-center">
                Link URL สำหรับเชื่อมต่อ
              </span>
              <div className="text-xs text-stone-300 font-mono select-all bg-[#121212] py-2.5 px-4 rounded-xl border border-stone-900 truncate text-center">
                {mobileUrl}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Immersive Fullscreen History Overlay Modal */}
      {isHistoryFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-[#070505] overflow-y-auto flex flex-col p-6 md:p-10 animate-fade-in"
          onClick={() => setIsHistoryFullscreen(false)}
        >
          {/* Inner Content Container */}
          <div 
            className="w-full max-w-7xl mx-auto flex flex-col flex-grow bg-[#0c0a0b]/90 border border-gold-400/20 rounded-3xl p-6 md:p-10 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gold-400/20 pb-6 mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-wine-950/60 border border-gold-400/30 rounded-2xl">
                  <History className="w-8 h-8 text-gold-400 animate-spin-slow" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-serif text-gold-300 font-bold tracking-wide">
                    ประวัติเสนอราคาแบบเรียลไทม์ (Live Auction Bid History)
                  </h2>
                  <p className="text-xs text-stone-400 font-sans mt-1">
                    แสดงผลสถิติและประวัติการเคาะสู้ราคาทั้งหมดของล็อตประมูลและโครงการระดมทุนในงานแบบสดๆ
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsQrFullscreen(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-wine-950/80 hover:bg-wine-900 border border-gold-400/30 hover:border-gold-400/60 text-gold-300 hover:text-white rounded-2xl font-mono font-bold uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  <QrCode className="w-4 h-4 text-gold-400 animate-pulse" />
                  <span>สแกน QR Code (เต็มหน้าจอ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsHistoryFullscreen(false)}
                  className="flex items-center gap-2 px-5 py-3 bg-[#221013] hover:bg-[#34181d] border border-wine-700/40 hover:border-gold-400/40 text-gold-400 hover:text-white rounded-2xl font-mono font-bold uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  <X className="w-4 h-4 text-gold-400" />
                  <span>ปิดหน้าจอนำเสนอ (Close View)</span>
                </button>
              </div>
            </div>

            {/* Presentation Stats Widgets Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
              {/* Card 1: Current Wine Name */}
              <div className="bg-[#121212] border border-gold-400/10 p-5 rounded-2xl relative overflow-hidden group hover:border-gold-400/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Award className="w-16 h-16 text-gold-400" />
                </div>
                <span className="text-[10px] font-mono tracking-widest text-gold-400 uppercase block mb-1">
                  ล็อตประมูลปัจจุบัน / Active Lot
                </span>
                <h4 className="text-lg font-serif font-bold text-stone-100 line-clamp-1">
                  {wine?.name || 'ไม่มีล็อตประมูล'}
                </h4>
                <p className="text-xs text-stone-400 mt-2 font-mono">
                  สถานะ: <span className={wine?.status === 'active' ? 'text-emerald-400 font-bold' : 'text-amber-500 font-bold'}>
                    {wine?.status === 'active' ? '🟢 กำลังเปิดประมูล' : '🔒 สิ้นสุดประมูล'}
                  </span>
                </p>
              </div>

              {/* Card 2: Live Countdown Timer */}
              <div className={`bg-[#121212] border p-5 rounded-2xl relative overflow-hidden group hover:border-gold-400/30 transition-all ${
                wine?.timerStatus === 'running' && timeLeft <= 10 
                  ? 'border-rose-500/40 bg-rose-950/10' 
                  : 'border-gold-400/10'
              }`}>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Timer className="w-16 h-16 text-gold-400" />
                </div>
                <span className="text-[10px] font-mono tracking-widest text-gold-400 uppercase block mb-1">
                  {wine?.timerStatus === 'running' ? '⏳ เวลาประมูลที่เหลือ' : '⏳ นับถอยหลัง (Timer)'}
                </span>
                {wine?.timerStatus && wine?.timerStatus !== 'idle' ? (
                  <>
                    <h4 className={`text-2xl font-mono font-black ${
                      wine.timerStatus === 'running' && timeLeft <= 10 ? 'text-rose-500 animate-pulse' : 'text-gold-300'
                    }`}>
                      {formatTime(timeLeft)}
                    </h4>
                    <p className="text-xs text-stone-400 mt-2 font-sans">
                      สถานะเวลา: <span className="text-stone-300 font-medium">
                        {wine.timerStatus === 'running' ? 'กำลังนับถอยหลัง' : 'หยุดชั่วคราว'}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="text-lg font-sans font-bold text-stone-400">
                      ยังไม่เปิดระบบเวลา
                    </h4>
                    <p className="text-xs text-stone-500 mt-2 font-sans">
                      กรุณารอผู้ดูแลระบบเริ่มประมูล
                    </p>
                  </>
                )}
              </div>

              {/* Card 3: Total Registered/Active Bidders */}
              <div className="bg-[#121212] border border-gold-400/10 p-5 rounded-2xl relative overflow-hidden group hover:border-gold-400/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Users className="w-16 h-16 text-gold-400" />
                </div>
                <span className="text-[10px] font-mono tracking-widest text-gold-400 uppercase block mb-1">
                  จำนวนผู้เข้าร่วมประมูลทั้งหมด
                </span>
                <h4 className="text-2xl font-mono font-black text-stone-100">
                  {bidders.length} <span className="text-sm font-sans font-normal text-stone-400">ท่าน</span>
                </h4>
                <p className="text-xs text-stone-400 mt-2 font-sans">
                  ผู้เสนอราคาในล็อตนี้แล้ว: <span className="text-gold-400 font-bold font-mono">{new Set(bids.map(b => b.bidderId)).size}</span> ท่าน
                </p>
              </div>

              {/* Card 4: Accumulated Funds */}
              <div className="bg-[#121212] border border-gold-400/10 p-5 rounded-2xl relative overflow-hidden group hover:border-gold-400/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <DollarSign className="w-16 h-16 text-gold-400" />
                </div>
                <span className="text-[10px] font-mono tracking-widest text-gold-400 uppercase block mb-1">
                  ยอดเงินระดมทุนประมูลสะสม
                </span>
                <h4 className="text-2xl font-mono font-black text-gold-400">
                  ฿{accumulatedFunds.toLocaleString('th-TH')}
                </h4>
                <p className="text-xs text-stone-400 mt-2 font-sans">
                  สะสม: ล็อตเก่า ฿{totalCompletedFunds.toLocaleString('th-TH')} + ล็อตนี้ ฿{currentLotFunds.toLocaleString('th-TH')}
                </p>
              </div>

              {/* Card 5: Starting Price / Reference Price */}
              <div className="bg-[#121212] border border-gold-400/10 p-5 rounded-2xl relative overflow-hidden group hover:border-gold-400/30 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingUp className="w-16 h-16 text-gold-400" />
                </div>
                <span className="text-[10px] font-mono tracking-widest text-gold-400 uppercase block mb-1">
                  ราคากลาง / Reference Price
                </span>
                <h4 className="text-2xl font-mono font-black text-stone-200">
                  ฿{(wine?.startingPrice || 0).toLocaleString('th-TH')}
                </h4>
                <p className="text-xs text-stone-400 mt-2 font-sans">
                  ขั้นตอนขยับราคา: ฿{(wine?.bidIncrementSteps?.[0] || 500).toLocaleString('th-TH')}
                </p>
              </div>
            </div>

            {/* Immersive Responsive Presentation Table Container */}
            <div className="flex-grow overflow-x-auto rounded-2xl border border-gold-400/20 bg-[#0a0a0a]/80 shadow-2xl">
              {bids.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-center text-stone-500">
                  <History className="w-12 h-12 opacity-25 mb-4 text-wine-500 animate-bounce" />
                  <p className="text-base font-medium text-stone-400">ยังไม่มีผู้เสนอราคาในล็อตนี้</p>
                  <p className="text-xs text-stone-500 mt-1">ยอดเสนอราคาแรกที่กดส่งเข้ามาจะขึ้นแสดง ณ ตำแหน่งนี้แบบเรียลไทม์</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gold-400/20 text-gold-400 font-mono text-xs tracking-wider uppercase bg-[#140e10]">
                      <th className="py-4.5 px-6 text-center font-sans font-bold">หมายเลข BID (Bid ID)</th>
                      <th className="py-4.5 px-6 font-sans font-bold">ชื่อ-นามสกุล (Full Name)</th>
                      <th className="py-4.5 px-6 text-right font-sans font-bold">ราคากลาง (Reference Price)</th>
                      <th className="py-4.5 px-6 text-right font-sans font-bold">ยอดเสนอราคา (Bid Amount)</th>
                      <th className="py-4.5 px-6 text-center font-sans font-bold">เวลาเสนอราคา (Time)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gold-400/10 font-sans">
                    {bids.map((b, idx) => (
                      <tr 
                        key={b.id || idx}
                        className={`transition-all ${
                          idx === 0 
                            ? 'bg-gradient-to-r from-wine-950/60 to-[#1e070a]/60 border-l-4 border-l-gold-400 font-medium' 
                            : idx % 2 === 0 ? 'bg-[#0f0f0f]/40' : 'bg-transparent'
                        } hover:bg-wine-950/20`}
                      >
                        {/* Bid ID */}
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-block px-3 py-1 font-mono text-sm font-bold rounded-lg border ${
                            idx === 0 
                              ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-stone-950 border-gold-300' 
                              : 'bg-[#1b1214] border-gold-400/20 text-gold-400'
                          }`}>
                            {b.bidderId}
                          </span>
                        </td>

                        {/* Full Name - Absolute full text with no truncation/ellipsis */}
                        <td className="py-4 px-6 text-sm text-stone-100 font-medium tracking-wide break-words whitespace-normal min-w-[250px]">
                          <div className="flex items-center gap-2">
                            <span>{b.bidderName}</span>
                            {idx === 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-gold-400/15 text-gold-300 font-mono font-bold uppercase tracking-wider animate-pulse">
                                Leader
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Starting Price (ราคากลาง) */}
                        <td className="py-4 px-6 text-right font-mono text-sm text-stone-300">
                          ฿{(wine?.startingPrice || 0).toLocaleString('th-TH')}
                        </td>

                        {/* Bid Amount */}
                        <td className="py-4 px-6 text-right">
                          <span className={`font-mono text-base font-bold ${
                            idx === 0 ? 'text-gold-300 text-lg' : 'text-stone-100'
                          }`}>
                            ฿{b.amount.toLocaleString('th-TH')}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="py-4 px-6 text-center font-mono text-xs text-stone-400">
                          {new Date(b.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Table Footer Summary Indicator */}
            <div className="mt-4 flex justify-between items-center text-[11px] text-stone-500 font-mono">
              <div>* ประวัติการเคาะเสนอราคาจะอัปเดตแบบเรียลไทม์ทันทีที่มีการเชื่อมต่อ</div>
              <div className="flex gap-4">
                <span>จำนวนการเสนอราคา: {bids.length} ครั้ง</span>
                <span>•</span>
                <span>จำนวนผู้ลงทะเบียน: {bidders.length} ท่าน</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
