import React, { useEffect, useState, useRef } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Keyboard,
  InteractionManager,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import {
  Text,
  Avatar,
  ActivityIndicator,
  TextInput,
  IconButton,
  useTheme,
  Appbar,
  Button,
  Searchbar,
  List,
  Divider,
} from "react-native-paper";
import { useSelector } from "react-redux";
import { RootState } from "../../src/store";
import { supabase } from "../../src/services/supabase";
import { useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme as useAppTheme } from "../../src/context/ThemeContext";

interface User {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

export default function GroupChatRoomScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useSelector((state: RootState) => state.auth);
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const theme = useTheme();
  const { isDarkTheme } = useAppTheme();
  const [inputHeight, setInputHeight] = useState(40); // 1 line default
  const MAX_INPUT_HEIGHT = 40 * 4; // 4 lines

  // Fetch group info
  const fetchGroup = async () => {
    try {
      const { data, error } = await supabase
        .from("group_chats")
        .select("id, name, description, image_url, created_by")
        .eq("id", id)
        .single();
      if (error) throw error;
      setGroup(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Fetch members
  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("group_chat_members")
        .select("user_id, role")
        .eq("group_chat_id", id);
      if (error) throw error;
      if (!data || data.length === 0) {
        setMembers([]);
        return;
      }
      // Fetch user info
      const userIds = data.map((m: any) => m.user_id);
      const { data: users, error: userError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", userIds);
      if (userError) throw userError;
      // Map members to user info
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));
      setMembers(
        data.map((m: any) => ({
          ...m,
          user: userMap.get(m.user_id) || {
            id: m.user_id,
            name: "Unknown",
            avatar_url: null,
          },
        }))
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("group_chat_messages")
        .select("id, content, created_at, sender_id")
        .eq("group_chat_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        setMessages([]);
        return;
      }
      // Fetch sender info
      const senderIds = [...new Set(data.map((msg: any) => msg.sender_id))];
      const { data: senders, error: senderError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", senderIds);
      if (senderError) throw senderError;
      const senderMap = new Map((senders || []).map((s: any) => [s.id, s]));
      setMessages(
        data.map((msg: any) => ({
          ...msg,
          sender: senderMap.get(msg.sender_id) || {
            id: msg.sender_id,
            name: "Unknown",
            avatar_url: null,
          },
        }))
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Real-time subscription
  useEffect(() => {
    let isMounted = true;
    if (!user?.id || !id) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchGroup(), fetchMembers(), fetchMessages()]).finally(() =>
      setLoading(false)
    );
    // Subscribe to new messages
    const channel = supabase
      .channel(`group_chat:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_chat_messages",
          filter: `group_chat_id=eq.${id}`,
        },
        async (payload) => {
          const newMessage = payload.new;
          // Fetch sender info
          const { data: sender } = await supabase
            .from("profiles")
            .select("id, name, avatar_url")
            .eq("id", newMessage.sender_id)
            .single();
          if (!isMounted) return;
          setMessages((prev) => [
            ...prev,
            {
              ...newMessage,
              sender: sender || {
                id: newMessage.sender_id,
                name: "Unknown",
                avatar_url: null,
              },
            },
          ]);
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            100
          );
        }
      )
      .subscribe();
    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user, id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100
      );
    }
  }, [messages]);

  // Scroll to bottom when keyboard appears (with viewPosition)
  useEffect(() => {
    const event =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToIndex({
            index: messages.length - 1,
            animated: true,
            viewPosition: 0.2,
          });
        }
      }, 100);
    });
    return () => sub.remove();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !id) return;
    try {
      const { error } = await supabase.from("group_chat_messages").insert({
        group_chat_id: id,
        sender_id: user.id,
        content: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Helper to format date separators
  function formatDateSeparator(dateString: string) {
    const date = new Date(dateString);
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      return `Today ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.error }}>{error}</Text>
      </View>
    );
  }
  if (!group) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.onBackground }}>
          Group chat not found.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Appbar.Header
        style={{
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outline,
        }}
      >
        <Appbar.BackAction onPress={() => router.back()} />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            height: "100%",
          }}
        >
          <TouchableOpacity
            onPress={() => router.push(`/chat/${id}/details`)}
            style={{ flex: 1 }}
          >
            <Text
              style={{
                color: theme.colors.onBackground,
                fontSize: 20,
                fontWeight: "bold",
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {group.name}
            </Text>
          </TouchableOpacity>
        </View>
      </Appbar.Header>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 24,
            backgroundColor: theme.colors.background,
          }}
          renderItem={({ item, index }) => {
            const isMe = item.sender.id === user?.id;
            const prevMsg = messages[index - 1];
            const showDateSeparator =
              !prevMsg ||
              new Date(prevMsg.created_at).toDateString() !==
                new Date(item.created_at).toDateString();
            return (
              <>
                {showDateSeparator && (
                  <View style={{ alignItems: "center", marginVertical: 8 }}>
                    <Text
                      style={{ color: theme.colors.onSurface, fontSize: 12 }}
                    >
                      {formatDateSeparator(item.created_at)}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.messageRow,
                    {
                      flexDirection: isMe ? "row-reverse" : "row",
                      alignItems: "flex-end",
                    },
                  ]}
                >
                  {!isMe &&
                    (item.sender.avatar_url ? (
                      <Avatar.Image
                        source={{ uri: item.sender.avatar_url }}
                        size={32}
                        style={{
                          marginHorizontal: 6,
                          backgroundColor: theme.colors.surfaceVariant,
                        }}
                      />
                    ) : (
                      <Avatar.Icon
                        icon="account"
                        size={32}
                        style={{
                          marginHorizontal: 6,
                          backgroundColor: theme.colors.surfaceVariant,
                        }}
                        color={theme.colors.onSurface}
                      />
                    ))}
                  <View
                    style={{
                      flexShrink: 1,
                      alignItems: isMe ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isMe && (
                      <Text
                        style={{
                          color: theme.colors.onSurface,
                          fontSize: 13,
                          fontWeight: "600",
                          marginBottom: 2,
                          marginLeft: 4,
                        }}
                      >
                        {item.sender.name}
                      </Text>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        isMe
                          ? {
                              backgroundColor: theme.colors.primary,
                              borderTopRightRadius: 4,
                              marginLeft: 40,
                            }
                          : {
                              backgroundColor: theme.colors.surfaceVariant,
                              borderTopLeftRadius: 4,
                              marginRight: 8,
                            },
                      ]}
                    >
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: isMe
                            ? theme.colors.onPrimary
                            : theme.colors.onSurface,
                          fontSize: 16,
                        }}
                      >
                        {item.content}
                      </Text>
                    </View>
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.onSurface,
                        fontSize: 11,
                        marginTop: 2,
                        alignSelf: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              </>
            );
          }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
              minHeight: 56,
              alignItems: "flex-end",
            },
          ]}
        >
          <IconButton
            icon="plus"
            iconColor={theme.colors.onSurface}
            style={{ marginRight: 2 }}
            onPress={() => {}}
          />
          <View style={{ flex: 1, alignSelf: "stretch" }}>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Aa"
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.onBackground,
                  borderRadius: 12,
                  fontSize: 15,
                  marginRight: 4,
                  minHeight: 40,
                },
              ]}
              contentStyle={{
                textAlignVertical: "center",
                paddingTop: 9,
                paddingBottom: 2,
                justifyContent: "center",
              }}
              mode="flat"
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
              outlineStyle={{ borderRadius: 12, borderWidth: 0 }}
              placeholderTextColor={theme.colors.outline}
              onFocus={() =>
                setTimeout(() => {
                  if (flatListRef.current && messages.length > 0) {
                    flatListRef.current.scrollToIndex({
                      index: messages.length - 1,
                      animated: true,
                      viewPosition: 0.2,
                    });
                  }
                }, 100)
              }
              multiline={true}
              numberOfLines={1}
              autoCorrect={true}
              autoCapitalize="sentences"
              spellCheck={true}
              scrollEnabled={true}
              maxLength={1000}
            />
          </View>
          <IconButton
            icon="camera"
            iconColor={theme.colors.onSurface}
            style={{ marginLeft: 2 }}
            onPress={() => {}}
          />
          <IconButton
            icon="send"
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
            style={{
              marginLeft: 4,
              backgroundColor: theme.colors.primary,
              borderRadius: 24,
            }}
            iconColor={theme.colors.onPrimary}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageRow: {
    marginBottom: 14,
    alignItems: "flex-end",
  },
  bubble: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    maxWidth: "80%",
    minWidth: 44,
    marginBottom: 2,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    padding: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    fontSize: 15,
    marginRight: 4,
    paddingHorizontal: 10,
    paddingVertical: 0,
    minHeight: 40,
    maxHeight: 40,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 20,
    maxHeight: "80%",
    minHeight: 300,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
    overflow: "hidden",
  },
  searchBar: {
    marginBottom: 15,
    borderRadius: 12,
  },
  searchResultsContainer: {
    flex: 1,
    minHeight: 200,
    maxHeight: 400,
  },
  searchResults: {
    flex: 1,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
  },
  noResults: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
    fontStyle: "italic",
  },
});
