import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ACCESSORY_TYPE_TAGS, BRIGHTNESS_TAGS, COLOR_TAGS, PATTERN_TAGS, secondaryTagGroup } from '../constants/tagVocabulary';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { ItemCategory } from '../types/wardrobe';
import { extractStyles, isStyleWord } from '../utils/styleTags';
import { AppText } from './AppText';
import { CategoryPicker } from './CategoryPicker';
import { StylePicker } from './StylePicker';

interface Props {
  category: ItemCategory;
  onCategoryChange: (category: ItemCategory) => void;
  name: string;
  onNameChange: (name: string) => void;
  tags: string[];
  onToggleTag: (tag: string) => void;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
}

// Toggling a curated tag on/off and toggling it via the free-text "remove"
// chip both just add/remove from the same `tags` array — one handler covers
// both entry points so the two views of tag state can never disagree.
function CuratedTagSection({ label, tags, activeTags, onToggleTag }: {
  label: string;
  tags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
}) {
  return (
    <View style={styles.curatedSection}>
      <AppText style={styles.curatedLabel}>{label}</AppText>
      <View style={styles.curatedRow}>
        {tags.map(tag => {
          const active = activeTags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.curatedChip, active && styles.curatedChipActive]}
              onPress={() => onToggleTag(tag)}
              accessibilityLabel={tag}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <AppText style={[styles.curatedChipText, active && styles.curatedChipTextActive]}>
                {active ? '[x]' : '[ ]'} {tag}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function WardrobeItemForm({
  category,
  onCategoryChange,
  name,
  onNameChange,
  tags,
  onToggleTag,
  onSave,
  saving,
  saveLabel,
}: Props) {
  const [customInput, setCustomInput] = useState('');
  const secondary = secondaryTagGroup(category);
  const selectedStyles = extractStyles(tags);

  function addCustomTag() {
    const t = customInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t) onToggleTag(t);
    setCustomInput('');
  }

  return (
    <View style={styles.form}>
      <AppText style={styles.sectionLabel}>CATEGORY</AppText>
      <CategoryPicker category={category} onChange={onCategoryChange} />

      <AppText style={styles.sectionLabel}>STYLE</AppText>
      <StylePicker selected={selectedStyles} onToggle={onToggleTag} />

      <AppText style={styles.sectionLabel}>NAME (optional)</AppText>
      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={onNameChange}
        placeholder="e.g. white button-up shirt"
        placeholderTextColor={Colors.textDisabled}
        selectionColor={Colors.accent}
      />

      <AppText style={styles.sectionLabel}>TAGS</AppText>
      <AppText style={styles.tagHint}>Tap to remove · More tags = better outfit matching</AppText>
      <View style={styles.tagWrap}>
        {/* Style lives in its own picker above — hide it here so it isn't
            shown (and editable) twice. */}
        {tags.filter(t => !isStyleWord(t)).map(tag => (
          <TouchableOpacity
            key={tag}
            style={styles.tag}
            onPress={() => onToggleTag(tag)}
            accessibilityLabel={`Remove tag ${tag}`}
          >
            <AppText style={styles.tagText}>{tag} ✕</AppText>
          </TouchableOpacity>
        ))}
      </View>

      <AppText style={styles.curatedIntro}>Tap to add — same words the scanner uses:</AppText>
      <CuratedTagSection label="COLOR" tags={COLOR_TAGS} activeTags={tags} onToggleTag={onToggleTag} />
      <CuratedTagSection label="PATTERN" tags={PATTERN_TAGS} activeTags={tags} onToggleTag={onToggleTag} />
      <CuratedTagSection label="BRIGHTNESS" tags={BRIGHTNESS_TAGS} activeTags={tags} onToggleTag={onToggleTag} />
      <CuratedTagSection label={secondary.label} tags={secondary.tags} activeTags={tags} onToggleTag={onToggleTag} />
      {category === 'accessory' && (
        <CuratedTagSection label="TYPE" tags={ACCESSORY_TYPE_TAGS} activeTags={tags} onToggleTag={onToggleTag} />
      )}

      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInput}
          value={customInput}
          onChangeText={setCustomInput}
          placeholder="or type a custom tag..."
          placeholderTextColor={Colors.textDisabled}
          selectionColor={Colors.accent}
          onSubmitEditing={addCustomTag}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.tagAddBtn} onPress={addCustomTag}>
          <AppText style={styles.tagAddText}>＋</AppText>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#000" />
        ) : (
          <AppText style={styles.saveBtnText}>{saveLabel}</AppText>
        )}
      </TouchableOpacity>
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
  nameInput: {
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: 'JetBrainsMono_400Regular',
  },
  tagHint: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.accentMuted,
    borderRadius: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  tagText: {
    color: Colors.accent,
    fontSize: 13,
  },
  curatedIntro: {
    fontSize: 12,
    color: Colors.textDisabled,
    marginTop: Spacing.xs,
  },
  curatedSection: {
    gap: Spacing.xs,
  },
  curatedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textDisabled,
    letterSpacing: 1,
  },
  curatedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  curatedChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  curatedChipActive: {
    borderColor: Colors.accent,
  },
  curatedChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  curatedChipTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: 'JetBrainsMono_400Regular',
  },
  tagAddBtn: {
    backgroundColor: Colors.accent,
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
