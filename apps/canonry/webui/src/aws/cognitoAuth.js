function parseHashParams(hash) {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmed) return {};
  return trimmed.split('&').reduce((acc, pair) => {
    const [rawKey, rawValue] = pair.split('=');
    if (!rawKey) return acc;
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue || '');
    return acc;
  }, {});
}

export function extractCognitoTokensFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = parseHashParams(window.location.hash || '');
  if (!params.id_token) return null;
  const expiresIn = Number(params.expires_in || 0);
  const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
  return {
    idToken: params.id_token,
    accessToken: params.access_token || null,
    tokenType: params.token_type || null,
    expiresAt,
  };
}

export function clearCognitoHash() {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
}

export function buildHostedUiLoginUrl(config) {
  const domain = config?.cognitoDomain?.trim();
  const clientId = config?.cognitoClientId?.trim();
  if (!domain || !clientId) return null;
  const redirectUri = config?.cognitoRedirectUri?.trim()
    || `${window.location.origin}${window.location.pathname}`;
  const scope = config?.cognitoScope?.trim() || 'openid email profile';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    scope,
    redirect_uri: redirectUri,
  });
  return `${domain.replace(/\/$/, '')}/login?${params.toString()}`;
}

export function buildHostedUiLogoutUrl(config) {
  const domain = config?.cognitoDomain?.trim();
  const clientId = config?.cognitoClientId?.trim();
  if (!domain || !clientId) return null;
  const redirectUri = config?.cognitoRedirectUri?.trim()
    || `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: redirectUri,
  });
  return `${domain.replace(/\/$/, '')}/logout?${params.toString()}`;
}
