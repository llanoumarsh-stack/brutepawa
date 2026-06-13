import { Ionicons } from "@expo/vector-icons";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";

const COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "SN", name: "Sénégal" },
  { code: "BJ", name: "Bénin" },
  { code: "TG", name: "Togo" },
  { code: "BF", name: "Burkina Faso" },
  { code: "ML", name: "Mali" },
  { code: "GN", name: "Guinée" },
  { code: "CM", name: "Cameroun" },
  { code: "NE", name: "Niger" },
  { code: "GH", name: "Ghana" },
];

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [showCountry, setShowCountry] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    country: "CI",
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: async (data) => {
        await signIn(data.token, data.user as AuthUser);
        router.replace("/(tabs)/");
      },
      onError: (err: any) => {
        setError(err?.data?.error ?? err?.message ?? "Identifiants incorrects");
      },
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: async (data) => {
        await signIn(data.token, data.user as AuthUser);
        router.replace("/(tabs)/");
      },
      onError: (err: any) => {
        setError(err?.data?.error ?? err?.message ?? "Erreur lors de l'inscription");
      },
    },
  });

  function handleLogin() {
    setError(null);
    if (!loginForm.email || !loginForm.password) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    loginMutation.mutate({ data: loginForm });
  }

  function handleRegister() {
    setError(null);
    const { firstName, lastName, email, phone, password, country } = registerForm;
    if (!firstName || !lastName || !email || !phone || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    registerMutation.mutate({ data: { firstName, lastName, email, phone, password, country } });
  }

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <Text style={[styles.appName, { color: colors.primary }]}>Brute Pawa</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              L'Afrique connectée
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === "login" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setTab("login"); setError(null); }}
              >
                <Text style={[styles.tabText, { color: tab === "login" ? colors.primary : colors.mutedForeground }]}>
                  Connexion
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === "register" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setTab("register"); setError(null); }}
              >
                <Text style={[styles.tabText, { color: tab === "register" ? colors.primary : colors.mutedForeground }]}>
                  Inscription
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {error && (
                <View style={[styles.errorBox, { backgroundColor: "#FDE8EC", borderColor: "#E41E3F" }]}>
                  <Ionicons name="alert-circle-outline" size={16} color="#E41E3F" />
                  <Text style={[styles.errorText, { color: "#E41E3F" }]}>{error}</Text>
                </View>
              )}

              {tab === "login" ? (
                <>
                  <InputField
                    colors={colors}
                    label="Adresse e-mail"
                    value={loginForm.email}
                    onChangeText={(v) => setLoginForm((f) => ({ ...f, email: v }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    icon="mail-outline"
                  />
                  <InputField
                    colors={colors}
                    label="Mot de passe"
                    value={loginForm.password}
                    onChangeText={(v) => setLoginForm((f) => ({ ...f, password: v }))}
                    secureTextEntry
                    icon="lock-closed-outline"
                  />
                </>
              ) : (
                <>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <InputField
                        colors={colors}
                        label="Prénom"
                        value={registerForm.firstName}
                        onChangeText={(v) => setRegisterForm((f) => ({ ...f, firstName: v }))}
                        icon="person-outline"
                      />
                    </View>
                    <View style={styles.half}>
                      <InputField
                        colors={colors}
                        label="Nom"
                        value={registerForm.lastName}
                        onChangeText={(v) => setRegisterForm((f) => ({ ...f, lastName: v }))}
                        icon="person-outline"
                      />
                    </View>
                  </View>
                  <InputField
                    colors={colors}
                    label="Adresse e-mail"
                    value={registerForm.email}
                    onChangeText={(v) => setRegisterForm((f) => ({ ...f, email: v }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    icon="mail-outline"
                  />
                  <InputField
                    colors={colors}
                    label="Téléphone"
                    value={registerForm.phone}
                    onChangeText={(v) => setRegisterForm((f) => ({ ...f, phone: v }))}
                    keyboardType="phone-pad"
                    icon="call-outline"
                  />

                  <View style={styles.fieldWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Pays</Text>
                    <TouchableOpacity
                      style={[styles.countryBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => setShowCountry((v) => !v)}
                    >
                      <Ionicons name="globe-outline" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.countryText, { color: colors.foreground }]}>
                        {COUNTRIES.find((c) => c.code === registerForm.country)?.name ?? registerForm.country}
                      </Text>
                      <Ionicons name={showCountry ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    {showCountry && (
                      <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {COUNTRIES.map((c) => (
                          <TouchableOpacity
                            key={c.code}
                            style={[
                              styles.dropdownItem,
                              { borderBottomColor: colors.border },
                              registerForm.country === c.code && { backgroundColor: colors.secondary },
                            ]}
                            onPress={() => {
                              setRegisterForm((f) => ({ ...f, country: c.code }));
                              setShowCountry(false);
                            }}
                          >
                            <Text style={[styles.dropdownText, { color: colors.foreground }]}>{c.name}</Text>
                            {registerForm.country === c.code && (
                              <Ionicons name="checkmark" size={16} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <InputField
                    colors={colors}
                    label="Mot de passe"
                    value={registerForm.password}
                    onChangeText={(v) => setRegisterForm((f) => ({ ...f, password: v }))}
                    secureTextEntry
                    icon="lock-closed-outline"
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, isLoading && styles.disabled]}
                onPress={tab === "login" ? handleLogin : handleRegister}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {tab === "login" ? "Se connecter" : "Créer un compte"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function InputField({
  colors,
  label,
  icon,
  ...props
}: {
  colors: any;
  label: string;
  icon: string;
} & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrapper}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          { borderColor: focused ? colors.primary : colors.border, backgroundColor: colors.background },
        ]}
      >
        <Ionicons name={icon as any} size={16} color={colors.mutedForeground} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          placeholderTextColor={colors.mutedForeground}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  logoSection: { alignItems: "center", marginBottom: 28, gap: 8 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#fff" },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
  },
  tabText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  form: { padding: 20, gap: 14 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  fieldWrapper: { gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  inputIcon: {},
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    height: "100%",
  },
  countryBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  countryText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
    zIndex: 10,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  submitBtn: {
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  disabled: { opacity: 0.7 },
});
