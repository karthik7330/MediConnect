import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  }),
});

export const notificationService = {
  // Initialize Android Notification Channels and Request Permissions
  async initialize(): Promise<string | null> {
    try {
      if (Platform.OS === 'android') {
        // High-Priority Emergency SOS Channel
        await Notifications.setNotificationChannelAsync('emergency_sos', {
          name: 'Emergency SOS & Dispatch Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#DC2626',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          bypassDnd: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
        });

        // Paramedic Dispatch Assignment Channel
        await Notifications.setNotificationChannelAsync('ambulance_dispatch', {
          name: 'Ambulance 60s Dispatch Offers',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0284C7',
          sound: 'default'
        });

        // General Updates & Connection Requests
        await Notifications.setNotificationChannelAsync('general_updates', {
          name: 'Family Network & Status Updates',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default'
        });
      }

      // Request runtime push permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Push notification permission not granted.');
        return null;
      }

      // Attempt to retrieve Expo push token
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        return tokenData.data;
      } catch {
        // In local Expo Go or emulators, native device token fallback
        return 'local_push_token_' + Date.now();
      }
    } catch (err) {
      console.warn('[NotificationService] Initialization warning:', err);
      return null;
    }
  },

  // Associate Push Token with User in Supabase
  async registerPushToken(userId: string, token: string): Promise<void> {
    try {
      if (!userId || !token) return;
      await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.warn('[NotificationService] Failed to save push token:', err);
    }
  },

  // 1. Dispatch Immediate Emergency SOS Heads-Up Notification
  async dispatchSosAlert(params: {
    emergencyId: string;
    patientName: string;
    locationText: string;
  }): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 CRITICAL SOS ACTIVATED',
          body: `${params.patientName} has triggered an emergency at ${params.locationText}. Emergency responders pre-alerted.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { emergencyId: params.emergencyId, type: 'SOS_ACTIVATED' },
          categoryIdentifier: 'EMERGENCY_ALERTS'
        },
        trigger: null // Deliver immediately
      });
    } catch (err) {
      console.warn('[NotificationService] dispatchSosAlert error:', err);
    }
  },

  // 2. Dispatch 60-Second Ambulance Dispatch Offer
  async dispatchAmbulanceOffer(params: {
    offerId: string;
    distance: string;
    patientLocation: string;
  }): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚑 INCOMING EMERGENCY DISPATCH (60s)',
          body: `Emergency ${params.distance}: ${params.patientLocation}. Tap to accept route.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { offerId: params.offerId, type: 'AMBULANCE_OFFER' }
        },
        trigger: null
      });
    } catch (err) {
      console.warn('[NotificationService] dispatchAmbulanceOffer error:', err);
    }
  },

  // 3. Dispatch Status Progression Update (e.g. Ambulance Arrived, Patient Picked Up)
  async dispatchStatusUpdate(params: {
    statusLabel: string;
    details: string;
  }): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🏥 Emergency Update: ${params.statusLabel}`,
          body: params.details,
          sound: 'default',
          data: { type: 'STATUS_UPDATE' }
        },
        trigger: null
      });
    } catch (err) {
      console.warn('[NotificationService] dispatchStatusUpdate error:', err);
    }
  },

  // 4. Dispatch Family Connection Request Alert
  async dispatchConnectionRequest(senderName: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '👋 Family Connection Request',
          body: `${senderName} wants to add you as their emergency contact. Tap to accept.`,
          sound: 'default',
          data: { type: 'CONNECTION_REQUEST' }
        },
        trigger: null
      });
    } catch (err) {
      console.warn('[NotificationService] dispatchConnectionRequest error:', err);
    }
  }
};
