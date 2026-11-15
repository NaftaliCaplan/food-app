import { ChipPicker } from './ChipPicker';
import { StylePreference } from '../types/wardrobe';
import { STYLE_KEYS, STYLE_LABELS } from '../utils/styleTags';

const STYLE_OPTIONS = STYLE_KEYS.map(key => ({ key, label: STYLE_LABELS[key] }));

interface Props {
  // An item can carry more than one style tag at once (ADR 0018) — a plain
  // t-shirt can be both casual and beachwear — so this is multi-select.
  selected: StylePreference[];
  onToggle: (style: StylePreference) => void;
}

export function StylePicker({ selected, onToggle }: Props) {
  return (
    <ChipPicker
      options={STYLE_OPTIONS}
      isSelected={key => selected.includes(key)}
      onPress={onToggle}
      variant="checkbox"
    />
  );
}
