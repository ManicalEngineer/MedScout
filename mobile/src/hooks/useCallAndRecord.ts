/**
 * One-tap call + record hook.
 *
 * Behaviour:
 *  1. startCall() — starts audio recording then opens the dialer.
 *  2. While the native phone call is active, iOS interrupts the audio session.
 *     expo-av raises an interruption event; we mark state as 'interrupted'.
 *  3. When the user hangs up and returns to the app, AppState transitions
 *     'background' → 'active'. We then stop/save the recording and invoke
 *     onCallReturned(uri) so the caller can navigate to PostCall.
 *
 * On iOS, audio captured before & after the phone call (speakerphone echo)
 * is recorded; audio *during* the call is not. That's fine — user speaks a
 * brief summary on their way back to the app.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus, Linking, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Recording } from 'expo-av/build/Audio';

export type CallRecordStatus = 'idle' | 'recording' | 'in_call' | 'returning' | 'done' | 'error';

interface UseCallAndRecordOptions {
  onCallReturned: (audioUri: string | null) => void;
}

export function useCallAndRecord({ onCallReturned }: UseCallAndRecordOptions) {
  const [status, setStatus] = useState<CallRecordStatus>('idle');
  const recordingRef = useRef<Recording | null>(null);
  const calledRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Watch for app returning to foreground after a call
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      // Came back from background while a call was in progress
      if (prev === 'background' && next === 'active' && calledRef.current) {
        calledRef.current = false;
        setStatus('returning');
        const uri = await stopRecording();
        setStatus('done');
        onCallReturned(uri);
      }
    });
    return () => sub.remove();
  }, []);

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI() ?? null;
      recordingRef.current = null;
      return uri;
    } catch {
      return null;
    }
  };

  const startCall = useCallback(async (phoneNumber: string) => {
    const num = phoneNumber.replace(/\D/g, '');
    if (!num) { Alert.alert('No phone number', 'This pharmacy has no phone number saved.'); return; }

    // 1. Request mic permission and start recording
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (granted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        recordingRef.current = recording;
        setStatus('recording');
      }
    } catch {
      // No mic — proceed without recording
    }

    // 2. Open dialer (app goes to background)
    calledRef.current = true;
    setStatus('in_call');
    Linking.openURL(`tel:${num}`).catch(() => {
      calledRef.current = false;
      Alert.alert('Could not open dialer', phoneNumber);
    });
  }, []);

  const cancel = useCallback(async () => {
    calledRef.current = false;
    await stopRecording();
    setStatus('idle');
  }, []);

  return { status, startCall, cancel };
}
