import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { FormField } from "@/components/FormField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/features/auth/AuthProvider";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    try { setBusy(true); await signIn(login.trim(), password); router.replace("/areas"); }
    catch (error) { Alert.alert("Không thể đăng nhập", error instanceof Error ? error.message : "Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
    <ScrollView
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View><Text style={styles.eyebrow}>TN COMPANY</Text><Text style={styles.title}>Ghi nhận nhập hàng</Text>
        <Text style={styles.copy}>Đăng nhập để chụp hóa đơn và giải trình tại quầy.</Text></View>
      <View style={styles.form}>
        <FormField
          label="Tên đăng nhập hoặc email"
          required
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          placeholder="Ví dụ: admin"
          value={login}
          onChangeText={setLogin}
          returnKeyType="next"
        />
        <FormField
          label="Mật khẩu"
          required
          secureTextEntry
          textContentType="password"
          placeholder="Nhập mật khẩu"
          value={password}
          onChangeText={setPassword}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <PrimaryButton title="Đăng nhập" loadingTitle="Đang đăng nhập…" onPress={submit} loading={busy} disabled={!login || !password} />
      </View>
    </ScrollView>
  </KeyboardAvoidingView></Screen>;
}
const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  wrap: { flex: 1, justifyContent: "space-between", paddingVertical: 48 },
  eyebrow: { color: "#059669", fontWeight: "800", letterSpacing: 2 }, title: { fontSize: 34, fontWeight: "800", color: "#0f172a", marginTop: 10 },
  copy: { color: "#64748b", fontSize: 16, lineHeight: 24, marginTop: 10 }, form: { gap: 14 }
});
