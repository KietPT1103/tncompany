import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle
} from "react-native";

type FormFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function FormField({
  label,
  required = false,
  hint,
  containerStyle,
  inputStyle,
  placeholderTextColor = "#94a3b8",
  ...inputProps
}: FormFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        accessibilityLabel={inputProps.accessibilityLabel || label}
        placeholderTextColor={placeholderTextColor}
        style={[styles.input, inputProps.multiline && styles.multiline, inputStyle]}
        {...inputProps}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  label: { color: "#334155", fontSize: 14, fontWeight: "700" },
  required: { color: "#dc2626" },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#0f172a"
  },
  multiline: { minHeight: 88, paddingTop: 13, textAlignVertical: "top" },
  hint: { color: "#64748b", fontSize: 12, lineHeight: 17 }
});
