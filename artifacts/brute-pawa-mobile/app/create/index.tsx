import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_H = SCREEN_H * 0.88;

// ─── Design tokens ───────────────────────────────────────────────
const T = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  primary: "#22C55E",
  primaryDark: "#16A34A",
  text: "#111827",
  textSec: "#6B7280",
  border: "#E5E7EB",
  radius: 28,
};

// ─── Create items ─────────────────────────────────────────────────
const ITEMS = [
  {
    key: "post",
    title: "Publier un post",
    desc: "Partagez vos idées, actualités et\nmoments avec la communauté.",
    icon: "document-text",
    iconColor: "#22C55E",
    iconBg: "#DCFCE7",
    arrowBg: "#22C55E",
    badge: { label: "Populaire", emoji: "🔥", color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
    cardBg: "#F0FDF4",
    cardBorder: "#BBF7D0",
    route: "/create/post",
  },
  {
    key: "product",
    title: "Vendre un produit",
    desc: "Proposez vos produits à des millions\nd'utilisateurs.",
    icon: "bag-handle",
    iconColor: "#F97316",
    iconBg: "#FFEDD5",
    arrowBg: "#F97316",
    badge: { label: "Recommandé", emoji: "⭐", color: "#F97316", bg: "#FFF7ED", border: "#FED7AA" },
    cardBg: "#FFFFFF",
    cardBorder: "#E5E7EB",
    route: "/create/product",
  },
  {
    key: "service",
    title: "Publier un service",
    desc: "Faites connaître vos services et\ndéveloppez votre activité.",
    icon: "construct",
    iconColor: "#3B82F6",
    iconBg: "#DBEAFE",
    arrowBg: "#3B82F6",
    badge: null,
    cardBg: "#FFFFFF",
    cardBorder: "#E5E7EB",
    route: "/create/service",
  },
  {
    key: "group",
    title: "Créer un groupe",
    desc: "Rassemblez des personnes autour\nd'intérêts communs.",
    icon: "people",
    iconColor: "#06B6D4",
    iconBg: "#CFFAFE",
    arrowBg: "#06B6D4",
    badge: null,
    cardBg: "#FFFFFF",
    cardBorder: "#E5E7EB",
    route: "/create/group",
  },
  {
    key: "job",
    title: "Publier une offre d'emploi",
    desc: "Trouvez les meilleurs talents pour\nvotre entreprise.",
    icon: "briefcase",
    iconColor: "#8B5CF6",
    iconBg: "#EDE9FE",
    arrowBg: "#8B5CF6",
    badge: null,
    cardBg: "#FFFFFF",
    cardBorder: "#E5E7EB",
    route: "/create/job",
  },
  {
    key: "course",
    title: "Créer une formation",
    desc: "Partagez votre savoir et formez des\napprenants.",
    icon: "school",
    iconColor: "#F59E0B",
    iconBg: "#FEF3C7",
    arrowBg: "#F59E0B",
    badge: null,
    cardBg: "#FFFFFF",
    cardBorder: "#E5E7EB",
    route: "/create/course",
  },
];

// ─── Sparkle component ────────────────────────────────────────────
function Sparkle({ x, y, size = 8 }: { x: number; y: number; size?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.Text
      style={{
        position: "absolute", left: x, top: y,
        fontSize: size, color: "#22C55E", opacity,
      }}
    >✦</Animated.Text>
  );
}

// ─── Main screen ──────────────────────────────────────────────────
export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Slide-up on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_H,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => router.back());
  };

  // Drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0, tension: 60, friction: 10, useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const navigate = (route: string) => {
    dismiss();
    setTimeout(() => router.push(route as any), 300);
  };

  return (
    <View style={s.root}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[s.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[s.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 16 }]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.dragArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIconWrap}>
              {/* Gradient circle with "+" */}
              <View style={s.headerIcon}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </View>
              <Sparkle x={-4} y={-4} size={9} />
              <Sparkle x={36} y={2} size={6} />
              <Sparkle x={-2} y={36} size={7} />
            </View>
            <View>
              <Text style={s.headerTitle}>Créer</Text>
              <Text style={s.headerSub}>Choisissez ce que vous voulez créer</Text>
            </View>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={dismiss} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Cards */}
          {ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[
                s.card,
                { backgroundColor: item.cardBg, borderColor: item.cardBorder },
              ]}
              onPress={() => navigate(item.route)}
              activeOpacity={0.8}
            >
              {/* Icon */}
              <View style={[s.iconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon as any} size={28} color={item.iconColor} />
              </View>

              {/* Text block */}
              <View style={s.cardBody}>
                {/* Badge */}
                {item.badge && (
                  <View style={[s.badge, { backgroundColor: item.badge.bg, borderColor: item.badge.border }]}>
                    <Text style={s.badgeEmoji}>{item.badge.emoji}</Text>
                    <Text style={[s.badgeText, { color: item.badge.color }]}>{item.badge.label}</Text>
                  </View>
                )}
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.cardDesc}>{item.desc}</Text>
              </View>

              {/* Arrow */}
              <View style={[s.arrow, { backgroundColor: item.arrowBg }]}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ))}

          {/* Security footer */}
          <View style={s.securityCard}>
            {/* Shield icon */}
            <View style={s.securityIcon}>
              <Ionicons name="shield-checkmark" size={36} color="#22C55E" />
            </View>
            <View style={s.securityText}>
              <View style={s.securityTitleRow}>
                <Text style={s.securityTitle}>100% sécurisé</Text>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" style={{ marginLeft: 4 }} />
              </View>
              <Text style={s.securityDesc}>
                Vos données sont protégées{"\n"}avec le plus haut niveau de sécurité.
              </Text>
            </View>
            {/* Decorative lock illustration */}
            <View style={s.lockIllustration}>
              <View style={s.lockBody}>
                <Ionicons name="lock-closed" size={32} color="#22C55E" />
              </View>
              <View style={s.lockGlow} />
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    height: SHEET_H,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
  },
  dragArea: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  headerIconWrap: {
    width: 52,
    height: 52,
    position: "relative",
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  headerSub: {
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  // Cards list
  scroll: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 88,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    marginBottom: 4,
    gap: 3,
  },
  badgeEmoji: {
    fontSize: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: 13,
    color: "#6B7280",
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginTop: 3,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  // Security footer
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  securityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  securityText: {
    flex: 1,
  },
  securityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#16A34A",
    fontFamily: "Inter_700Bold",
  },
  securityDesc: {
    fontSize: 12,
    color: "#6B7280",
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: 2,
  },
  lockIllustration: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexShrink: 0,
  },
  lockBody: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  lockGlow: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#22C55E",
    opacity: 0.12,
    transform: [{ scale: 1.4 }],
  },
});
