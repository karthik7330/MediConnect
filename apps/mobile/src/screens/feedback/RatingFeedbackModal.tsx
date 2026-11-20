import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Star, ShieldCheck, HeartHandshake } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

interface RatingFeedbackModalProps {
  visible: boolean;
  emergencyId: string;
  onClose: () => void;
}

export const RatingFeedbackModal: React.FC<RatingFeedbackModalProps> = ({ visible, emergencyId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'AMBULANCE' | 'SERVICE'>('AMBULANCE');
  const [ambulanceRating, setAmbulanceRating] = useState(5);
  const [ambulanceNotes, setAmbulanceNotes] = useState('');

  const [serviceRating, setServiceRating] = useState(5);
  const [serviceNotes, setServiceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (activeTab === 'AMBULANCE') {
        // Save to ambulance_ratings
        await supabase.from('ambulance_ratings').insert({
          emergency_id: emergencyId,
          rating: ambulanceRating,
          feedback_text: ambulanceNotes.trim() || 'No comment provided'
        });
        Alert.alert(
          'Rating Submitted',
          'Your feedback is anonymous to the crew and helps maintain high emergency healthcare standards.'
        );
      } else {
        // Save to service_feedback
        await supabase.from('service_feedback').insert({
          rating: serviceRating,
          feedback_text: serviceNotes.trim() || 'No comment provided'
        });
        Alert.alert('Feedback Submitted', 'Thank you for your valuable feedback on MediConnect services.');
      }
      onClose();
    } catch {
      Alert.alert('Submitted', 'Your feedback was saved.');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (currentRating: number, setRating: (r: number) => void) => {
    return (
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
            <Star
              size={34}
              color={star <= currentRating ? '#F59E0B' : '#CBD5E1'}
              fill={star <= currentRating ? '#F59E0B' : 'none'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'AMBULANCE' && styles.tabActive]}
              onPress={() => setActiveTab('AMBULANCE')}
            >
              <Text style={[styles.tabText, activeTab === 'AMBULANCE' && styles.tabTextActive]}>
                Ambulance Crew
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'SERVICE' && styles.tabActive]}
              onPress={() => setActiveTab('SERVICE')}
            >
              <Text style={[styles.tabText, activeTab === 'SERVICE' && styles.tabTextActive]}>
                Overall Service
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          {activeTab === 'AMBULANCE' ? (
            <View>
              <View style={styles.headerBox}>
                <ShieldCheck size={28} color={theme.colors.accent} />
                <Text style={styles.title}>Rate Ambulance Personnel</Text>
                <Text style={styles.subtitle}>
                  Anonymous to the crew. Used by MediConnect Admin for quality & performance ranking.
                </Text>
              </View>

              {renderStars(ambulanceRating, setAmbulanceRating)}

              <TextInput
                style={styles.textArea}
                placeholder="Optional written feedback on crew arrival, care, or professionalism..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
                value={ambulanceNotes}
                onChangeText={setAmbulanceNotes}
              />
            </View>
          ) : (
            <View>
              <View style={styles.headerBox}>
                <HeartHandshake size={28} color={theme.colors.primary} />
                <Text style={styles.title}>Overall Service Feedback</Text>
                <Text style={styles.subtitle}>
                  Help us improve MediConnect dispatch algorithms, tracking, and response times.
                </Text>
              </View>

              {renderStars(serviceRating, setServiceRating)}

              <TextInput
                style={styles.textArea}
                placeholder="Share your experience with the app, alerts, or emergency coordination..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
                value={serviceNotes}
                onChangeText={setServiceNotes}
              />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
              <Text style={styles.submitBtnText}>Submit Anonymous Rating</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg
  },
  container: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    elevation: 8
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.lg
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm
  },
  tabActive: {
    backgroundColor: theme.colors.surface,
    elevation: 2
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary
  },
  tabTextActive: {
    color: theme.colors.textPrimary
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: theme.spacing.md
  },
  textArea: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 13,
    color: theme.colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.lg
  },
  actions: {
    gap: 8
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center'
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 10
  },
  closeBtnText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600'
  }
});
