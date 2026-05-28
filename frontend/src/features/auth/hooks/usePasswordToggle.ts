import { useState, useCallback } from "react";

export function usePasswordToggle() {
  const [showPassword, setShowPassword] = useState(false);
  const toggle = useCallback(() => setShowPassword((p) => !p), []);
  const inputType = showPassword ? "text" : "password";
  const icon = showPassword ? "🙈" : "👁";
  return { showPassword, toggle, inputType, icon };
}
