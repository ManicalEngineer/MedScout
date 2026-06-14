import { useRef, useState, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Recording } from 'expo-av/build/Audio';

export type RecordingStatus = 'idle' | 'recording' | 'stopped' | 'error';

interface UseAudioRecorderReturn {
  status: RecordingStatus;
  uri: string | null;
  durationMs: number;
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const recordingRef = useRef<Recording | null>(null);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [uri, setUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission denied');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setStatus('recording');
      setDurationMs(0);
      setUri(null);

      intervalRef.current = setInterval(() => {
        setDurationMs(d => d + 1000);
      }, 1000);
    } catch (e: any) {
      setStatus('error');
      throw e;
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!recordingRef.current) return null;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const fileUri = recordingRef.current.getURI() ?? null;
      recordingRef.current = null;
      setUri(fileUri);
      setStatus('stopped');
      return fileUri;
    } catch (e: any) {
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    recordingRef.current = null;
    setStatus('idle');
    setUri(null);
    setDurationMs(0);
  }, []);

  return { status, uri, durationMs, start, stop, reset };
}
