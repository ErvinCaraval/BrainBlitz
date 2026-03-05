import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import backendAuthService from '../services/backendAuthService';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';

export default function CompleteProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [visualDifficulty, setVisualDifficulty] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!user) throw new Error('Not authenticated');
      
      // ✅ Get ID token and use backend service to update profile
      const idToken = await user.getIdToken();
      await backendAuthService.updateProfile(idToken, {
        displayName,
        visualDifficulty
      });
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container min-h-screen px-4 py-10 grid place-items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Completa tu perfil</h1>
          <p className="text-white/70">Elige tu nombre para mostrar</p>
        </div>
        <form onSubmit={handleSave} className="grid gap-4">
          <div>
            <label className="block mb-1 text-sm text-white/80" htmlFor="displayName">Nombre para mostrar</label>
            <Input id="displayName" type="text" placeholder="Tu nombre" value={displayName} onChange={e => setDisplayName(e.target.value)} required disabled={loading} />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <input
              id="visualDifficulty"
              type="checkbox"
              checked={visualDifficulty}
              onChange={e => setVisualDifficulty(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="visualDifficulty" className="text-sm text-white/80 cursor-pointer">
              Tengo dificultades visuales
            </label>
          </div>

          {error && <Alert intent="error">{error}</Alert>}
          <Button type="submit" size="lg" disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</Button>
        </form>
      </div>
    </div>
  );
}