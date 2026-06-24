import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Calendar, Users, Settings as SettingsIcon, LogOut, CheckSquare, ClipboardCheck, History } from 'lucide-react';
import api from './services/api';

import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

// ページコンポーネント
import Employees from './pages/Employees';
import Settings from './pages/Settings';
import AttendanceInput from './pages/AttendanceInput';
import MonthlyList from './pages/MonthlyList';
import Approvals from './pages/Approvals';

// サイドバーコンポーネント
const Sidebar = () => {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        勤怠システム
      </div>
      <nav className="sidebar-nav">
        {isAdmin && (
          <Link to="/" className={`nav-item ${isActive('/')}`}>
            <Calendar size={20} />
            <span>月別一覧</span>
          </Link>
        )}
        <Link to="/input" className={`nav-item ${isActive('/input')}`}>
          <CheckSquare size={20} />
          <span>勤怠入力</span>
        </Link>
        {isAdmin && (
          <>
            <Link to="/approvals" className={`nav-item ${isActive('/approvals')}`}>
              <ClipboardCheck size={20} />
              <span>承認管理</span>
            </Link>
            <Link to="/employees" className={`nav-item ${isActive('/employees')}`}>
              <Users size={20} />
              <span>従業員管理</span>
            </Link>
            <Link to="/settings" className={`nav-item ${isActive('/settings')}`}>
              <SettingsIcon size={20} />
              <span>設定</span>
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
};

// ヘッダーコンポーネント
const Header = () => {
  const { user, logout } = useAuth();
  
  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {user?.name || 'ゲスト'} ({user?.role === 'ADMIN' ? '管理者' : '一般'})
        </span>
        <button 
          onClick={() => logout()}
          className="btn-primary" 
          style={{ padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          title="ログアウト"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};

// ルートガード
const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { isAuthenticated, isAdmin, user } = useAuth();

  // useEffect が走る前に user が null かどうかをチェック（初期化時）
  // 厳密にはローディング中状態が必要だが、今回は簡単に token があるかどうかで簡易判定
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/input" replace />;
  }

  return <>{children}</>;
};

// レイアウトコンポーネント
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute requireAdmin={true}>
              <Layout><MonthlyList /></Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/input" element={
            <ProtectedRoute>
              <Layout><AttendanceInput /></Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/approvals" element={
            <ProtectedRoute requireAdmin={true}>
              <Layout><Approvals /></Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/employees" element={
            <ProtectedRoute requireAdmin={true}>
              <Layout><Employees /></Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute requireAdmin={true}>
              <Layout><Settings /></Layout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
