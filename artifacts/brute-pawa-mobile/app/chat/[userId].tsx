import { Ionicons } from "@expo/vector-icons";
import {
  useGetConversation,
  useSendMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [message, setMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const targetId = parseInt(userId ?? "0", 10);

  const messagesQuery = useGetConversation(targetId, { query: {} });
  const messages = (messagesQuery.data ?? []) as any[];

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

  function timeLabel(date: string) {
    const d = new Date(date);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  const topPadding = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.headerAvatarText, { color: colors.primaryForeground }]}>
            U
          </Text>
        </View>
        <Text style={[styles.headerName, { color: colors.foreground }]}>
          Utilisateur #{userId}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => String(item.id)}
          inverted
          renderItem={({ item }) => {
            const isMe = item.fromUserId === user?.id;
            return (
              <View style={[styles.msgRow, isMe ? styles.msgRight : styles.msgLeft]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isMe ? colors.primary : colors.card,
                      borderColor: colors.border,
                    },
                    isMe ? styles.bubbleMe : styles.bubbleOther,
                  ]}
                >
                  <Text style={[styles.msgText, { color: isMe ? "#fff" : colors.foreground }]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.msgTime, { color: isMe ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                    {timeLabel(item.createdAt)}
                  </Text>
                </View>
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

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, isWeb ? 34 : 8),
            },
          ]}
        >
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
            style={[
              styles.sendBtn,
              { backgroundColor: message.trim() ? colors.primary : colors.muted },
            ]}
            onPress={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
          >
            <Ionicons
              name="send"
              size={18}
              color={message.trim() ? "#fff" : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  headerName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  msgLeft: { justifyContent: "flex-start" },
  msgRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  bubbleMe: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
    borderWidth: 0,
  },
  bubbleOther: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  msgTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    alignSelf: "flex-end",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
