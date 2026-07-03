import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './ui';

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export function QRScanner({ visible, onClose, onScan }: QRScannerProps) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  const close = () => {
    setScanned(false);
    onClose();
  };

  const isWeb = Platform.OS === 'web';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} onShow={() => setScanned(false)}>
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        {isWeb ? (
          <Centered theme={theme} icon="qr-code-outline" title="Scanning isn't available on web" message="Open the app on your phone to scan a QR code, or paste the invite code instead." onClose={close} />
        ) : !permission ? (
          <Centered theme={theme} icon="camera-outline" title="Preparing camera…" onClose={close} />
        ) : !permission.granted ? (
          <Centered
            theme={theme}
            icon="camera-outline"
            title="Camera access needed"
            message="Allow camera access to scan a group invite QR code."
            actionLabel="Grant access"
            onAction={requestPermission}
            onClose={close}
          />
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScanned}
            />
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.frame} />
              <Text style={styles.hint}>Point your camera at a group QR code</Text>
            </View>
            <Pressable style={[styles.closeBtn, { top: 48 }]} onPress={close} hitSlop={10}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

function Centered({
  theme,
  icon,
  title,
  message,
  actionLabel,
  onAction,
  onClose,
}: {
  theme: ReturnType<typeof useTheme>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={44} color="#FFFFFF" />
      <Text style={[styles.centeredTitle, { fontFamily: theme.typography.fontFamily.display }]}>{title}</Text>
      {message ? <Text style={styles.centeredMsg}>{message}</Text> : null}
      {actionLabel ? <AppButton label={actionLabel} onPress={onAction} style={{ marginTop: 20, paddingHorizontal: 24 }} /> : null}
      <Pressable onPress={onClose} style={{ marginTop: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  hint: { color: '#FFFFFF', marginTop: 24, fontSize: 15 },
  closeBtn: { position: 'absolute', right: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centeredTitle: { color: '#FFFFFF', fontSize: 18, marginTop: 16, textAlign: 'center' },
  centeredMsg: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
