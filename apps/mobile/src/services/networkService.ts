import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { offlineQueueService } from './offlineQueue';
import { notificationService } from './notificationService';

type NetworkListener = (isOnline: boolean, state: NetInfoState) => void;

class NetworkService {
  private isConnected: boolean = true;
  private wasOffline: boolean = false;
  private listeners: Set<NetworkListener> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;

  initialize() {
    if (this.unsubscribeNetInfo) return;

    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const online = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      const previousState = this.isConnected;
      this.isConnected = online;

      // Notify all registered UI listeners
      this.listeners.forEach(listener => listener(online, state));

      // Network Restored: Trigger automatic offline emergency synchronization!
      if (!previousState && online) {
        console.log('[NetworkService] Internet connection restored. Triggering pending queue sync...');
        this.handleNetworkRestored();
      } else if (previousState && !online) {
        console.warn('[NetworkService] Device is offline. Offline fallback active.');
        this.wasOffline = true;
      }
    });
  }

  private async handleNetworkRestored() {
    try {
      const syncedCount = await offlineQueueService.syncPendingEmergencies();
      if (syncedCount > 0) {
        await notificationService.dispatchStatusUpdate({
          statusLabel: 'Offline Sync Complete',
          details: `Successfully uploaded ${syncedCount} queued emergency request(s) to cloud servers.`
        });
      }
      this.wasOffline = false;
    } catch (err) {
      console.warn('[NetworkService] Auto-sync error on reconnect:', err);
    }
  }

  // Subscribe to live network state changes
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current known state
    NetInfo.fetch().then(state => {
      const online = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      this.isConnected = online;
      listener(online, state);
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  async checkIsOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isConnected = Boolean(state.isConnected && (state.isInternetReachable ?? true));
    return this.isConnected;
  }

  get online(): boolean {
    return this.isConnected;
  }
}

export const networkService = new NetworkService();
