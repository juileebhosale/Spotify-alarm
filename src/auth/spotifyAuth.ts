  import * as AuthSession from 'expo-auth-session';
  import * as Crypto from 'expo-crypto';
  import * as SecureStore from 'expo-secure-store';

  const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
  const REDIRECT_URI = AuthSession.makeRedirectUri({ path: 'callback' });
  console.log('Redirect URI:', REDIRECT_URI);

  const SCOPES = [
    'app-remote-control',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
    'playlist-read-private',
    'user-top-read',
    'user-read-private',
  ].join(' ');

  export const TOKEN_KEY = 'spotify_access_token';
  export const REFRESH_KEY = 'spotify_refresh_token';

  // Standalone helpers — safe to call outside of React components
  export async function getStoredAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  export async function refreshStoredToken(): Promise<string | null> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return null;
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }).toString(),
    });
    const data = await res.json();
    if (!data.access_token) return null;
    await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
    return data.access_token as string;
  }
                                                                                                                                                                                                            
  const discovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',                                                                                                                                        
    tokenEndpoint: 'https://accounts.spotify.com/api/token',                                                                                                                                                
  };
                                                                                                                                                                                                            
  export function useSpotifyAuth() {
    const [request, response, promptAsync] = AuthSession.useAuthRequest(
      {                                                                                                                                                                                                     
        clientId: CLIENT_ID,
        scopes: SCOPES.split(' '),                                                                                                                                                                          
        usePKCE: true,                                                                                                                                                                                      
        redirectUri: REDIRECT_URI,
      },                                                                                                                                                                                                    
      discovery   
    );

    const exchangeToken = async (code: string, codeVerifier: string) => {
      console.log('[Auth] Exchanging token. redirect_uri:', REDIRECT_URI);
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier,
        }).toString(),
      });
      const data = await res.json();
      console.log('[Auth] Token exchange result:', JSON.stringify(data));
      if (!data.access_token) {
        throw new Error(
          `Spotify token exchange failed: ${data.error ?? 'unknown'} — ${data.error_description ?? ''}`,
        );
      }
      await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
      await SecureStore.setItemAsync(REFRESH_KEY, data.refresh_token);
      return data.access_token as string;
    };                                                                                                                                                                                                      
                  
    const getAccessToken = async (): Promise<string | null> => {                                                                                                                                            
      return await SecureStore.getItemAsync(TOKEN_KEY);
    };

    const refreshAccessToken = async (): Promise<string | null> => {                                                                                                                                        
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!refreshToken) return null;                                                                                                                                                                       
      const res = await fetch('https://accounts.spotify.com/api/token', {                                                                                                                                   
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },                                                                                                                                   
        body: new URLSearchParams({
          grant_type: 'refresh_token',                                                                                                                                                                      
          refresh_token: refreshToken,
          client_id: CLIENT_ID,                                                                                                                                                                             
        }).toString(),
      });
      const data = await res.json();
      await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);                                                                                                                                         
      return data.access_token as string;
    };                                                                                                                                                                                                      
                  
    const logout = async () => {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);                                                                                                                                                       
    };
                                                                                                                                                                                                            
    return { request, response, promptAsync, exchangeToken, getAccessToken, refreshAccessToken, logout };                                                                                                   
  }
