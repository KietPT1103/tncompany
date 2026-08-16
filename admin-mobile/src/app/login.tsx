import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/features/auth/AuthProvider";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    try {
      setBusy(true);
      await signIn(loginName.trim(), password);
      router.replace("/home");
    } catch (error) {
      Alert.alert("Không thể đăng nhập", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.page}>
        <View style={styles.brandMark}><Text style={styles.brandLetters}>TN</Text></View>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>TN COMPANY · ADMIN</Text>
          <Text style={styles.title}>Quản lý mọi nơi,{"\n"}nắm số liệu tức thì.</Text>
          <Text style={styles.subtitle}>Đăng nhập bằng tài khoản quản trị để theo dõi doanh thu hằng ngày.</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>Tên đăng nhập hoặc email</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setLoginName} placeholder="Nhập tài khoản admin" placeholderTextColor="#94a3b8" style={styles.input} value={loginName} />
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput onChangeText={setPassword} onSubmitEditing={submit} placeholder="Nhập mật khẩu" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} value={password} />
          <Pressable disabled={busy || !loginName || !password} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, (busy || !loginName || !password) && styles.buttonDisabled]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập an toàn  →</Text>}
          </Pressable>
          <Text style={styles.security}>🔒  Phiên đăng nhập được lưu an toàn trên thiết bị</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8f7" }, page: { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  brandMark: { width: 52, height: 52, borderRadius: 17, backgroundColor: "#075e4b", alignItems: "center", justifyContent: "center", shadowColor: "#075e4b", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } }, brandLetters: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  heading: { marginTop: 38 }, eyebrow: { color: "#08745a", fontSize: 12, fontWeight: "800", letterSpacing: 1.6 }, title: { color: "#10231e", fontSize: 34, lineHeight: 42, fontWeight: "900", letterSpacing: -1.2, marginTop: 12 }, subtitle: { color: "#64748b", fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 330 },
  form: { marginTop: "auto", gap: 9 }, label: { color: "#334155", fontSize: 13, fontWeight: "700", marginTop: 5 }, input: { height: 54, borderWidth: 1, borderColor: "#dce4e1", backgroundColor: "#fff", borderRadius: 15, paddingHorizontal: 16, color: "#0f172a", fontSize: 15 },
  button: { height: 56, borderRadius: 16, backgroundColor: "#08745a", alignItems: "center", justifyContent: "center", marginTop: 10 }, buttonPressed: { transform: [{ scale: 0.99 }], backgroundColor: "#065f49" }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" }, security: { color: "#94a3b8", fontSize: 11, textAlign: "center", marginTop: 8 },
});
