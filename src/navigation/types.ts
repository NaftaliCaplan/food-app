import { WardrobeItem } from '../types/wardrobe';

export type RootStackParamList = {
  Home: undefined;
  FoodChecker: undefined;
  Results: {
    photoUri: string;
    foodLabel: string;
  };
  ClothesChecker: undefined;
  ClothesResults: {
    photoUri: string;
  };
  Wardrobe: undefined;
  AddItem: undefined;
  EditItem: {
    item: WardrobeItem;
  };
  UserProfile: undefined;
  OutfitBuilder: undefined;
  OutfitResults: {
    stylePrefs: string[];
    useProfile: boolean;
    includeAccessories: boolean;
  };
};
