import React from 'react';
import { AuthProvider } from './AuthContext';
import { VoiceProvider } from './VoiceContext';
import AppRoutes from './routes';

function App() {
  return (
    <AuthProvider>
      <VoiceProvider>
        <AppRoutes />
      </VoiceProvider>
    </AuthProvider>
  );
}

export default App;