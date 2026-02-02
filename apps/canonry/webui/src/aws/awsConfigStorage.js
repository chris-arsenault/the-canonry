const CONFIG_KEY = 'canonry.aws.config';
const TOKEN_KEY = 'canonry.aws.tokens';

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.warn('Failed to parse AWS config:', err);
    return fallback;
  }
}

export function loadAwsConfig() {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(CONFIG_KEY);
  return safeParse(stored, null);
}

export function saveAwsConfig(config) {
  if (typeof localStorage === 'undefined') return;
  if (!config) {
    localStorage.removeItem(CONFIG_KEY);
    return;
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadAwsTokens() {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(TOKEN_KEY);
  return safeParse(stored, null);
}

export function saveAwsTokens(tokens) {
  if (typeof localStorage === 'undefined') return;
  if (!tokens) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearAwsTokens() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function isTokenValid(tokens) {
  if (!tokens?.idToken) return false;
  if (!tokens.expiresAt) return true;
  return Date.now() < tokens.expiresAt - 30_000;
}
