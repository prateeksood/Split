import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export interface VoiceInputResult {
  transcript: string;
}

type WebSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string }; isFinal?: boolean }; length: number } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

export async function isVoiceInputAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

export async function listenForSpeech(onPartial?: (text: string) => void): Promise<VoiceInputResult> {
  if (Platform.OS === 'web') {
    return listenWeb(onPartial);
  }
  return listenNative(onPartial);
}

function listenWeb(onPartial?: (text: string) => void): Promise<VoiceInputResult> {
  return new Promise((resolve, reject) => {
    const Win = window as Window & {
      SpeechRecognition?: new () => WebSpeechRecognition;
      webkitSpeechRecognition?: new () => WebSpeechRecognition;
    };
    const SpeechRecognitionCtor = Win.SpeechRecognition ?? Win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      reject(new Error('Speech recognition is not supported in this browser'));
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalTranscript = '';

    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i]?.[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript && onPartial) onPartial(transcript);
      const last = event.results[event.results.length - 1];
      if (last?.[0]?.transcript) finalTranscript = transcript;
      if (last && 'isFinal' in last && last.isFinal) {
        resolve({ transcript: finalTranscript || transcript });
      }
    };

    recognition.onerror = (event) => {
      reject(new Error(event.error || 'Speech recognition failed'));
    };

    recognition.onend = () => {
      resolve({ transcript: finalTranscript });
    };

    recognition.start();
  });
}

function listenNative(onPartial?: (text: string) => void): Promise<VoiceInputResult> {
  return new Promise((resolve, reject) => {
    let transcript = '';
    let settled = false;

    const finish = (value: VoiceInputResult) => {
      if (settled) return;
      settled = true;
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
      resolve(value);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
      reject(new Error(message));
    };

    const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      transcript = event.results.map((r) => r.transcript).join(' ').trim();
      if (transcript && onPartial) onPartial(transcript);
      if (event.isFinal) finish({ transcript });
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      fail(event.error || 'Speech recognition failed');
    });

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      finish({ transcript });
    });

    ExpoSpeechRecognitionModule.requestPermissionsAsync().then((permission) => {
      if (!permission.granted) {
        fail('Microphone permission is required for voice input');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    });
  });
}
