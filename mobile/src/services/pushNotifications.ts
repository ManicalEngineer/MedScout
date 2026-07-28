import { Platform } from 'react-native';

// expo-notifications binds its native module (ExpoPushTokenManager) as soon
// as it's imported, not just when its functions are called — a static
// top-level `import` would crash the whole app if this dev client was built
// before the module was added. Deferring to a lazy `require()` inside each
// try/catch means the crash only happens (and is caught) at actual point of
// use, not at bundle load.
function loadNotifications(): typeof import('expo-notifications') | null {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function loadConstants(): typeof import('expo-constants').default | null {
  try {
    return require('expo-constants').default;
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(Notifications: NonNullable<ReturnType<typeof loadNotifications>>) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Without this, iOS/Android drop notifications silently while the app is in
 * the foreground — expo-notifications only shows system banners by default
 * when the app is backgrounded or closed. Safe to call once at app start. */
export function configureForegroundNotifications(): void {
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // no-op — native module not compiled into this build
  }
}

/** Requests permission (prompts the user) and returns an Expo push token, or
 * null if denied/unavailable (e.g. simulator, or native module not yet
 * compiled into this build). */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const Notifications = loadNotifications();
    const Constants = loadConstants();
    if (!Notifications || !Constants) return null;

    await ensureAndroidChannel(Notifications);

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/** Silent — only refreshes the token if permission was already granted, never
 * prompts. Safe to call on every app launch to catch token rotation. */
export async function refreshPushTokenIfPermitted(): Promise<string | null> {
  try {
    const Notifications = loadNotifications();
    const Constants = loadConstants();
    if (!Notifications || !Constants) return null;

    await ensureAndroidChannel(Notifications);
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/** Whether the OS permission prompt has never been shown yet — used to decide
 * whether it's safe to prompt in a given context without re-asking someone
 * who already said no (which the OS won't re-prompt for anyway). */
export async function isPushPermissionUndetermined(): Promise<boolean> {
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return false;
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'undetermined';
  } catch {
    return false;
  }
}
