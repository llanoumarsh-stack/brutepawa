import { Ionicons } from "@expo/vector-icons";
import {
  useGetConversation,
  useGetUser,
  useSendMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const AVATAR_COLORS = [
  "#22C55E","#EC4899","#8B5CF6","#D97706","#388E3C","#00838F","#D32F2F","#0EA5E9","#F59E0B",
];
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import BrutePawaChatWallpaper from "@/components/BrutePawaChatWallpaper";
import { API_BASE_URL } from "@/constants/api";

/* ─────────────────────────────────────────────────────────────
   PIXEL NOISE DISINTEGRATION
   Telegram-style static effect before message disappears.
   Grid of small black/white squares that fade in, hold, then
   the whole message fades out.
───────────────────────────────────────────────────────────── */
const STATIC_COLORS = [
  "#000000","#000000","#000000","#0a0a0a","#111111","#0d0d0d",
  "#1a1a1a","#222222","#050505","#181818","#080808","#2a2a2a",
  "#ffffff","#f5f5f5","#cccccc","#888888",
];
const PX = 8; // pixel cell size

function PixelNoiseOverlay({
  width,
  height,
  onComplete,
}: {
  width: number;
  height: number;
  onComplete: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cols = Math.ceil(width  / PX);
  const rows = Math.ceil(height / PX);

  const pixels = useMemo(() =>
    Array.from({ length: cols * rows }, (_, i) => ({
      key: i,
      left: (i % cols) * PX,
      top: Math.floor(i / cols) * PX,
      color: STATIC_COLORS[Math.floor(Math.random() * STATIC_COLORS.length)],
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cols, rows],
  );

  useEffect(() => {
    Animated.sequence([
      // Phase 1: noise appears quickly
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      // Phase 2: hold
      Animated.delay(300),
      // Phase 3: dissolve
      Animated.timing(opacity, { toValue: 0, duration: 340, useNativeDriver: true }),
    ]).start(() => onCompleteRef.current());
  }, []); // eslint-disable-line

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { opacity, borderRadius: 18, overflow: "hidden" },
      ]}
      pointerEvents="none"
    >
      {pixels.map(px => (
        <View
          key={px.key}
          style={{
            position: "absolute",
            left: px.left,
            top: px.top,
            width: PX,
            height: PX,
            backgroundColor: px.color,
          }}
        />
      ))}
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────
   CHAT SCREEN
───────────────────────────────────────────────────────────── */
export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors     = useColors();
  const insets     = useSafeAreaInsets();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [message, setMessage]  = useState("");
  const flatListRef = useRef<FlatList>(null);

  // Local list override for instant delete feedback
  const [localDeleted, setLocalDeleted] = useState<Set<number>>(new Set());
  // Messages currently playing pixel noise animation
  const [pixelMsgs, setPixelMsgs] = useState<Set<number>>(new Set());
  // Bubble layout cache: msgId → { width, height }
  const bubbleSizes = useRef<Map<number, { width: number; height: number }>>(new Map());

  // Context menu
  const [menuMsg, setMenuMsg] = useState<any | null>(null);

  const targetId = parseInt(userId ?? "0", 10);

  // Fetch other user's profile for the header
  const otherUserQuery = useGetUser(targetId, { query: { enabled: targetId > 0 } });
  const otherUser      = otherUserQuery.data as any;
  const otherName      = otherUser
    ? `${otherUser.firstName ?? ""} ${otherUser.lastName ?? ""}`.trim() || `#${targetId}`
    : `…`;
  const otherAvatar    = otherUser?.avatarUrl as string | null | undefined;
  const otherInitials  = otherName !== "…"
    ? otherName.split(" ").slice(0,2).map((w: string) => w[0] ?? "").join("").toUpperCase()
    : "?";

  const messagesQuery = useGetConversation(targetId, { query: {} });
  const rawMessages   = (messagesQuery.data ?? []) as any[];
  const messages      = rawMessages.filter(m => !localDeleted.has(m.id));

  const sendMutation = useSendMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: messagesQuery.queryKey });
        setMessage("");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate({ data: { toUserId: targetId, content: trimmed } });
  }, [message, targetId, sendMutation]);

  /* ── Long-press: open context menu ── */
  const handleLongPress = useCallback((msg: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuMsg(msg);
  }, []);

  /* ── Delete with pixel-noise animation ── */
  const handleDelete = useCallback(async (msg: any) => {
    setMenuMsg(null);

    // Trigger pixel noise
    setPixelMsgs(prev => { const s = new Set(prev); s.add(msg.id); return s; });

    // Call API in background
    if (token) {
      fetch(`${API_BASE_URL}/api/messages/${msg.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {/* silently ignore, local state is source of truth */});
    }
  }, [token]);

  /* When pixel noise finishes → remove message from list */
  const handlePixelComplete = useCallback((msgId: number) => {
    setPixelMsgs(prev => { const s = new Set(prev); s.delete(msgId); return s; });
    setLocalDeleted(prev => { const s = new Set(prev); s.add(msgId); return s; });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  /* ── Copy ── */
  const handleCopy = useCallback(async (msg: any) => {
    setMenuMsg(null);
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(msg.content ?? "");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {/* ignore */}
  }, []);

  function timeLabel(date: string) {
    const d = new Date(date);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  const topPadding = isWeb ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <BrutePawaChatWallpaper />

      {/* ─── Header ─── */}
      <View style={[styles.header, { paddingTop: topPadding, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: AVATAR_COLORS[targetId % AVATAR_COLORS.length] }]}>
          {otherAvatar
            ? <Image source={{ uri: otherAvatar }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            : <Text style={[styles.headerAvatarText, { color: "#fff" }]}>{otherInitials}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
            {otherName}
          </Text>
          {otherUser?.role === "creator" && (
            <Text style={{ fontSize: 11, color: colors.primary, fontFamily: "Inter_500Medium" }}>
              Créateur ✓
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={item => String(item.id)}
          inverted
          renderItem={({ item }) => {
            const isMe       = item.fromUserId === user?.id;
            const isAnimating = pixelMsgs.has(item.id);

            return (
              <View style={[styles.msgRow, isMe ? styles.msgRight : styles.msgLeft]}>
                <Pressable
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={350}
                >
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: isMe ? colors.primary : colors.card,
                        borderColor: colors.border,
                      },
                      isMe ? styles.bubbleMe : styles.bubbleOther,
                    ]}
                    onLayout={e => {
                      const { width, height } = e.nativeEvent.layout;
                      bubbleSizes.current.set(item.id, { width, height });
                    }}
                  >
                    <Text style={[styles.msgText, { color: isMe ? "#fff" : colors.foreground }]}>
                      {item.content}
                    </Text>
                    <Text style={[styles.msgTime, { color: isMe ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                      {timeLabel(item.createdAt)}
                    </Text>

                    {/* ── Pixel noise overlay ── */}
                    {isAnimating && (() => {
                      const sz = bubbleSizes.current.get(item.id);
                      if (!sz) return null;
                      return (
                        <PixelNoiseOverlay
                          key={`pn-${item.id}`}
                          width={sz.width}
                          height={sz.height}
                          onComplete={() => handlePixelComplete(item.id)}
                        />
                      );
                    })()}
                  </View>
                </Pressable>
              </View>
            );
          }}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            messagesQuery.isLoading ? null : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Aucun message. Dites bonjour !
                </Text>
              </View>
            )
          }
        />

        {/* ─── Input bar ─── */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, isWeb ? 34 : 8) }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: message.trim() ? colors.primary : colors.muted }]}
            onPress={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
          >
            <Ionicons name="send" size={18} color={message.trim() ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Context menu modal ─── */}
      <Modal
        visible={!!menuMsg}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuMsg(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuMsg(null)}>
          <View style={[styles.menuCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
            {/* Message preview */}
            <Text
              style={[styles.menuPreview, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {menuMsg?.content}
            </Text>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Copier */}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleCopy(menuMsg)}>
              <Ionicons name="copy-outline" size={20} color={colors.foreground} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Copier</Text>
            </TouchableOpacity>

            {/* Supprimer — only own messages */}
            {menuMsg?.fromUserId === user?.id && (
              <>
                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.menuItem} onPress={() => handleDelete(menuMsg)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={[styles.menuItemText, { color: "#EF4444" }]}>Supprimer</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Annuler */}
            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuMsg(null)}>
              <Ionicons name="close-outline" size={20} color={colors.mutedForeground} />
              <Text style={[styles.menuItemText, { color: colors.mutedForeground }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#EFF8F1" },
  flex:        { flex: 1, backgroundColor: "transparent" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  backBtn:          { padding: 4 },
  headerAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  headerName:       { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1 },
  messageList:      { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexGrow: 1, justifyContent: "flex-end" },
  msgRow:    { flexDirection: "row", marginBottom: 6 },
  msgLeft:   { justifyContent: "flex-start" },
  msgRight:  { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth, gap: 3,
  },
  bubbleMe:    { borderRadius: 18, borderBottomRightRadius: 4, borderWidth: 0 },
  bubbleOther: { borderRadius: 18, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  msgTime: { fontSize: 11, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  input: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, fontFamily: "Inter_400Regular", maxHeight: 120,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  empty:     { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  /* ── Context menu ── */
  menuOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  menuCard: {
    width: 280, borderRadius: 16,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 24,
    elevation: 12, overflow: "hidden",
  },
  menuPreview: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    paddingHorizontal: 18, paddingVertical: 14,
    lineHeight: 18,
  },
  menuDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  menuItemText: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
