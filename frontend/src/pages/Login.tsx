import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { loginId, password });
      login(res.data.token, res.data.user);
      
      // Role に応じてリダイレクト先を変える（管理者はダッシュボード、一般は勤怠入力へ）
      if (res.data.user.role === 'ADMIN') {
        navigate('/');
      } else {
        navigate('/attendance-input');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--background)'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            marginBottom: '1rem'
          }}>
            <LogIn size={32} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>システムログイン</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            勤怠管理システムへようこそ
          </p>
        </div>

        {errorMsg && (
          <div className="alert-error" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>
              ログインID
            </label>
            <input
              type="text"
              className="form-control"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>
              パスワード
            </label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            disabled={loading}
          >
            {loading ? 'ログイン処理中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
