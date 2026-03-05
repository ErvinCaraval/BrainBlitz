import React, { useState } from 'react';
import backendAuthService from '../services/backendAuthService';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';

export default function PasswordResetPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      // ✅ Use backend authentication service
      await backendAuthService.sendPasswordResetEmail(email);
      setMessage('Password reset email sent! Check your inbox.');
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
          <h1 className="text-3xl font-extrabold">⚡ BrainBlitz</h1>
          <h2 className="mt-2 text-xl font-bold">Restablecer contraseña</h2>
          <p className="text-white/70">Ingresa tu correo para recibir un enlace de restablecimiento</p>
        </div>

        <form onSubmit={handleReset} className="grid gap-4">
          <div>
            <label className="block mb-1 text-sm text-white/80" htmlFor="email">Correo electrónico</label>
            <Input id="email" type="email" placeholder="tú@correo.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
          </div>

          {error && <Alert intent="error">{error}</Alert>}
          {message && <Alert intent="success">{message}</Alert>}

          <Button type="submit" size="lg" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar correo de restablecimiento'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p>
            <Link className="underline" to="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}