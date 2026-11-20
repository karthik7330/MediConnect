import { Linking, Alert, Platform } from 'react-native';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string; // red, blue, green, yellow, orange
}

export const mapNavigationService = {
  // Generate Google Static Maps URL with multiple custom markers
  getStaticMapUrl(params: {
    centerLat: number;
    centerLng: number;
    zoom?: number;
    width?: number;
    height?: number;
    markers?: MapMarker[];
  }): string {
    const { centerLat, centerLng, zoom = 14, width = 600, height = 320, markers = [] } = params;

    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLng}&zoom=${zoom}&size=${width}x${height}&scale=2&maptype=roadmap`;

    // Add markers
    if (markers.length > 0) {
      markers.forEach(m => {
        const color = m.color || 'red';
        const label = m.label ? `label:${m.label}%7C` : '';
        url += `&markers=color:${color}%7C${label}${m.lat},${m.lng}`;
      });
    } else {
      url += `&markers=color:red%7C${centerLat},${centerLng}`;
    }

    url += `&key=${GOOGLE_MAPS_API_KEY}`;
    return url;
  },

  // Open Google Maps turn-by-turn navigation directly
  async openNavigation(destinationLat: number, destinationLng: number, destinationName?: string): Promise<void> {
    const googleNavUrl = Platform.OS === 'android'
      ? `google.navigation:q=${destinationLat},${destinationLng}&mode=d`
      : `maps://app?daddr=${destinationLat},${destinationLng}`;

    const webFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}&travelmode=driving`;

    try {
      const supported = await Linking.canOpenURL(googleNavUrl);
      if (supported) {
        await Linking.openURL(googleNavUrl);
      } else {
        await Linking.openURL(webFallbackUrl);
      }
    } catch {
      await Linking.openURL(webFallbackUrl);
    }
  },

  // Launch device's native phone dialer
  async makePhoneCall(phoneNumber: string, contactName?: string): Promise<void> {
    if (!phoneNumber || !phoneNumber.trim()) {
      Alert.alert('Phone Unavailable', 'No valid phone number is registered for this user.');
      return;
    }

    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    const telUrl = `tel:${cleanNumber}`;

    try {
      const supported = await Linking.canOpenURL(telUrl);
      if (supported) {
        await Linking.openURL(telUrl);
      } else {
        Alert.alert(
          'Cannot Open Dialer',
          `Your device cannot directly open the dialer for ${phoneNumber}. Please dial manually.`
        );
      }
    } catch (err: unknown) {
      console.warn('[mapNavigationService] dialer error:', err);
      Alert.alert('Calling Failed', `Unable to call ${contactName || phoneNumber}.`);
    }
  },

  // Launch device's native SMS messaging app
  async sendSms(phoneNumber: string, message?: string): Promise<void> {
    if (!phoneNumber || !phoneNumber.trim()) {
      Alert.alert('Number Required', 'No registered mobile number found.');
      return;
    }

    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const textBody = message ? `${separator}body=${encodeURIComponent(message)}` : '';
    const smsUrl = `sms:${cleanNumber}${textBody}`;

    try {
      await Linking.openURL(smsUrl);
    } catch {
      Alert.alert('SMS Failed', `Could not open messaging for ${phoneNumber}.`);
    }
  }
};
