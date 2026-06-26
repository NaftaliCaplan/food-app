import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ClothesCheckerScreen } from '../screens/ClothesCheckerScreen';
import { ClothesResultsScreen } from '../screens/ClothesResultsScreen';
import { FoodCheckerScreen } from '../screens/FoodCheckerScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
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
      <Stack.Screen name="ClothesChecker" component={ClothesCheckerScreen} />
      <Stack.Screen name="ClothesResults" component={ClothesResultsScreen} />
    </Stack.Navigator>
  );
}
