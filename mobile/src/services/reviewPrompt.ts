import * as StoreReview from 'expo-store-review';

/**
 * Ask the OS to show its native in-app review prompt (Android: Google
 * Play's In-App Review API; iOS: SKStoreReviewController) after a good
 * moment -- currently, logging an in-stock call (see PostCallScreen).
 *
 * Deliberately thin: both platforms' APIs already decide internally
 * whether to actually show a dialog (Play limits how often per app per
 * account; Apple caps it to a few times a year), so this doesn't layer on
 * its own "already asked" tracking beyond the one hard rule product wants:
 * never on first launch. Pass `isFirstLaunchSession` from AuthContext.
 *
 * On a closed-test/internal-test Play track install, Play's API may
 * silently no-op (isAvailableAsync() can still return true, but no dialog
 * appears) -- that's expected Play behavior, not a bug here.
 */
export async function maybePromptForReview(isFirstLaunchSession: boolean): Promise<void> {
  if (isFirstLaunchSession) return;
  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    await StoreReview.requestReview();
  } catch {
    // Never let a review-prompt failure surface to the user or interrupt
    // their flow -- this is a nice-to-have, not a critical path.
  }
}
