import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import voiceService from './services/voiceService';
import voiceInteractionsService from './services/voiceInteractionsService';

const VoiceContext = createContext();

export function useVoice() {
  return useContext(VoiceContext);
}

export function VoiceProvider({ children }) {
  const { user } = useAuth();
  const [isVoiceModeEnabled, setIsVoiceModeEnabled] = useState(false);
  const [userHasVisualDifficulty, setUserHasVisualDifficulty] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user has visual difficulty and auto-enable voice mode
  useEffect(() => {
    // ✅ FIXED: Use backend API instead of direct Firestore access
    let isMounted = true;
    const fetchUserSettings = async () => {
      if (!user) {
        setIsVoiceModeEnabled(false);
        setUserHasVisualDifficulty(false);
        setLoading(false);
        return;
      }

      try {
        // Get user settings from backend (secure)
        const idToken = await user.getIdToken();
        const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${apiBase}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user settings: ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          const hasVisualDifficulty = data.visualDifficulty || false;
          setUserHasVisualDifficulty(hasVisualDifficulty);
          setIsVoiceModeEnabled(hasVisualDifficulty ? true : false);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching user settings from backend:', error);
        setLoading(false);
      }
    };

    fetchUserSettings();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const toggleVoiceMode = () => {
    setIsVoiceModeEnabled(prev => !prev);
  };

  const enableVoiceMode = () => {
    setIsVoiceModeEnabled(true);
  };

  const disableVoiceMode = () => {
    setIsVoiceModeEnabled(false);
  };

  const speak = async (text, options = {}) => {
    if (!isVoiceModeEnabled && !options.force) {
      console.warn('Voice mode is disabled');
      return;
    }
    
    const timer = voiceInteractionsService.createTimer();
    
    try {
      await voiceService.speak(text, options);
      
      // Log the interaction if user is available and not forced silent
      if (user) {
        const duration = timer.getDuration();
        await voiceInteractionsService.logInteraction({
          userId: user.uid,
          questionId: options.questionId || 'general',
          action: options.action || 'text_read',
          duration,
          voiceText: text,
          metadata: {
            ...options.metadata,
            textLength: text.length
          }
        });
      }
    } catch (error) {
      console.error('Error speaking text:', error);
    }
  };

  const stopSpeaking = () => {
    voiceService.stop();
  };

  const pauseSpeaking = () => {
    voiceService.pause();
  };

  const resumeSpeaking = () => {
    voiceService.resume();
  };

  const updateVoiceSettings = async (newSettings) => {
    const oldSettings = voiceService.getSettings();
    voiceService.updateSettings(newSettings);
    
    // Log settings change
    if (user) {
      await voiceInteractionsService.logSettingsChange(user.uid, oldSettings, newSettings);
    }
  };

  const getVoiceSettings = () => {
    return voiceService.getSettings();
  };

  const getVoiceStatus = () => {
    return voiceService.getStatus();
  };

  const value = {
    // State
    isVoiceModeEnabled,
    userHasVisualDifficulty,
    loading,
    
    // Actions
    toggleVoiceMode,
    enableVoiceMode,
    disableVoiceMode,
    
    // Voice service methods
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    updateVoiceSettings,
    getVoiceSettings,
    getVoiceStatus,
    
    // Service availability
    isVoiceAvailable: voiceService.isAvailable(),
    
    // Voice interactions service
    voiceInteractionsService
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}
