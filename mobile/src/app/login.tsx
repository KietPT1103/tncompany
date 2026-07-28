import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
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
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
    <View><Text style={styles.eyebrow}>TN COMPANY</Text><Text style={styles.title}>Ghi nhận nhập hàng</Text>
      <Text style={styles.copy}>Đăng nhập để chụp hóa đơn và giải trình tại quầy.</Text></View>
    <View style={styles.form}>
      <TextInput autoCapitalize="none" placeholder="Tên đăng nhập hoặc email" value={login} onChangeText={setLogin} style={styles.input} />
      <TextInput secureTextEntry placeholder="Mật khẩu" value={password} onChangeText={setPassword} style={styles.input} />
      <PrimaryButton title="Đăng nhập" onPress={submit} loading={busy} disabled={!login || !password} />
    </View>
  </KeyboardAvoidingView></Screen>;
}
const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "space-between", paddingVertical: 48 },
  eyebrow: { color: "#059669", fontWeight: "800", letterSpacing: 2 }, title: { fontSize: 34, fontWeight: "800", color: "#0f172a", marginTop: 10 },
  copy: { color: "#64748b", fontSize: 16, lineHeight: 24, marginTop: 10 }, form: { gap: 14 },
  input: { minHeight: 56, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 18, paddingHorizontal: 16, fontSize: 16 }
});
