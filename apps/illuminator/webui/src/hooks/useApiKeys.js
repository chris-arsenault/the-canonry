import { useState, useEffect } from "react";

function readPersistedFlag(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function readPersistedApiKey(keyName) {
  try {
    if (localStorage.getItem("illuminator:persistApiKeys") === "true") {
      return localStorage.getItem(keyName) || "";
    }
  } catch { /* ignored */ }
  return "";
}

export default function useApiKeys() {
  const [persistApiKeys, setPersistApiKeys] = useState(
    () => readPersistedFlag("illuminator:persistApiKeys")
  );
  const [anthropicApiKey, setAnthropicApiKey] = useState(
    () => readPersistedApiKey("illuminator:anthropicApiKey")
  );
  const [openaiApiKey, setOpenaiApiKey] = useState(
    () => readPersistedApiKey("illuminator:openaiApiKey")
  );
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Persist API keys when enabled
  useEffect(() => {
    try {
      localStorage.setItem("illuminator:persistApiKeys", persistApiKeys ? "true" : "false");
      if (persistApiKeys) {
        localStorage.setItem("illuminator:anthropicApiKey", anthropicApiKey);
        localStorage.setItem("illuminator:openaiApiKey", openaiApiKey);
      } else {
        localStorage.removeItem("illuminator:anthropicApiKey");
        localStorage.removeItem("illuminator:openaiApiKey");
      }
    } catch { /* ignored */ }
  }, [persistApiKeys, anthropicApiKey, openaiApiKey]);

  const hasAnthropicKey = anthropicApiKey.length > 0;
  const hasRequiredKeys = hasAnthropicKey;

  return {
    persistApiKeys,
    setPersistApiKeys,
    anthropicApiKey,
    setAnthropicApiKey,
    openaiApiKey,
    setOpenaiApiKey,
    showApiKeyInput,
    setShowApiKeyInput,
    hasAnthropicKey,
    hasRequiredKeys,
  };
}
