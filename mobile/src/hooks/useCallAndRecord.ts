/**
 * One-tap call + record hook.
 *
 * Behaviour:
 *  1. startCall() — starts audio recording then opens the dialer.
 *  2. Backgrounding the app to dial (or iOS taking the mic for the actual
 *     phone call) stops that first recording — there is no iOS API for a
 *     third-party app to capture audio during an active cellular call.
 *  3. When the user hangs up and returns to the app, AppState transitions
 *     'background' → 'active'. We discard the (empty) before-call recording
 *     and start a NEW one so the user can speak a summary of the call.
 *  4. The caller must show a "Done" affordance that calls finishSummary()
 *     once the user has said their piece — that stops the summary recording
 *     and invokes onCallReturned(uri) so the caller can navigate to PostCall.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus, Linking, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Recording } from 'expo-av/build/Audio';

// whisper.rn only parses raw PCM WAV (RIFF/WAVE header) — it does not decode
// AAC, so Audio.RecordingOptionsPresets.HIGH_QUALITY (.m4a) fails transcription
// with "Invalid WAV file". iOS can record LPCM WAV directly via MediaRecorder;
// Android's MediaRecorder has no raw-WAV output format, so it stays on AAC here
// (Whisper transcription is a known gap on Android until that's addressed).
const WAV_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export type CallRecordStatus = 'idle' | 'recording' | 'in_call' | 'summarizing' | 'returning' | 'done' | 'error';

interface UseCallAndRecordOptions {
  onCallReturned: (audioUri: string | null) => void;
}

export function useCallAndRecord({ onCallReturned }: UseCallAndRecordOptions) {
  const [status, setStatus] = useState<CallRecordStatus>('idle');
  const recordingRef = useRef<Recording | null>(null);
  const calledRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI() ?? null;
      recordingRef.current = null;
      return uri;
    } catch {
      recordingRef.current = null;
      return null;
    }
  };

  const startRecording = async (): Promise<boolean> => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return false;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        WAV_RECORDING_OPTIONS,
      );
      recordingRef.current = recording;
      return true;
    } catch {
      return false;
    }
  };

  // Watch for app returning to foreground after a call
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      // Came back from background while a call was in progress — the
      // before-call recording is empty/interrupted by the OS, so discard it
      // and start a fresh one for the user's spoken summary.
      if (prev === 'background' && next === 'active' && calledRef.current) {
        await stopRecording();
        const started = await startRecording();
        setStatus(started ? 'summarizing' : 'error');
      }
    });
    return () => sub.remove();
  }, []);

  const startCall = useCallback(async (phoneNumber: string) => {
    const num = phoneNumber.replace(/\D/g, '');
    if (!num) { Alert.alert('No phone number', 'This pharmacy has no phone number saved.'); return; }

    await startRecording();
    setStatus('recording');

    // Open dialer (app goes to background)
    calledRef.current = true;
    setStatus('in_call');
    Linking.openURL(`tel:${num}`).catch(() => {
      calledRef.current = false;
      Alert.alert('Could not open dialer', phoneNumber);
    });
  }, []);

  const finishSummary = useCallback(async () => {
    calledRef.current = false;
    setStatus('returning');
    const uri = await stopRecording();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    setStatus('done');
    onCallReturned(uri);
  }, [onCallReturned]);

  const cancel = useCallback(async () => {
    calledRef.current = false;
    await stopRecording();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    setStatus('idle');
  }, []);

  return { status, startCall, finishSummary, cancel };
}
