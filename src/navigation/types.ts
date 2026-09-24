import { WardrobeItem } from '../types/wardrobe';

export type RootStackParamList = {
  Home: undefined;
  FoodChecker: undefined;
  Results: {
    photoUri: string;
    foodLabel: string;
  };
  SelfieCheck: undefined;
  SelfieCheckResults: {
    photoUri: string;
    useProfile: boolean;
  };
  Wardrobe: undefined;
  SavedOutfits: undefined;
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
    temperatureF: number;
  };
};
