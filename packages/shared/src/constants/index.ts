import { EmergencyStatus } from '../types';

export const EMERGENCY_STATUS_ORDER: EmergencyStatus[] = [
  'REQUEST_ACCEPTED',
  'AMBULANCE_DISPATCHED',
  'AMBULANCE_ON_THE_WAY',
  'AMBULANCE_ARRIVED',
  'PATIENT_PICKED_UP',
  'PATIENT_REACHED_HOSPITAL',
  'EMERGENCY_RESOLVED'
];

export const STATUS_LABELS: Record<EmergencyStatus, string> = {
  SOS_ACTIVATED: 'SOS Triggered (Searching for Ambulance)',
  REQUEST_ACCEPTED: 'Request Accepted by Crew',
  AMBULANCE_DISPATCHED: 'Ambulance Dispatched',
  AMBULANCE_ON_THE_WAY: 'Ambulance On The Way',
  AMBULANCE_ARRIVED: 'Ambulance Arrived at Scene',
  PATIENT_PICKED_UP: 'Patient Picked Up',
  PATIENT_REACHED_HOSPITAL: 'Patient Delivered to Hospital',
  EMERGENCY_RESOLVED: 'Emergency Resolved',
  EMERGENCY_CANCELLED: 'Emergency Cancelled'
};

export const ALLOCATION_CONFIG = {
  INITIAL_RADIUS_METERS: 5000, // 5 km
  RADIUS_EXPANSION_STEP_METERS: 2500, // +2.5 km
  EXPANSION_INTERVAL_SECONDS: 120, // 2 minutes
  MAX_SEARCH_RADIUS_METERS: 30000, // 30 km
  AMBULANCE_OFFER_TIMEOUT_SECONDS: 60 // 60 seconds to respond
};

export const CANCELLATION_REASONS = [
  'Vehicle breakdown or mechanical failure',
  'Medical or technical emergency onboard',
  'Paramedic/Crew urgently unavailable',
  'Unable to reach patient due to road blockage/hazard',
  'Other emergency circumstance'
] as const;

export const ADMIN_SECURITY_CONFIG = {
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15
};
