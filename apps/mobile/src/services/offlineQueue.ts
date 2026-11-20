import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { sqliteStorage } from './sqliteStorage';

const OFFLINE_QUEUE_KEY = '@mediconnect_offline_emergencies';

export interface OfflineEmergencyRecord {
  localId: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  addressText?: string;
  status: 'PENDING_SYNC';
}

export const offlineQueueService = {
  async enqueueEmergency(record: Omit<OfflineEmergencyRecord, 'localId' | 'status'>): Promise<OfflineEmergencyRecord> {
    const item: OfflineEmergencyRecord = {
      ...record,
      localId: `offline_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      status: 'PENDING_SYNC'
    };

    try {
      const existing = await this.getPendingEmergencies();
      const updated = [...existing, item];
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));

      // Also persist to SQLite local database for ACID-compliant local storage
      await sqliteStorage.saveOfflineEmergency({
        localId: item.localId,
        userId: item.userId,
        latitude: item.latitude,
        longitude: item.longitude,
        addressText: item.addressText
      });

      return item;
    } catch (error) {
      console.error('[OfflineQueue] Failed to enqueue emergency locally:', error);
      return item;
    }
  },

  async getPendingEmergencies(): Promise<OfflineEmergencyRecord[]> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async clearEmergency(localId: string): Promise<void> {
    try {
      const existing = await this.getPendingEmergencies();
      const filtered = existing.filter(e => e.localId !== localId);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));

      // Clear from SQLite
      await sqliteStorage.markEmergencySynced(localId);
    } catch (error) {
      console.error('[OfflineQueue] Failed to clear item:', error);
    }
  },

  async syncPendingEmergencies(): Promise<number> {
    const pending = await this.getPendingEmergencies();
    if (pending.length === 0) return 0;

    let syncedCount = 0;

    for (const item of pending) {
      try {
        const { error } = await supabase.from('emergency_requests').insert({
          user_id: item.userId,
          user_location: `POINT(${item.longitude} ${item.latitude})`,
          address_text: item.addressText || 'Saved offline location',
          current_status: 'SOS_ACTIVATED'
        });

        if (!error) {
          await this.clearEmergency(item.localId);
          syncedCount++;
        }
      } catch (err) {
        console.error('[OfflineQueue] Failed to sync item:', item.localId, err);
      }
    }

    return syncedCount;
  }
};
