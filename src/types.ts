/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  wallet_address: string;
  username: string;
  avatar_url: string;
  bio: string;
  x_social?: string;
  github_social?: string;
  telegram_social?: string;
}

export interface FileMetadata {
  id: string;
  uploader: string;
  name: string;
  size: number;
  shelby_ref: string;
  price: number; // in APT
  visibility: 'private' | 'public';
  duration: '7d' | '30d' | '90d' | '365d';
  created_at: string;
  purchase_count?: number;
}

export interface PurchaseRecord {
  id: string;
  file_id: string;
  buyer: string;
  tx_hash: string;
  amount: number; // in APT
  timestamp: string;
}

export interface DashboardStats {
  filesUploadedCount: number;
  totalEarnings: number; // in APT
}

export interface LeaderboardRow {
  wallet_address: string;
  username: string;
  avatar_url: string;
  total_uploads: number;
  total_earnings: number; // in APT; Sourced strictly from secure database state
}

export interface DownloadResponse {
  name: string;
  content_type: string;
  data: string; // Base64 encoding of file content
}
