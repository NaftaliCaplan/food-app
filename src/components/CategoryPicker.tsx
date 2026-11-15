import { ChipPicker } from './ChipPicker';
import { ItemCategory } from '../types/wardrobe';

const CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: 'top',       label: 'Top' },
  { key: 'bottom',    label: 'Bottom' },
  { key: 'shoes',     label: 'Shoes' },
  { key: 'accessory', label: 'Accessory' },
];

interface Props {
  category: ItemCategory;
  onChange: (category: ItemCategory) => void;
}

export function CategoryPicker({ category, onChange }: Props) {
  return (
    <ChipPicker
      options={CATEGORIES}
      isSelected={key => key === category}
      onPress={onChange}
      variant="radio"
    />
  );
}
