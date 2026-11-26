import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserRole, Profile } from '@mediconnect/shared';
import { SplashScreen } from '../screens/common/SplashScreen';
import { MobileAuthHomeScreen } from '../screens/auth/MobileAuthHomeScreen';
import { UserHomeScreen } from '../screens/user/UserHomeScreen';
import { ContactHomeScreen } from '../screens/contact/ContactHomeScreen';
import { AmbulanceHomeScreen } from '../screens/ambulance/AmbulanceHomeScreen';
import { EmergencyContactsScreen } from '../screens/user/EmergencyContactsScreen';
import { LiveTrackingScreen } from '../screens/tracking/LiveTrackingScreen';
import { HospitalSelectionScreen } from '../screens/ambulance/HospitalSelectionScreen';
import { RatingFeedbackModal } from '../screens/feedback/RatingFeedbackModal';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { EmergencyHistoryScreen } from '../screens/common/EmergencyHistoryScreen';
import { notificationService } from '../services/notificationService';
import { networkService } from '../services/networkService';
import { firebaseService } from '../services/firebaseService';
import { authService } from '../services/authService';
import { WifiOff, Radio } from 'lucide-react-native';

type AppScreen = 
  | 'SPLASH'
  | 'AUTH_HOME'
  | 'DASHBOARD'
  | 'CONTACTS_MANAGER'
  | 'LIVE_TRACKING'
  | 'HOSPITAL_PICKER'
  | 'PROFILE'
  | 'HISTORY';

export const RootNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('SPLASH');
  const [selectedRole, setSelectedRole] = useState<'NORMAL_USER' | 'EMERGENCY_CONTACT' | 'AMBULANCE_PERSONNEL'>('NORMAL_USER');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [restoredUser, setRestoredUser] = useState<Profile | null>(null);
  const [activeEmergencyId, setActiveEmergencyId] = useState<string>('EMG-20261119-994');
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Restore authenticated session from persistent AsyncStorage on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const saved = await authService.getCurrentUser();
        if (saved && saved.id && saved.role) {
          setUserProfile(saved);
          setSelectedRole(saved.role as 'NORMAL_USER' | 'EMERGENCY_CONTACT' | 'AMBULANCE_PERSONNEL');
          setRestoredUser(saved);
        }
      } catch (err) {
        console.warn('[RootNavigator] Session restore error:', err);
      }
    };
    restoreSession();
  }, []);

  // Initialize Global Push Notifications, Network Listener, and Firebase Dual-Cloud Service
  useEffect(() => {
    // 1. Notifications
    notificationService.initialize().then(token => {
      if (token && userProfile?.id) {
        notificationService.registerPushToken(userProfile.id, token);
      }
    });

    // 2. Network live monitoring
    networkService.initialize();
    const unsubscribeNetwork = networkService.subscribe((online) => {
      setIsOnline(online);
    });

    // 3. Firebase Dual-Cloud Redundancy
    firebaseService.initialize();

    return () => {
      unsubscribeNetwork();
    };
  }, []);

  // Update token if user logs in
  useEffect(() => {
    if (userProfile?.id) {
      notificationService.initialize().then(token => {
        if (token) notificationService.registerPushToken(userProfile.id, token);
      });
    }
  }, [userProfile?.id]);

  // 1. Splash Opening Animation Screen
  if (currentScreen === 'SPLASH') {
    return (
      <SplashScreen 
        onFinish={() => {
          if (userProfile || restoredUser) {
            setCurrentScreen('DASHBOARD');
          } else {
            setCurrentScreen('AUTH_HOME');
          }
        }} 
      />
    );
  }

  // 2. Primary Mobile Home Auth Screen (Sign In, Sign Up, Forgot Password)
  if (currentScreen === 'AUTH_HOME') {
    return (
      <View style={{ flex: 1 }}>
        {!isOnline && (
          <View style={styles.offlineBar}>
            <WifiOff size={13} color="#FFFFFF" />
            <Text style={styles.offlineBarText}>Offline Mode • SQLite Local Storage Active</Text>
          </View>
        )}
        <MobileAuthHomeScreen
          onLoginSuccess={(profile) => {
            setUserProfile(profile);
            setSelectedRole(profile.role as 'NORMAL_USER' | 'EMERGENCY_CONTACT' | 'AMBULANCE_PERSONNEL');
            setCurrentScreen('DASHBOARD');
          }}
        />
      </View>
    );
  }

  // 3. Emergency Contacts Sub-Screen (Citizen)
  if (currentScreen === 'CONTACTS_MANAGER') {
    return (
      <View style={{ flex: 1 }}>
        {!isOnline && (
          <View style={styles.offlineBar}>
            <WifiOff size={13} color="#FFFFFF" />
            <Text style={styles.offlineBarText}>Offline Mode • Contacts Cached Locally</Text>
          </View>
        )}
        <EmergencyContactsScreen onBack={() => setCurrentScreen('DASHBOARD')} userProfile={userProfile} />
      </View>
    );
  }

  // 4. Live Telemetry Map Sub-Screen
  if (currentScreen === 'LIVE_TRACKING') {
    return (
      <LiveTrackingScreen
        emergencyId={activeEmergencyId}
        userRole={selectedRole}
        onBack={() => setCurrentScreen('DASHBOARD')}
      />
    );
  }

  // 5. Hospital Selection Sub-Screen (Ambulance Personnel)
  if (currentScreen === 'HOSPITAL_PICKER') {
    return (
      <HospitalSelectionScreen
        onSelectHospital={() => setCurrentScreen('DASHBOARD')}
        onBack={() => setCurrentScreen('DASHBOARD')}
      />
    );
  }

  // 6. User Profile & Medical ID Screen
  if (currentScreen === 'PROFILE') {
    return (
      <ProfileScreen
        userProfile={userProfile}
        onBack={() => setCurrentScreen('DASHBOARD')}
        onProfileUpdated={(updated) => setUserProfile(updated)}
      />
    );
  }

  // 7. Scoped Emergency History Screen
  if (currentScreen === 'HISTORY') {
    return (
      <EmergencyHistoryScreen
        userProfile={userProfile}
        onBack={() => setCurrentScreen('DASHBOARD')}
      />
    );
  }

  // 8. Sign Out / Change Role Action
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('[RootNavigator] Logout error:', err);
    }
    setUserProfile(null);
    setRestoredUser(null);
    setCurrentScreen('AUTH_HOME');
  };

  const handleOpenLiveTracking = (id?: string) => {
    if (id) setActiveEmergencyId(id);
    setCurrentScreen('LIVE_TRACKING');
  };

  // 9. Dedicated Mobile Dashboards by Role
  return (
    <View style={{ flex: 1 }}>
      {!isOnline && (
        <View style={styles.offlineBar}>
          <WifiOff size={13} color="#FFFFFF" />
          <Text style={styles.offlineBarText}>
            Offline Mode • Requests Queued Locally in SQLite & AsyncStorage
          </Text>
        </View>
      )}

      {selectedRole === 'NORMAL_USER' && (
        <UserHomeScreen
          userProfile={userProfile}
          onSwitchRole={handleLogout}
          onOpenContacts={() => setCurrentScreen('CONTACTS_MANAGER')}
          onOpenLiveTracking={handleOpenLiveTracking}
          onOpenFeedback={() => setFeedbackVisible(true)}
          onOpenProfile={() => setCurrentScreen('PROFILE')}
          onOpenHistory={() => setCurrentScreen('HISTORY')}
        />
      )}

      {selectedRole === 'EMERGENCY_CONTACT' && (
        <ContactHomeScreen
          userProfile={userProfile}
          onSwitchRole={handleLogout}
          onOpenLiveTracking={() => handleOpenLiveTracking('EMG-20261119-994')}
          onOpenFeedback={() => setFeedbackVisible(true)}
          onOpenProfile={() => setCurrentScreen('PROFILE')}
          onOpenHistory={() => setCurrentScreen('HISTORY')}
        />
      )}

      {selectedRole === 'AMBULANCE_PERSONNEL' && (
        <AmbulanceHomeScreen
          userProfile={userProfile}
          onSwitchRole={handleLogout}
          onOpenHospitalPicker={() => setCurrentScreen('HOSPITAL_PICKER')}
          onOpenLiveTracking={() => handleOpenLiveTracking('EMG-20261119-994')}
          onOpenProfile={() => setCurrentScreen('PROFILE')}
          onOpenHistory={() => setCurrentScreen('HISTORY')}
        />
      )}

      {/* Post-Emergency Feedback Modal */}
      <RatingFeedbackModal
        visible={feedbackVisible}
        emergencyId={activeEmergencyId}
        onClose={() => setFeedbackVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  offlineBar: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6
  },
  offlineBarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  }
});
