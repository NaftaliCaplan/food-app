import { Component, ReactNode } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { AppText } from './AppText';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Class component because React only supports error boundaries via
// componentDidCatch/getDerivedStateFromError — there's no hook equivalent.
// "Try Again" resets local state and re-renders the subtree fresh; it won't
// help if the root cause is still there (the same crash will just recur),
// but it turns a dead screen into something a non-developer tester can
// actually act on, without needing to force-quit the app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Uncaught render error', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <AppText style={styles.title}>[ERROR] Something broke</AppText>
          <AppText style={styles.subtext}>
            Screenshot this screen and let us know what you were doing right before it happened.
          </AppText>
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{error.message || String(error)}</AppText>
          </View>
          <TouchableOpacity style={styles.resetBtn} onPress={this.handleReset}>
            <AppText style={styles.resetBtnText}>Try Again</AppText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.stateError,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    padding: Spacing.md,
    alignSelf: 'stretch',
  },
  errorText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  resetBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    marginTop: Spacing.sm,
  },
  resetBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
