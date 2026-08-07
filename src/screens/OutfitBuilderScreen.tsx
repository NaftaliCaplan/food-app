import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../navigation/types';
import { getUserProfile } from '../storage/profileStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { StylePreference } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OutfitBuilder'>;

const STYLE_OPTIONS: { key: StylePreference; label: string }[] = [
  { key: 'casual',       label: 'Casual' },
  { key: 'smart_casual', label: 'Smart Casual' },
  { key: 'formal',       label: 'Formal' },
  { key: 'sporty',       label: 'Sporty' },
];

interface ToggleRowProps {
  label: string;
  sublabel: string;
  value: boolean;
  onToggle: () => void;
}

function ToggleRow({ label, sublabel, value, onToggle }: ToggleRowProps) {
  return (
    <TouchableOpacity
      style={styles.toggleRow}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
    >
      <View style={styles.toggleText}>
        <AppText style={styles.toggleTitle}>
          {value ? '[x]' : '[ ]'} {label}
        </AppText>
        <AppText style={styles.toggleSub}>{sublabel}</AppText>
      </View>
    </TouchableOpacity>
  );
}

export function OutfitBuilderScreen() {
  const navigation = useNavigation<Nav>();

  const [selected, setSelected] = useState<StylePreference[]>([]);
  const [includeAccessories, setIncludeAccessories] = useState(true);
  const [useProfile, setUseProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  // Only offer the personalize toggle when a profile actually exists. We reset
  // useProfile to false each visit — personalization is opt-in per generation.
  useFocusEffect(
    useCallback(() => {
      getUserProfile().then(p => {
        const exists = p !== null;
        setHasProfile(exists);
        if (!exists) setUseProfile(false);
      });
    }, []),
  );

  function toggleStyle(key: StylePreference) {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
  }

  function handleGenerate() {
    navigation.navigate('OutfitResults', {
      stylePrefs: selected,
      useProfile,
      includeAccessories,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <ScreenHeader title="Build an Outfit" onBack={() => navigation.goBack()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText style={styles.intro}>
          Pick the styles you're going for. Leave them all off for an anything-goes
          suggestion.
        </AppText>

        {/* Style preferences — multi-select */}
        <AppText style={styles.sectionLabel}>STYLE</AppText>
        <View style={styles.chipGrid}>
          {STYLE_OPTIONS.map(o => {
            const active = selected.includes(o.key);
            return (
              <TouchableOpacity
                key={o.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleStyle(o.key)}
                accessibilityLabel={o.label}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
              >
                <AppText style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {active ? '[x]' : '[ ]'} {o.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        <ToggleRow
          label="Include accessories"
          sublabel="Let suggestions add hats, scarves, and other extras"
          value={includeAccessories}
          onToggle={() => setIncludeAccessories(v => !v)}
        />

        {hasProfile && (
          <ToggleRow
            label="Personalize for me"
            sublabel="Use your style profile to tailor the fit and contrast"
            value={useProfile}
            onToggle={() => setUseProfile(v => !v)}
          />
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerate}
          accessibilityLabel="Generate outfit"
          accessibilityRole="button"
        >
          <AppText style={styles.generateBtnText}>Generate Outfit →</AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
  },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  intro: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: Colors.accent,
  },
  chipLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  bottomBar: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  generateBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
