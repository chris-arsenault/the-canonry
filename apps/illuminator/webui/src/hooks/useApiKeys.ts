import type { Dispatch, SetStateAction } from "react";
import { useState, useEffect } from "react";

export interface UseApiKeysReturn {
  persistApiKeys: boolean;
  setPersistApiKeys: Dispatch<SetStateAction<boolean>>;
  anthropicApiKey: string;
  setAnthropicApiKey: Dispatch<SetStateAction<string>>;
  openaiApiKey: string;
  setOpenaiApiKey: Dispatch<SetStateAction<string>>;
  wavespeedApiKey: string;
  setWavespeedApiKey: Dispatch<SetStateAction<string>>;
  bflApiKey: string;
  setBflApiKey: Dispatch<SetStateAction<string>>;
  falApiKey: string;
  setFalApiKey: Dispatch<SetStateAction<string>>;
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
  const [wavespeedApiKey, setWavespeedApiKey] = useState<string>(() =>
    readPersistedApiKey("illuminator:wavespeedApiKey")
  );
  const [bflApiKey, setBflApiKey] = useState<string>(() =>
    readPersistedApiKey("illuminator:bflApiKey")
  );
  const [falApiKey, setFalApiKey] = useState<string>(() =>
    readPersistedApiKey("illuminator:falApiKey")
  );
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);

  // Persist API keys when enabled
  useEffect(() => {
    try {
      localStorage.setItem("illuminator:persistApiKeys", persistApiKeys ? "true" : "false");
      if (persistApiKeys) {
        localStorage.setItem("illuminator:anthropicApiKey", anthropicApiKey);
        localStorage.setItem("illuminator:openaiApiKey", openaiApiKey);
        localStorage.setItem("illuminator:wavespeedApiKey", wavespeedApiKey);
        localStorage.setItem("illuminator:bflApiKey", bflApiKey);
        localStorage.setItem("illuminator:falApiKey", falApiKey);
      } else {
        localStorage.removeItem("illuminator:anthropicApiKey");
        localStorage.removeItem("illuminator:openaiApiKey");
        localStorage.removeItem("illuminator:wavespeedApiKey");
        localStorage.removeItem("illuminator:bflApiKey");
        localStorage.removeItem("illuminator:falApiKey");
      }
    } catch {
      /* ignored */
    }
  }, [persistApiKeys, anthropicApiKey, openaiApiKey, wavespeedApiKey, bflApiKey, falApiKey]);

  const hasAnthropicKey: boolean = anthropicApiKey.length > 0;
  const hasRequiredKeys: boolean = hasAnthropicKey;

  return {
    persistApiKeys,
    setPersistApiKeys,
    anthropicApiKey,
    setAnthropicApiKey,
    openaiApiKey,
    setOpenaiApiKey,
    wavespeedApiKey,
    setWavespeedApiKey,
    bflApiKey,
    setBflApiKey,
    falApiKey,
    setFalApiKey,
    showApiKeyInput,
    setShowApiKeyInput,
    hasAnthropicKey,
    hasRequiredKeys,
  };
}
