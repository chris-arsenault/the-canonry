import type { Dispatch, SetStateAction } from "react";
import { useState, useEffect } from "react";

export interface UseApiKeysReturn {
  persistApiKeys: boolean;
  setPersistApiKeys: Dispatch<SetStateAction<boolean>>;
  anthropicApiKey: string;
  setAnthropicApiKey: Dispatch<SetStateAction<string>>;
  openaiApiKey: string;
  setOpenaiApiKey: Dispatch<SetStateAction<string>>;
  showApiKeyInput: boolean;
  setShowApiKeyInput: Dispatch<SetStateAction<boolean>>;
  hasAnthropicKey: boolean;
  hasRequiredKeys: boolean;
}

function readPersistedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function readPersistedApiKey(keyName: string): string {
  try {
    if (localStorage.getItem("illuminator:persistApiKeys") === "true") {
      return localStorage.getItem(keyName) || "";
    }
  } catch {
    /* ignored */
  }
  return "";
}

export default function useApiKeys(): UseApiKeysReturn {
  const [persistApiKeys, setPersistApiKeys] = useState<boolean>(() =>
    readPersistedFlag("illuminator:persistApiKeys")
  );
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>(() =>
    readPersistedApiKey("illuminator:anthropicApiKey")
  );
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(() =>
    readPersistedApiKey("illuminator:openaiApiKey")
  );
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);

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
    } catch {
      /* ignored */
    }
  }, [persistApiKeys, anthropicApiKey, openaiApiKey]);

  const hasAnthropicKey: boolean = anthropicApiKey.length > 0;
  const hasRequiredKeys: boolean = hasAnthropicKey;

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
