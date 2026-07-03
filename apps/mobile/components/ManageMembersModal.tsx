import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../theme/ThemeProvider';
import { api, getApiErrorMessage, type GroupMember } from '../services/api';
import { pickContactWithEmail } from '../services/contacts';
import { copyGroupInviteCode, copyGroupInviteLink, shareGroupInvite } from '../services/invite';
import { confirm } from '../utils/confirm';
import { AppButton, AppTextInput, Avatar, Pill } from './ui';

interface ManageMembersModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  members: GroupMember[];
  onClose: () => void;
  onUpdated: () => void;
  onLeft?: () => void;
}

export function ManageMembersModal({
  visible,
  groupId,
  groupName,
  members,
  onClose,
  onUpdated,
  onLeft,
}: ManageMembersModalProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [memberEmail, setMemberEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.users.me(), enabled: visible });

  const { data: invite, refetch: refetchInvite } = useQuery({
    queryKey: ['groupInvite', groupId],
    queryFn: () => api.groups.getInvite(groupId),
    enabled: visible && !!groupId,
  });

  const memberId = (m: GroupMember) => m.userId ?? m.user.id;
  const isCurrentUserAdmin = members.some((m) => memberId(m) === profile?.id && m.role === 'admin');

  const handleRoleChange = async (targetUserId: string, role: 'admin' | 'member') => {
    setRoleUpdatingId(targetUserId);
    setError('');
    try {
      await api.groups.updateMemberRole(groupId, targetUserId, role);
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.groups.addMember(groupId, memberEmail.trim());
      setMemberEmail('');
      onUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (targetId: string, targetName: string, isSelf: boolean) => {
    const title = isSelf ? 'Leave group?' : `Remove ${targetName}?`;
    const message = isSelf
      ? `You will lose access to "${groupName}". You can rejoin with an invite link.`
      : `${targetName} will be removed from "${groupName}".`;

    const doRemove = () => {
      setRemovingId(targetId);
      setError('');
      api.groups.removeMember(groupId, targetId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['groups'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          if (isSelf) {
            onLeft?.();
          } else {
            onUpdated();
          }
        })
        .catch((e: unknown) => setError(getApiErrorMessage(e)))
        .finally(() => setRemovingId(null));
    };

    confirm(title, message, doRemove);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.background.elevated }]}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.hairline }]} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.display }]}>
              Members
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
              {groupName}
            </Text>

            <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
              Invite others
            </Text>
            <Text style={[styles.hint, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.body }]}>
              Share the invite code or link so others can join this group.
            </Text>
            {invite ? (
              <LinearGradient colors={theme.colors.gradient.brandVibrant} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inviteBox}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: theme.typography.fontFamily.medium }}>Invite code</Text>
                <Text style={[styles.inviteCode, { color: '#FFFFFF', fontFamily: theme.typography.fontFamily.displayExtra }]}>{invite.inviteCode}</Text>
                <View style={styles.qrWrap}>
                  <QRCode value={invite.link} size={140} backgroundColor="#FFFFFF" color="#1B1B3A" />
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 10, fontFamily: theme.typography.fontFamily.body }}>
                    Scan to join this group
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  <Pressable
                    style={styles.frostedBtn}
                    onPress={async () => {
                      const code = await copyGroupInviteCode(groupId);
                      if (Platform.OS === 'web') window.alert(`Invite code ${code} copied!`);
                      else Alert.alert('Copied', `Invite code ${code} copied to clipboard`);
                    }}
                  >
                    <Ionicons name="copy-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.frostedBtnText}>Code</Text>
                  </Pressable>
                  <Pressable
                    style={styles.frostedBtn}
                    onPress={async () => {
                      await copyGroupInviteLink(groupId);
                      if (Platform.OS === 'web') window.alert('Invite link copied!');
                      else Alert.alert('Copied', 'Invite link copied to clipboard');
                    }}
                  >
                    <Ionicons name="link-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.frostedBtnText}>Link</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.frostedBtn, { backgroundColor: '#FFFFFF' }]}
                    onPress={() => shareGroupInvite(groupId)}
                  >
                    <Ionicons name="share-social-outline" size={15} color={theme.colors.accent.primaryDark} />
                    <Text style={[styles.frostedBtnText, { color: theme.colors.accent.primaryDark }]}>Share</Text>
                  </Pressable>
                </View>
                {isCurrentUserAdmin ? (
                  <Pressable
                    disabled={inviteLoading}
                    onPress={() => {
                      confirm(
                        'Regenerate invite code?',
                        'The old code and link will stop working. Anyone with the new code can join.',
                        async () => {
                          setInviteLoading(true);
                          setError('');
                          try {
                            await api.groups.regenerateInvite(groupId);
                            refetchInvite();
                          } catch (e) {
                            setError(getApiErrorMessage(e));
                          } finally {
                            setInviteLoading(false);
                          }
                        },
                      );
                    }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: theme.typography.fontFamily.medium, marginTop: 12 }}>
                      {inviteLoading ? 'Regenerating…' : '↻ Regenerate invite code'}
                    </Text>
                  </Pressable>
                ) : null}
              </LinearGradient>
            ) : (
              <ActivityIndicator color={theme.colors.accent.primary} style={{ marginBottom: 12 }} />
            )}

            <Text style={[styles.label, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>Members</Text>
            <View style={styles.memberList}>
              {members.map((m) => {
                const uid = memberId(m);
                const isAdmin = m.role === 'admin';
                const isSelf = uid === profile?.id;
                return (
                  <View key={uid} style={[styles.memberChip, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.hairline }]}>
                    <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={38} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }}>
                          {m.user.name}{isSelf ? ' (you)' : ''}
                        </Text>
                        {isAdmin ? <Pill label="Admin" tone="brand" /> : null}
                      </View>
                    </View>
                    {removingId === uid ? (
                      <ActivityIndicator color={theme.colors.accent.danger} size="small" />
                    ) : roleUpdatingId === uid ? (
                      <ActivityIndicator color={theme.colors.accent.primary} size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {isCurrentUserAdmin && !isSelf ? (
                          <Pressable
                            hitSlop={8}
                            onPress={() => handleRoleChange(uid, isAdmin ? 'member' : 'admin')}
                            style={[styles.roleBtn, { borderColor: theme.colors.border.hairline }]}
                          >
                            <Text style={{ color: theme.colors.accent.primary, fontSize: 11, fontFamily: theme.typography.fontFamily.medium }}>
                              {isAdmin ? '−Admin' : '+Admin'}
                            </Text>
                          </Pressable>
                        ) : null}
                        {(isCurrentUserAdmin && !isSelf) || isSelf ? (
                          <Pressable
                            hitSlop={8}
                            onPress={() => handleRemoveMember(uid, m.user.name, isSelf)}
                            style={[styles.roleBtn, { borderColor: theme.colors.accent.danger + '55' }]}
                          >
                            <Text style={{ color: theme.colors.accent.danger, fontSize: 11, fontFamily: theme.typography.fontFamily.medium }}>
                              {isSelf ? 'Leave' : 'Remove'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {isCurrentUserAdmin ? (
              <>
                <AppTextInput
                  label="Add member by email"
                  icon="mail-outline"
                  placeholder="email@example.com"
                  value={memberEmail}
                  onChangeText={setMemberEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  rightSlot={
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        const contact = await pickContactWithEmail();
                        if (contact?.email) setMemberEmail(contact.email);
                      }}
                    >
                      <Ionicons name="people-outline" size={20} color={theme.colors.accent.primary} />
                    </Pressable>
                  }
                />
                <AppButton label="Add member" icon="person-add-outline" variant="secondary" loading={loading} onPress={handleAddMember} fullWidth style={{ marginTop: 10 }} />
              </>
            ) : null}

            {error ? <Text style={{ color: theme.colors.accent.danger, marginTop: 12, fontFamily: theme.typography.fontFamily.body }}>{error}</Text> : null}

            <AppButton label="Done" size="lg" onPress={onClose} fullWidth style={{ marginTop: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '88%' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 8, marginTop: 16 },
  hint: { fontSize: 12.5, marginBottom: 12, lineHeight: 18 },
  memberList: { gap: 8, marginBottom: 4 },
  memberChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 10, borderWidth: StyleSheet.hairlineWidth },
  roleBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 6 },
  inviteBox: { borderRadius: 20, padding: 18, marginBottom: 8, overflow: 'hidden' },
  inviteCode: { fontSize: 28, letterSpacing: 3, marginTop: 4, marginBottom: 14 },
  qrWrap: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, paddingVertical: 16, marginBottom: 14 },
  inviteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frostedBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  frostedBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
