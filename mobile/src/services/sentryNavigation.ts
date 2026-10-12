import * as Sentry from '@sentry/react-native';

// Shared between App.tsx (registered with Sentry.init) and AppNavigator.tsx
// (registered with the NavigationContainer) so hang/crash events carry the
// active screen name instead of only raw UIKit view-controller breadcrumbs.
export const navigationIntegration = Sentry.reactNavigationIntegration();
