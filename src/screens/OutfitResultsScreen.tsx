import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { ScreenHeader } from '../components/ScreenHeader';
import { useOutfitGenerator } from '../hooks/useOutfitGenerator';
import { RootStackParamList } from '../navigation/types';
import { getUserProfile } from '../storage/profileStorage';
import { saveOutfit } from '../storage/outfitStorage';
import { getWardrobe } from '../storage/wardrobeStorage';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ItemCategory, StylePreference, UserProfile, WardrobeItem } from '../types/wardrobe';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OutfitResults'>;
type Rt = RouteProp<RootStackParamList, 'OutfitResults'>;

const CATEGORY_ICON: Record<ItemCategory, string> = {
  top:       '[TOP]',
  bottom:    '[BOT]',
  shoes:     '[SHOE]',
  accessory: '[ACC]',
};

// Turns the selected style keys into a display label for the saved outfit,
// e.g. ['smart_casual'] -> "Smart Casual", [] -> "Any Style".
function formatStyleName(prefs: StylePreference[]): string {
  if (prefs.length === 0) return 'Any Style';
  return prefs
    .map(p => p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(' + ');
}

export function OutfitResultsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { stylePrefs, useProfile, includeAccessories } = route.params;

  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const generatedRef = useRef(false);

  // Load the wardrobe (and, if requested, the profile) once on mount. This
  // screen only receives style flags via route params — the underlying data
  // lives in AsyncStorage, not in navigation state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const w = await getWardrobe();
      const p = useProfile ? await getUserProfile() : null;
      if (cancelled) return;
      setWardrobe(w);
      setProfile(p);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [useProfile]);

  const { status, suggestion, error, attemptCount, generate, reject } = useOutfitGenerator(
    wardrobe,
    stylePrefs as StylePreference[],
    profile,
    includeAccessories,
  );

  // Fire the first generation once wardrobe/profile have loaded. Guarded by a
  // ref so it only runs once — `generate`'s identity changes when wardrobe
  // goes from [] to loaded, but we don't want that transition to re-trigger.
  useEffect(() => {
    if (ready && !generatedRef.current) {
      generatedRef.current = true;
      generate();
    }
  }, [ready, generate]);

  async function handleAccept() {
    if (!suggestion || saving) return;
    setSaving(true);
    try {
      await saveOutfit({
        id: Date.now().toString(),
        itemIds: suggestion.items.map(i => i.id),
        styleName: formatStyleName(stylePrefs as StylePreference[]),
        savedAt: Date.now(),
        recommendation: suggestion.recommendation,
      });
      navigation.navigate('Wardrobe');
    } catch (e) {
      console.error('Save outfit failed', e);
      setSaving(false);
    }
  }

  function handleReject() {
    if (saving) return;
    reject();
  }

  const isLoading = !ready || status === 'idle' || status === 'loading';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <AppText style={styles.loadingText}>
            {attemptCount > 0 ? 'Finding another combination...' : 'Styling your outfit...'}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <AppText style={styles.errorIcon}>[ERROR]</AppText>
          <AppText style={styles.errorText}>{error}</AppText>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => generate()}>
            <AppText style={styles.primaryBtnText}>Try Again</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
            <AppText style={styles.skipText}>← Adjust Style</AppText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <ScreenHeader
          title="Your Outfit"
          onBack={() => navigation.goBack()}
          right={
            attemptCount > 1 ? (
              <AppText style={styles.attemptText}>Attempt {attemptCount}</AppText>
            ) : undefined
          }
        />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll}>
        <View style={styles.itemRow}>
          {suggestion?.items.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <Image source={{ uri: item.photoUri }} style={styles.itemThumb} resizeMode="cover" />
              <AppText style={styles.itemLabel} numberOfLines={1}>
                {CATEGORY_ICON[item.category]} {item.name ?? item.category}
              </AppText>
            </View>
          ))}
        </View>

        {suggestion?.recommendation ? (
          <View style={styles.recommendationBox}>
            <AppText style={styles.recommendationText}>TIP: {suggestion.recommendation}</AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.noBtn, saving && styles.btnDisabled]}
          onPress={handleReject}
          disabled={saving}
          accessibilityLabel="Try a different outfit"
        >
          <AppText style={styles.noBtnText}>✕ Try Again</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.yesBtn, saving && styles.btnDisabled]}
          onPress={handleAccept}
          disabled={saving}
          accessibilityLabel="Keep this outfit"
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <AppText style={styles.yesBtnText}>✓ Keep This Outfit</AppText>
          )}
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
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorIcon: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.stateError,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
  },
  skipText: {
    color: Colors.accent,
    fontSize: 14,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
  },
  attemptText: {
    color: Colors.textDisabled,
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  itemCard: {
    width: 96,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    overflow: 'hidden',
  },
  itemThumb: {
    width: '100%',
    aspectRatio: 1,
  },
  itemLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  recommendationBox: {
    backgroundColor: Colors.accentMuted,
    borderRadius: 0,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  recommendationText: {
    color: Colors.accent,
    fontSize: 13,
    lineHeight: 19,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noBtn: {
    flex: 1,
    minHeight: 52,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  yesBtn: {
    flex: 1,
    minHeight: 52,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
