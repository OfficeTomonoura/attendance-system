import React, { useState, useEffect } from 'react';
import { AlertCircle, History } from 'lucide-react';
import api from '../services/api';

interface AuditLog {
  id: string;
  employeeCode: string;
  employeeName: string;
  targetMonth: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  updatedBy: string;
  updatedAt: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/attendance/history');
      setLogs(res.data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setErrorMsg('履歴データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const translateFieldName = (field: string) => {
    switch (field) {
      case 'scheduledWorkDays': return '所定労働日数';
      case 'status': return 'ステータス';
      default: return field;
    }
  };

  const translateValue = (field: string, value: string | null) => {
    if (value === null || value === undefined) return '(未設定)';
    if (field === 'status') {
      switch (value) {
        case 'draft': return '未提出';
        case 'submitted': return '提出済';
        case 'approved': return '承認済';
        default: return value;
      }
    }
    return value;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={24} />
          修正履歴
        </h1>
        <button className="btn-secondary" onClick={fetchLogs}>
          最新の状態に更新
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {errorMsg && <div style={{ padding: '1.5rem' }}><div className="alert-error" style={{ marginBottom: 0 }}><AlertCircle size={16} /> {errorMsg}</div></div>}
        
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>更新日時</th>
                  <th>更新者</th>
                  <th>対象年月</th>
                  <th>従業員</th>
                  <th>項目名</th>
                  <th>変更前</th>
                  <th style={{ width: '20px', textAlign: 'center' }}></th>
                  <th>変更後</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>履歴がありません</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{formatDate(log.updatedAt)}</td>
                    <td style={{ fontSize: '0.9rem' }}>{log.updatedBy}</td>
                    <td style={{ fontWeight: 500 }}>{log.targetMonth}</td>
                    <td>
                      <div>{log.employeeName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.employeeCode}</div>
                    </td>
                    <td>
                      <span style={{ 
                        display: 'inline-block', 
                        padding: '0.2rem 0.5rem', 
                        backgroundColor: 'var(--background)', 
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        {translateFieldName(log.fieldName)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {translateValue(log.fieldName, log.oldValue)}
                    </td>
                    <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>→</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                      {translateValue(log.fieldName, log.newValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
