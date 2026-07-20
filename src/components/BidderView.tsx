/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WineItem, BidRecord, Bidder, AppView } from '../types';
import { 
  db, 
  doc, 
  setDoc, 
  getDoc, 
  runTransaction, 
  collection, 
  addDoc 
} from '../lib/firebase';
import { 
  User, 
  Phone, 
  Smartphone, 
  Tv, 
  Sparkles, 
  Award, 
  AlertCircle, 
  TrendingUp, 
  ChevronRight,
  LogOut,
  Plus
} from 'lucide-react';

interface BidderViewProps {
  wine: WineItem | null;
  bids: BidRecord[];
  onViewChange: (view: AppView) => void;
}

export default function BidderView({ wine, bids, onViewChange }: BidderViewProps) {
  // Bidder local login / registration state
  const [currentUser, setCurrentUser] = useState<Bidder | null>(null);
  
  // Form input states
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Toast status message state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Load existing registered user from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('wine_bidder_profile');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (err) {
        localStorage.removeItem('wine_bidder_profile');
      }
    }
  }, []);

  // Show status toasts
  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  };

  // Listen to outbid notification (if current user was outbid)
  useEffect(() => {
    if (!wine || !currentUser) return;
    
    // Check if the highest bid is not our user, but our user is in the bid history
    const userHasBidBefore = bids.some(b => b.bidderId === currentUser.id);
    const userIsCurrentlyLeading = wine.highestBidderId === currentUser.id;

    if (userHasBidBefore && !userIsCurrentlyLeading) {
      triggerToast(`⚠️ มีผู้ประมูลอื่นให้ราคาสูงกว่าคุณแล้ว! (ล่าสุด: ฿${wine.currentBid.toLocaleString('th-TH')})`, 'error');
    }
  }, [wine?.currentBid, wine?.highestBidderId]);

  // Handle new bidder registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setFormError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    if (phone.trim().length < 9) {
      setFormError('เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก');
      return;
    }

    setIsSubmitting(true);

    try {
      // Loop to generate a unique 4-digit Bidder ID
      let uniqueId = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 15) {
        attempts++;
        const randNum = Math.floor(1000 + Math.random() * 9000); // 1000 - 9999
        const idToCheck = randNum.toString();

        // Check in Firestore if bidder already exists
        const bidderRef = doc(db, 'bidders', idToCheck);
        const bidderSnap = await getDoc(bidderRef);

        if (!bidderSnap.exists()) {
          uniqueId = idToCheck;
          isUnique = true;
        }
      }

      if (!uniqueId) {
        // Fallback random timestamp-based digits if random generation failed
        uniqueId = Math.floor(1000 + Math.random() * 9000).toString();
      }

      const newBidder: Bidder = {
        id: uniqueId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        createdAt: Date.now()
      };

      // Save to Firestore
      await setDoc(doc(db, 'bidders', uniqueId), newBidder);

      // Save to localStorage & state
      localStorage.setItem('wine_bidder_profile', JSON.stringify(newBidder));
      setCurrentUser(newBidder);
      triggerToast(`ลงทะเบียนเสร็จสิ้น! หมายเลขผู้ประมูลของคุณคือ ${uniqueId}`, 'success');

    } catch (err: any) {
      console.error(err);
      setFormError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Log out of the mobile bidding client
  const handleLogout = () => {
    if (window.confirm('คุณต้องการออกจากระบบและสลับบัญชีผู้ประมูลใช่หรือไม่?')) {
      localStorage.removeItem('wine_bidder_profile');
      setCurrentUser(null);
    }
  };

  // Perform Live Bid with strict transaction to handle double-clicks & latency
  const handlePlaceBid = async (incrementAmount: number) => {
    if (!wine || !currentUser) return;
    setIsSubmitting(true);

    try {
      const wineRef = doc(db, 'auctions', 'active_wine');

      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(wineRef);
        if (!sfDoc.exists()) {
          throw new Error("ไม่มีข้อมูลการประมูลเปิดอยู่");
        }

        const dbWine = sfDoc.data() as WineItem;
        if (dbWine.status === 'ended') {
          throw new Error("ขออภัย การประมูลล็อตนี้ได้สิ้นสุดลงเรียบร้อยแล้ว");
        }
        const targetBid = dbWine.currentBid + incrementAmount;

        // Transactional safety checks
        if (targetBid <= dbWine.currentBid) {
          throw new Error(`ราคาเคาะประมูลช้าเกินไป! มีผู้เสนอราคา ฿${dbWine.currentBid.toLocaleString('th-TH')} แล้ว`);
        }

        // Apply atomic update to the main wine document
        transaction.update(wineRef, {
          currentBid: targetBid,
          highestBidderId: currentUser.id,
          highestBidderName: `${currentUser.firstName} ${currentUser.lastName.charAt(0)}.`,
          updatedAt: Date.now()
        });

        // Add history log inside transaction using custom doc keys or generate new doc inside transaction
        const bidsCollectionRef = collection(db, 'bids');
        const newBidRecord: BidRecord = {
          id: `bid_${Date.now()}_${currentUser.id}`,
          bidderId: currentUser.id,
          bidderName: `${currentUser.firstName} ${currentUser.lastName.charAt(0)}.`,
          amount: targetBid,
          timestamp: Date.now()
        };
        
        // Write the log directly inside the transactional block (using a specific doc path inside auctions if needed, or transaction.set)
        const newBidDocRef = doc(bidsCollectionRef, newBidRecord.id);
        transaction.set(newBidDocRef, newBidRecord);
      });

      triggerToast(`เคาะราคาสำเร็จ! คุณเป็นผู้นำด้วยราคา ฿${(wine.currentBid + incrementAmount).toLocaleString('th-TH')}`, 'success');

    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'การเคาะราคาขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback default wine image
  const defaultWineImage = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800";

  return (
    <div className="min-h-screen bg-[#0d090a] text-stone-100 font-sans flex flex-col justify-between relative overflow-x-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-xl border shadow-2xl transition-all animate-bounce flex items-center gap-3 ${
          toastMessage.type === 'success' 
            ? 'bg-[#142318] border-emerald-500/50 text-emerald-200' 
            : toastMessage.type === 'error'
            ? 'bg-[#291316] border-rose-500/50 text-rose-200'
            : 'bg-[#1d1b15] border-gold-500/50 text-gold-200'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{toastMessage.text}</p>
        </div>
      )}

      {/* Floating Header */}
      <header className="border-b border-gold-400/20 bg-[#0a0a0a]/95 backdrop-blur-md px-4 py-3.5 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border border-gold-400 rotate-45 flex items-center justify-center shrink-0">
            <div className="w-3.5 h-3.5 bg-wine-700 -rotate-45" />
          </div>
          <h1 className="text-sm font-bold font-serif text-stone-100 tracking-[0.15em] uppercase">
            BIDDER PORTAL
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {localStorage.getItem('scanned_bidder') !== 'true' && (
            <button
              id="btn-switch-dashboard-mobile"
              onClick={() => onViewChange('dashboard')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#141414] text-xs text-stone-300 border border-gold-400/10 hover:bg-[#1e1e1e]"
            >
              <Tv className="w-3.5 h-3.5 text-gold-400" />
              <span className="hidden sm:inline font-mono">จอกลาง</span>
            </button>
          )}
          
          {currentUser && (
            <button
              id="btn-mobile-logout"
              onClick={handleLogout}
              className="p-1.5 rounded-lg bg-wine-950/60 hover:bg-wine-900 border border-wine-800/40 text-stone-400 hover:text-rose-400 transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-grow flex items-center justify-center p-4">
        
        {!currentUser ? (
          /* ======================================================== */
          /* REGISTER FORM VIEW (Mobile First) */
          /* ======================================================== */
          <div className="w-full max-w-md bg-[#0a0a0a] rounded-3xl border border-gold-400/20 p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-wine-700 via-gold-400 to-wine-700" />
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-gold-400/20 flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6 text-gold-400" />
              </div>
              <h2 className="text-xl font-serif font-medium text-stone-100 mb-1">ลงทะเบียนผู้ประมูล</h2>
              <p className="text-xs text-stone-400 font-mono">กรอกข้อมูลส่วนตัวเพื่อขอรับรหัสประมูลผ่านระบบ</p>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-wine-950/40 border border-wine-800/40 text-wine-200 text-xs rounded-xl flex items-center gap-2 font-sans">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-wine-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">ชื่อ (First Name)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    id="reg-first-name"
                    required
                    placeholder="เช่น สมชาย"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 pl-10 pr-4 text-stone-200 text-sm focus:outline-none focus:border-gold-400 transition-colors placeholder:text-stone-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">นามสกุล (Last Name)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    id="reg-last-name"
                    required
                    placeholder="เช่น รักดี"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 pl-10 pr-4 text-stone-200 text-sm focus:outline-none focus:border-gold-400 transition-colors placeholder:text-stone-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-1.5">เบอร์โทรศัพท์ (Phone Number)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
                  <input
                    type="tel"
                    id="reg-phone"
                    required
                    placeholder="เช่น 0812345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#141414] border border-gold-400/10 rounded-xl py-2.5 pl-10 pr-4 text-stone-200 text-sm focus:outline-none focus:border-gold-400 transition-colors placeholder:text-stone-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-registration"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-wine-800 via-wine-900 to-wine-950 hover:bg-[#722f37] disabled:opacity-50 text-gold-200 font-mono tracking-wider uppercase text-xs rounded-xl border border-gold-400/20 shadow-lg hover:scale-[1.01] transition-all cursor-pointer mt-4"
              >
                {isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'ลงทะเบียนและรับรหัสประมูล'}
              </button>
            </form>
          </div>
        ) : (
          /* ======================================================== */
          /* LIVE BIDDING INTERFACE (Mobile First) */
          /* ======================================================== */
          <div className="w-full max-w-md bg-[#0a0a0a] rounded-3xl border border-gold-400/20 p-5 shadow-2xl relative flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-wine-700 via-gold-400 to-wine-700" />
            
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-gold-400/10 pb-3.5 mb-4">
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-1.5 bg-gradient-to-r from-gold-400 via-amber-500 to-gold-400 text-stone-950 font-mono text-sm font-black rounded-xl border border-gold-300 shadow-md shrink-0">
                  {currentUser.id}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-stone-200">{currentUser.firstName} {currentUser.lastName}</h3>
                  <p className="text-[10px] text-gold-400 font-mono font-bold">หมายเลขผู้ประมูล: #{currentUser.id}</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full px-2.5 py-0.5 font-mono">
                Live Synced
              </span>
            </div>

            {!wine ? (
              /* No Active Wine state */
              <div className="text-center py-16">
                <Sparkles className="w-12 h-12 text-stone-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-stone-300 mb-1">ยังไม่มีรอบประมูลเปิดอยู่</h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  กรุณารอผู้ดูแลระบบอัปโหลดรายการไวน์และกดเปิดปุ่มเริ่มการประมูล
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Wine Mini Card */}
                <div className="flex gap-4 bg-[#141414] p-3 rounded-2xl border border-gold-400/10">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-900 flex-shrink-0 border border-gold-400/10">
                    <img 
                      src={wine.imageUrl || defaultWineImage} 
                      alt={wine.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = defaultWineImage;
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="text-left flex flex-col justify-center min-w-0">
                    <span className="text-[9px] text-gold-400 font-mono tracking-wider">ACTIVE LOT</span>
                    <h4 className="text-sm font-serif font-semibold text-stone-100 truncate">{wine.name}</h4>
                    <span className="text-[10px] text-stone-400">ราคากลาง: ฿{wine.startingPrice.toLocaleString('th-TH')}</span>
                  </div>
                </div>

                {/* Big Live Price panel */}
                <div className="bg-[#121212] p-5 rounded-2xl border border-gold-400/20 text-center">
                  <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase">
                    CURRENT BID (ราคาเสนอสูงสุด)
                  </span>
                  <div id="mobile-current-price" className="text-3xl md:text-4xl font-serif font-bold text-white my-1">
                    ฿{wine.currentBid.toLocaleString('th-TH')}
                  </div>
                  
                  {/* Leader notification status */}
                  {wine.highestBidderId === currentUser.id ? (
                    <div className="mt-3 py-1.5 px-3 bg-emerald-950/70 text-emerald-400 text-xs font-medium rounded-xl border border-emerald-500/20 inline-flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      <span>คุณเป็นผู้นำราคาประมูลในขณะนี้!</span>
                    </div>
                  ) : wine.highestBidderId ? (
                    <div className="mt-3 py-1.5 px-3 bg-[#241012] text-rose-300 text-xs font-medium rounded-xl border border-rose-500/20 inline-flex items-center gap-1.5 animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>คุณโดนประมูลข้าม! เคาะเสนอราคาใหม่สู้เลย!</span>
                    </div>
                  ) : (
                    <div className="mt-3 text-stone-400 text-xs font-light font-sans">
                      ยังไม่มีใครเสนอราคา ร่วมประมูลเป็นคนแรก!
                    </div>
                  )}
                </div>

                {/* Incremental bid buttons */}
                {wine.status === 'ended' ? (
                  <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-2 animate-fade-in">
                    <Award className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
                    <h4 className="text-sm font-bold text-amber-300">🔒 การประมูลสำหรับล็อตนี้สิ้นสุดแล้ว</h4>
                    <p className="text-xs text-stone-400">ขอขอบคุณผู้ร่วมประมูลทุกท่าน ทางระบบได้บันทึกรายชื่อผู้ชนะการเสนอราคาเรียบร้อยแล้ว</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <span className="block text-left text-xs font-mono uppercase tracking-wider text-stone-400 pl-1">
                      กดเคาะเสนอราคาเพิ่ม (+Step)
                    </span>
                    
                    <div className="grid grid-cols-2 gap-2.5">
                      {wine.bidIncrementSteps.map((step, idx) => (
                        <button
                          key={idx}
                          id={`btn-bid-step-${step}`}
                          disabled={isSubmitting}
                          onClick={() => handlePlaceBid(step)}
                          className="py-3 px-4 bg-[#181818] hover:bg-[#242424] active:bg-[#1a1315] disabled:opacity-40 rounded-xl border border-gold-400/15 text-stone-100 font-mono text-sm font-semibold transition-all hover:scale-[1.01] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-gold-400" />
                          <span>+{step.toLocaleString('th-TH')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dynamic info reminder */}
                <div className="bg-[#050505] p-3 rounded-xl border border-gold-400/5 text-[10px] text-stone-500 text-left font-mono">
                  💡 ข้อมูลอัปเดตแบบเรียลไทม์ผ่าน Firebase Cloud Sync ในกรณีเคาะราคาในวินาทีเดียวกัน จะนับตามการตอบรับของฐานข้อมูลเป็นสำคัญ
                </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* Small copyright */}
      <footer className="border-t border-wine-900/30 bg-[#0d090a] py-3.5 px-4 text-center text-[10px] text-stone-500 font-mono">
        Wine Auction Mobile Portal • Real-time Firebase Link
      </footer>
    </div>
  );
}
