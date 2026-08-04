import React, { useState } from 'react';
import { X, Lock, Mail, User } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isLogin ? 'https://agentic-ai-ticket-booking-4.onrender.com/api/auth/login' : 'https://agentic-ai-ticket-booking-4.onrender.com/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 className="panel-title" style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p style={{ color: 'var(--text-mid)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {isLogin ? 'Access your digital event passes.' : 'Join the holographic booking platform.'}
        </p>

        {error && (
          <div style={{
            background: 'rgba(255, 42, 109, 0.1)',
            border: '1px solid var(--color-danger)',
            color: 'var(--color-danger)',
            padding: '0.8rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-low)' }}>
                  <User size={16} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', width: '100%' }}
                  placeholder="Johnny Silverhand"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-low)' }}>
                <Mail size={16} />
              </span>
              <input
                type="email"
                className="form-input"
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                placeholder="netrunner@aether.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Secure Key (Password)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-low)' }}>
                <Lock size={16} />
              </span>
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-action"
            style={{ width: '100%', padding: '0.8rem', marginBottom: '1.2rem' }}
            disabled={loading}
          >
            {loading ? 'Initializing Interface...' : isLogin ? 'Access Portal' : 'Register Matrix'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-mid)' }}>
          {isLogin ? "New to AetherPass? " : "Already registered? "}
          <span
            style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
          >
            {isLogin ? 'Register New account' : 'Sign In'}
          </span>
        </div>
      </div>
    </div>
  );
}
