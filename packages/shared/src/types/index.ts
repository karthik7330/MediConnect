export type UserRole = 
  | 'NORMAL_USER' 
  | 'EMERGENCY_CONTACT' 
  | 'AMBULANCE_PERSONNEL' 
  | 'MAIN_ADMIN' 
  | 'SUB_ADMIN';

export type CrewAvailability = 'ONLINE' | 'OFFLINE' | 'BUSY';

export type EmergencyStatus = 
  | 'SOS_ACTIVATED'
  | 'REQUEST_ACCEPTED'
  | 'AMBULANCE_DISPATCHED'
  | 'AMBULANCE_ON_THE_WAY'
  | 'AMBULANCE_ARRIVED'
  | 'PATIENT_PICKED_UP'
  | 'PATIENT_REACHED_HOSPITAL'
  | 'EMERGENCY_RESOLVED'
  | 'EMERGENCY_CANCELLED';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string;
  phoneNumber: string;
  email?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  isApproved: boolean;
  isDeactivated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubAdminPermissions {
  adminId: string;
  canApproveAmbulance: boolean;
  canManageUsers: boolean;
  canManualAssign: boolean;
  canViewAnalytics: boolean;
  canViewLogs: boolean;
}

export interface AmbulanceCrew {
  id: string;
  vehicleNumber: string;
  vehicleModel?: string;
  licenseNumber: string;
  availability: CrewAvailability;
  location?: Coordinates;
  lastLocationUpdate?: string;
  reliabilityScore: number;
  isApproved: boolean;
  approvedBy?: string;
}

export interface ConnectionRequest {
  id: string;
  senderUserId: string;
  senderName: string;
  recipientPhone: string;
  recipientUserId?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  contactUserId: string;
  contactName: string;
  canReceiveAlerts: boolean;
  createdAt: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  location: Coordinates;
  emergencyPhone?: string;
  icuBedsAvailable: number;
  isVerified: boolean;
}

export interface EmergencyRequest {
  id: string;
  userId: string;
  userLocation: Coordinates;
  addressText?: string;
  currentStatus: EmergencyStatus;
  searchRadiusMeters: number;
  assignedAmbulanceId?: string;
  selectedHospitalId?: string;
  cancellationReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface EmergencyStatusHistoryItem {
  id: string;
  emergencyId: string;
  status: EmergencyStatus;
  updatedBy: string;
  notes?: string;
  createdAt: string;
}

export interface LiveAmbulanceTracking {
  emergencyId: string;
  ambulanceId: string;
  currentLocation: Coordinates;
  heading?: number;
  speedKmh?: number;
  updatedAt: string;
  isActive: boolean;
}

export interface AmbulanceRating {
  id: string;
  emergencyId: string;
  ambulanceId: string;
  rating: number; // 1 - 5
  feedbackText?: string;
  submittedBy?: string; // Stored securely for Admin auditing
  createdAt: string;
}

export interface ServiceFeedback {
  id: string;
  rating: number; // 1 - 5
  feedbackText?: string;
  createdAt: string;
}

export interface AdminActivityLog {
  id: string;
  adminId: string;
  action: string;
  targetEntityId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AmbulancePerformance {
  ambulanceId: string;
  totalRequestsReceived: number;
  totalAccepted: number;
  totalRejected: number;
  totalCompleted: number;
  totalCancelled: number;
  avgResponseTimeSeconds: number;
  avgArrivalTimeSeconds: number;
  reassignmentCount: number;
  reliabilityScore: number;
  updatedAt: string;
}
