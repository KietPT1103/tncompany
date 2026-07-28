import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View, type ViewProps } from "react-native";

export function Screen({ children, style, ...props }: ViewProps) {
  return <SafeAreaView style={[styles.safe, style]}><View style={styles.content} {...props}>{children}</View></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, padding: 20 }
});
