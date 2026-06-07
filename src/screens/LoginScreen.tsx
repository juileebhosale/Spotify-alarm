  import { useEffect } from 'react';                                                                                                                                                                        
  import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
  import { useSpotifyAuth } from '../auth/spotifyAuth';                                                                                                                                                     
   
  export default function LoginScreen({ onLogin }: { onLogin: () => void }) {                                                                                                                               
    const { request, response, promptAsync, exchangeToken } = useSpotifyAuth();
                                                                                                                                                                                                            
    useEffect(() => {                                                                                                                                                                                       
      if (response?.type === 'success') {
        const { code } = response.params;                                                                                                                                                                   
        const codeVerifier = request?.codeVerifier;
        if (code && codeVerifier) {                                                                                                                                                                         
          exchangeToken(code, codeVerifier)
            .then(() => onLogin())                                                                                                                                                                          
            .catch(() => Alert.alert('Error', 'Failed to log in. Please try again.'));
        }                                                                                                                                                                                                   
      } else if (response?.type === 'error') {
        Alert.alert('Error', 'Spotify login failed. Please try again.');                                                                                                                                    
      }
    }, [response]);                                                                                                                                                                                         
                                                                                                                                                                                                            
    return (
      <View style={styles.container}>                                                                                                                                                                       
        <Text style={styles.title}>Spotify Alarm</Text>
        <Text style={styles.subtitle}>Wake up to your favourite music</Text>
        <TouchableOpacity                                                                                                                                                                                   
          style={[styles.button, !request && styles.buttonDisabled]}
          onPress={() => promptAsync()}                                                                                                                                                                     
          disabled={!request}                                                                                                                                                                               
        >
          <Text style={styles.buttonText}>Connect Spotify</Text>                                                                                                                                            
        </TouchableOpacity>
      </View>
    );
  }

  const styles = StyleSheet.create({                                                                                                                                                                        
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#191414' },
    title: { fontSize: 32, fontWeight: 'bold', color: '#1DB954', marginBottom: 8 },                                                                                                                         
    subtitle: { fontSize: 16, color: '#fff', marginBottom: 48 },                                                                                                                                            
    button: { backgroundColor: '#1DB954', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 30 },                                                                                                   
    buttonDisabled: { opacity: 0.5 },                                                                                                                                                                       
    buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },                                                                                                                                        
  });         