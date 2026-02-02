import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

function getUserPool(config) {
  if (!config?.cognitoUserPoolId || !config?.cognitoClientId) {
    throw new Error('Missing Cognito user pool configuration');
  }
  return new CognitoUserPool({
    UserPoolId: config.cognitoUserPoolId,
    ClientId: config.cognitoClientId,
  });
}

function getCurrentUser(config) {
  try {
    return getUserPool(config).getCurrentUser();
  } catch {
    return null;
  }
}

export async function signInWithUserPool({ username, password, config }) {
  const authenticationDetails = new AuthenticationDetails({
    Username: username,
    Password: password,
  });

  const user = new CognitoUser({
    Username: username,
    Pool: getUserPool(config),
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authenticationDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (error) => reject(error),
    });
  });
}

export async function getUserPoolSession(config) {
  const user = getCurrentUser(config);
  if (!user) return null;
  return new Promise((resolve) => {
    user.getSession((error, session) => {
      if (error || !session) {
        resolve(null);
        return;
      }
      resolve(session);
    });
  });
}

export function signOutUserPool(config) {
  const user = getCurrentUser(config);
  user?.signOut();
}

export function sessionToTokens(session) {
  if (!session) return null;
  const idToken = session.getIdToken().getJwtToken();
  const accessToken = session.getAccessToken().getJwtToken();
  const expiresAt = session.getIdToken().getExpiration() * 1000;
  return {
    idToken,
    accessToken,
    tokenType: 'Bearer',
    expiresAt,
  };
}
