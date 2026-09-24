import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FoodCheckerScreen } from '../screens/FoodCheckerScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { AddItemScreen } from '../screens/AddItemScreen';
import { EditItemScreen } from '../screens/EditItemScreen';
import { OutfitBuilderScreen } from '../screens/OutfitBuilderScreen';
import { OutfitResultsScreen } from '../screens/OutfitResultsScreen';
import { SavedOutfitsScreen } from '../screens/SavedOutfitsScreen';
import { SelfieCheckScreen } from '../screens/SelfieCheckScreen';
import { SelfieCheckResultsScreen } from '../screens/SelfieCheckResultsScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { WardrobeScreen } from '../screens/WardrobeScreen';
import { Colors } from '../theme/colors';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="FoodChecker" component={FoodCheckerScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="SelfieCheck" component={SelfieCheckScreen} />
      <Stack.Screen name="SelfieCheckResults" component={SelfieCheckResultsScreen} />
      <Stack.Screen name="Wardrobe" component={WardrobeScreen} />
      <Stack.Screen name="SavedOutfits" component={SavedOutfitsScreen} />
      <Stack.Screen name="AddItem" component={AddItemScreen} />
      <Stack.Screen name="EditItem" component={EditItemScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="OutfitBuilder" component={OutfitBuilderScreen} />
      <Stack.Screen name="OutfitResults" component={OutfitResultsScreen} />
    </Stack.Navigator>
  );
}
