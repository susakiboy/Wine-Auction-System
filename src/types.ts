/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WineItem {
  id: string;
  name: string;
  imageUrl: string;
  startingPrice: number;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  bidIncrementSteps: number[];
  status: 'active' | 'ended';
  updatedAt: number;
  timerDuration?: number; // duration in seconds
  timerEndsAt?: number | null; // epoch timestamp when the timer expires
  timerStatus?: 'idle' | 'running' | 'paused' | 'ended';
  headerTitle?: string; // custom website header title
  logoUrl?: string; // custom website logo URL
}

export interface Bidder {
  id: string; // 4-digit ID, e.g., "1024"
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: number;
}

export interface BidRecord {
  id: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: number;
}

export interface CompletedLot {
  id: string;
  wineId: string;
  name: string;
  imageUrl: string;
  startingPrice: number;
  finalPrice: number;
  winnerId: string | null;
  winnerName: string | null;
  winnerPhone: string | null;
  endedAt: number;
}

export type AppView = 'dashboard' | 'bidder' | 'admin';
