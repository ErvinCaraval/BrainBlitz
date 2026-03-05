import React, { useState } from 'react';
import Layout from '../components/Layout';
import SimpleVoiceTest from '../components/SimpleVoiceTest';
import VoiceDiagnosticComplete from '../components/VoiceDiagnosticComplete';

export default function VoiceTestPage() {
  const [activeTab, setActiveTab] = useState('simple');

  return (
    <Layout>
      <div className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab('simple')}
              className={`px-4 py-2 rounded ${
                activeTab === 'simple' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              🔊 Prueba Simple
            </button>
            <button
              onClick={() => setActiveTab('diagnostic')}
              className={`px-4 py-2 rounded ${
                activeTab === 'diagnostic' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              🔍 Diagnóstico Completo
            </button>
          </div>
          
          {activeTab === 'simple' && (
            <div className="flex items-center justify-center">
              <SimpleVoiceTest />
            </div>
          )}
          
          {activeTab === 'diagnostic' && (
            <VoiceDiagnosticComplete />
          )}
        </div>
      </div>
    </Layout>
  );
}
