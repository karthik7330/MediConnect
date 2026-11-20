import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';
import { sqliteStorage } from './sqliteStorage';

export const BACKGROUND_LOCATION_TASK = 'MEDICONNECT_BACKGROUND_LOCATION_TASK';

// Active incident metadata for background worker
let activeIncidentContext: {
  incidentId: string;
  role: 'NORMAL_USER' | 'AMBULANCE_PERSONNEL';
  userId: string;
} | null = null;

// Define background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundLocationService] Task error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    const latest = locations[locations.length - 1];
    const { latitude, longitude, speed } = latest.coords;

    // 1. Save breadcrumb to SQLite local storage
    if (activeIncidentContext?.incidentId) {
      await sqliteStorage.logBreadcrumb({
        incidentId: activeIncidentContext.incidentId,
        latitude,
        longitude,
        speed: speed ?? 0
      });
    }

    // 2. Broadcast live coordinates to Supabase
    try {
      if (activeIncidentContext?.role === 'NORMAL_USER' && activeIncidentContext.incidentId) {
        await supabase
          .from('emergency_requests')
          .update({
            user_location: `POINT(${longitude} ${latitude})`
          })
          .eq('id', activeIncidentContext.incidentId);
      } else if (activeIncidentContext?.role === 'AMBULANCE_PERSONNEL' && activeIncidentContext.userId) {
        await supabase
          .from('ambulance_crews')
          .update({
            location: `POINT(${longitude} ${latitude})`,
            last_location_update: new Date().toISOString()
          })
          .eq('id', activeIncidentContext.userId);
      }
    } catch (err) {
      console.warn('[BackgroundLocationService] Cloud broadcast error (cached locally):', err);
    }
  }
});

export const backgroundLocationService = {
  // Start Background GPS Tracking with Android Foreground Service
  async startTracking(params: {
    incidentId: string;
    role: 'NORMAL_USER' | 'AMBULANCE_PERSONNEL';
    userId: string;
  }): Promise<boolean> {
    try {
      // 1. Request foreground & background permissions
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('[BackgroundLocationService] Foreground location permission denied.');
        return false;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('[BackgroundLocationService] Background location permission denied.');
      }

      activeIncidentContext = params;

      // 2. Start location updates with Android Foreground Service notification
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 4000, // Update every 4 seconds
          distanceInterval: 5, // Update every 5 meters
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: 'MediConnect Emergency Telemetry Active',
            notificationBody: 'Broadcasting live satellite GPS coordinates to emergency responders.',
            notificationColor: '#DC2626'
          }
        });
      }

      return true;
    } catch (err) {
      console.warn('[BackgroundLocationService] startTracking exception:', err);
      return false;
    }
  },

  // Stop background location updates
  async stopTracking(): Promise<void> {
    try {
      activeIncidentContext = null;
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch (err) {
      console.warn('[BackgroundLocationService] stopTracking error:', err);
    }
  },

  // Continuous foreground position watcher for instant UI re-rendering
  watchForegroundPosition(callback: (location: Location.LocationObject) => void): Promise<Location.LocationSubscription> {
    return Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 2000,
        distanceInterval: 3
      },
      callback
    );
  }
};
