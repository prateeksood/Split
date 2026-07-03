import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { api, getApiErrorMessage } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME = 'split';
const OAUTH_PATH = 'oauthredirect';
const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.kunkshi.split';

/** Google native redirect: com.googleusercontent.apps.<id>:/oauth2redirect */
function googleNativeRedirectUri(clientId: string): string {
  const prefix = clientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${prefix}:/oauth2redirect`;
}

export type GoogleAuthTokens = { accessToken: string; refreshToken: string };

interface GoogleSignInButtonProps {
  onIdToken?: (idToken: string) => void;
  onTokens?: (tokens: GoogleAuthTokens) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

function extractIdToken(response: AuthSession.AuthSessionResult | null): string | null {
  if (response?.type !== 'success') return null;
  const fromAuth = response.authentication?.idToken;
  if (fromAuth) return fromAuth;
  const fromParams = response.params?.id_token;
  if (typeof fromParams === 'string' && fromParams.length > 0) return fromParams;
  return null;
}

function isAwaitingCodeExchange(response: AuthSession.AuthSessionResult | null): boolean {
  return (
    response?.type === 'success' &&
    typeof response.params?.code === 'string' &&
    response.params.code.length > 0 &&
    !extractIdToken(response)
  );
}

function ConfigNotice({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline }]}>
      <Ionicons name="information-circle-outline" size={18} color={theme.colors.text.secondary} />
      <Text style={[styles.noticeText, { color: theme.colors.text.secondary }]}>{message}</Text>
    </View>
  );
}

/** Guard config before useIdTokenAuthRequest (throws if androidClientId missing on Android). */
export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

  if (!webClientId) return null;
  if (Platform.OS === 'android' && !androidClientId) {
    return <ConfigNotice message="Google Sign-In is not configured for Android. Rebuild with EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID." />;
  }
  if (Platform.OS === 'ios' && !iosClientId) {
    return <ConfigNotice message="Google Sign-In is not configured for iOS. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID." />;
  }

  return (
    <GoogleSignInButtonInner
      {...props}
      webClientId={webClientId}
      iosClientId={iosClientId}
      androidClientId={androidClientId}
    />
  );
}

function GoogleSignInButtonInner({
  onIdToken,
  onTokens,
  onError,
  disabled,
  webClientId,
  iosClientId,
  androidClientId,
}: GoogleSignInButtonProps & {
  webClientId: string;
  iosClientId?: string;
  androidClientId?: string;
}) {
  const theme = useTheme();
  const handledResponseRef = useRef<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  const isExpoGo =
    Platform.OS !== 'web' &&
    (Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Constants.appOwnership === 'expo');

  // On Android, let the hook derive the redirect URI from androidClientId automatically
  // (reverse client ID scheme: com.googleusercontent.apps.XXXXX:/oauth2redirect).
  // The intent filter in app.json registers this scheme so Android routes it back to the app.
  const redirectUri = useMemo(() => {
    if (Platform.OS === 'android' && androidClientId) {
      return googleNativeRedirectUri(androidClientId);
    }
    return AuthSession.makeRedirectUri({ scheme: APP_SCHEME, path: OAUTH_PATH });
  }, [androidClientId]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId,
      iosClientId: iosClientId || undefined,
      androidClientId: androidClientId || undefined,
      redirectUri,
    },
  );

  useEffect(() => {
    console.info('[Google OAuth] redirect URI:', redirectUri);
    if (Platform.OS === 'android') {
      console.info('[Google OAuth] Android package:', ANDROID_PACKAGE);
    }
  }, [redirectUri]);

  useEffect(() => {
    if (!response || isAwaitingCodeExchange(response)) return;

    const responseKey = JSON.stringify({
      type: response.type,
      code: response.type === 'success' ? response.params?.code : undefined,
      idToken: extractIdToken(response),
      error: response.type === 'error' ? response.error?.message : undefined,
    });
    if (handledResponseRef.current === responseKey) return;

    const complete = async () => {
      if (response.type === 'success') {
        const idToken = extractIdToken(response);
        if (idToken) {
          handledResponseRef.current = responseKey;
          onIdToken?.(idToken);
          return;
        }

        const code = response.params?.code;
        if (typeof code === 'string' && code.length > 0 && request?.codeVerifier) {
          if (!onTokens) {
            onError('Google sign-in requires server code exchange but onTokens handler is missing');
            return;
          }
          handledResponseRef.current = responseKey;
          setExchanging(true);
          try {
            const tokens = await api.auth.googleCode({
              code,
              redirectUri,
              codeVerifier: request.codeVerifier,
            });
            onTokens(tokens);
          } catch (e) {
            onError(getApiErrorMessage(e));
          } finally {
            setExchanging(false);
          }
          return;
        }

        onError('Google did not return an ID token. Try again or use email/password.');
        return;
      }

      if (response.type === 'error') {
        handledResponseRef.current = responseKey;
        const message = response.error?.message ?? 'Google sign-in failed';
        if (message.includes('redirect_uri_mismatch')) {
          onError(
            'Redirect URI mismatch. For web: add https://your-domain.com/oauthredirect to the Web client. Android uses the Android OAuth client (package + SHA-1), not custom redirect URIs.',
          );
        } else if (message.includes('invalid_request') || message.includes('OAuth 2.0 policy')) {
          onError(
            `Google OAuth policy error. Fix in Google Cloud: (1) Android client → package ${ANDROID_PACKAGE} + EAS SHA-1, (2) OAuth consent screen → add your Gmail as test user if in Testing mode. Do not add split:// URIs to the Web client.`,
          );
        } else {
          onError(message);
        }
      }
    };

    void complete();
  }, [response, onIdToken, onTokens, onError, redirectUri, request?.codeVerifier]);

  if (isExpoGo) {
    return <ConfigNotice message="Google Sign-In does not work in Expo Go. Use an EAS build or test on web." />;
  }

  const busy = disabled || exchanging || !request;

  return (
    <Pressable
      style={[
        styles.button,
        {
          backgroundColor: theme.colors.background.secondary,
          borderColor: theme.colors.border.hairline,
          opacity: busy ? 0.6 : 1,
        },
      ]}
      onPress={() => {
        handledResponseRef.current = null;
        promptAsync();
      }}
      disabled={busy}
    >
      {request && !exchanging ? (
        <>
          <Ionicons name="logo-google" size={20} color={theme.colors.text.primary} />
          <Text style={[styles.text, { color: theme.colors.text.primary }]}>Continue with Google</Text>
        </>
      ) : (
        <ActivityIndicator color={theme.colors.text.primary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  text: { fontSize: 16, fontWeight: '600' },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
