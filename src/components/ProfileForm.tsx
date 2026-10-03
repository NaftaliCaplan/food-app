import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { UserProfile } from '../types/wardrobe';
import { AppText } from './AppText';

const HEIGHT_OPTIONS: { key: UserProfile['heightRange']; label: string }[] = [
  { key: 'petite',  label: 'Petite' },
  { key: 'average', label: 'Average' },
  { key: 'tall',    label: 'Tall' },
];

const BUILD_OPTIONS: { key: UserProfile['build']; label: string }[] = [
  { key: 'slim',    label: 'Slim' },
  { key: 'average', label: 'Average' },
  { key: 'broad',   label: 'Broad' },
];

interface Props {
  photoUri?: string;
  skinToneDesc?: string;
  onRetakePhoto: () => void;
  heightRange: UserProfile['heightRange'];
  onHeightChange: (heightRange: UserProfile['heightRange']) => void;
  build: UserProfile['build'];
  onBuildChange: (build: UserProfile['build']) => void;
  onSave: () => void;
  saving: boolean;
  onSkip: () => void;
  onClear: () => void;
}

export function ProfileForm({
  photoUri,
  skinToneDesc,
  onRetakePhoto,
  heightRange,
  onHeightChange,
  build,
  onBuildChange,
  onSave,
  saving,
  onSkip,
  onClear,
}: Props) {
  return (
    <View style={styles.form}>
      {/* Reference photo */}
      <AppText style={styles.sectionLabel}>REFERENCE PHOTO</AppText>
      <AppText style={styles.sectionHint}>
        Used to read your complexion undertone and contrast — not stored on any server.
      </AppText>

      {photoUri ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: photoUri }} style={styles.photoThumb} />
          <View style={styles.photoInfo}>
            {skinToneDesc ? (
              <AppText style={styles.skinDesc}>{skinToneDesc}</AppText>
            ) : null}
            <TouchableOpacity onPress={onRetakePhoto}>
              <AppText style={styles.retakeLink}>Retake photo</AppText>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoPlaceholder} onPress={onRetakePhoto}>
          <AppText style={styles.photoPlaceholderIcon}>[CAMERA]</AppText>
          <AppText style={styles.photoPlaceholderText}>Tap to take reference photo</AppText>
        </TouchableOpacity>
      )}

      {/* Height */}
      <AppText style={styles.sectionLabel}>YOUR HEIGHT</AppText>
      <View style={styles.chipRow}>
        {HEIGHT_OPTIONS.map(o => {
          const active = heightRange === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onHeightChange(o.key)}
              accessibilityLabel={o.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <AppText style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {active ? '(x)' : '( )'} {o.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Build */}
      <AppText style={styles.sectionLabel}>YOUR BUILD</AppText>
      <View style={styles.chipRow}>
        {BUILD_OPTIONS.map(o => {
          const active = build === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onBuildChange(o.key)}
              accessibilityLabel={o.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <AppText style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {active ? '(x)' : '( )'} {o.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[styles.primaryBtn, saving && styles.btnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#000" />
          : <AppText style={styles.primaryBtnText}>✓ Save Profile</AppText>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <AppText style={styles.skipText}>Skip for now</AppText>
      </TouchableOpacity>

      {photoUri || skinToneDesc ? (
        <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
          <AppText style={styles.clearText}>✕ Clear profile</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: Colors.surface,
  },
  photoInfo: {
    flex: 1,
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  skinDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  retakeLink: {
    color: Colors.accent,
    fontSize: 13,
  },
  photoPlaceholder: {
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photoPlaceholderIcon: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  photoPlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: Colors.accent,
  },
  chipLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  clearBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  clearText: {
    color: Colors.stateError,
    fontSize: 13,
  },
});
