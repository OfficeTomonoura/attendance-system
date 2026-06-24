import React, { useState, useEffect } from 'react';
import { CheckSquare, XSquare, AlertCircle, Check, User, Clock } from 'lucide-react';
import api from '../services/api';

interface Employee {
  id: string;
  employeeCode: string;
  name: string;
}

interface AttendanceData {
  employee: Employee;
  recordId: string | null;
  snapshotSalaryGroupId: string | null;
  values: Record<string, string | null>;
}

export default function Approvals() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const [targetMonth, setTargetMonth] = useState(currentMonth);
  const [data, setData] = useState<AttendanceData[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [allGroupFields, setAllGroupFields] = useState<any[]>([]);
  const [monthStatus, setMonthStatus] = useState<string>('draft');
  const [submittedBy, setSubmittedBy] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAttendance = async (month: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [attRes, fieldsRes, gfRes] = await Promise.all([
        api.get(`/attendance?month=${month}`),
        api.get('/fields'),
        api.get('/salary-group-fields')
      ]);
      setData(attRes.data.data);
      setMonthStatus(attRes.data.monthStatus);
      setSubmittedBy(attRes.data.submittedBy || null);
      setSubmittedAt(attRes.data.submittedAt || null);
      setApprovedBy(attRes.data.approvedBy || null);
      setApprovedAt(attRes.data.approvedAt || null);
      setFields(fieldsRes.data);
      setAllGroupFields(gfRes.data);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setErrorMsg('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance(targetMonth);
  }, [targetMonth]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!confirm(`この月のデータを${action === 'approve' ? '承認' : '差戻し'}しますか？`)) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.post(`/attendance/${action}`, {
        month: targetMonth
      });
      setSuccessMsg(`データを${action === 'approve' ? '承認' : '差戻し'}しました`);
      await fetchAttendance(targetMonth);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || '処理に失敗しました');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>承認管理</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontWeight: 500, color: 'var(--text-muted)' }}>対象年月:</label>
          <input 
            type="month" 
            className="form-control" 
            style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
            value={targetMonth}
            onChange={(e) => {
              setTargetMonth(e.target.value);
              setSuccessMsg('');
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ flex: 1, padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ textAlign: 'center', minWidth: '140px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>対象月ステータス</div>
              <span className={`status-badge status-${monthStatus}`} style={{ fontSize: '1rem', padding: '0.3rem 0.8rem' }}>
                {monthStatus === 'draft' ? '未提出' : monthStatus === 'submitted' ? '提出済 (承認待ち)' : '承認済'}
              </span>
            </div>

            {(monthStatus === 'submitted' || monthStatus === 'approved') && submittedBy && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <User size={16} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>提出者</div>
                  <div style={{ fontWeight: 600 }}>{submittedBy}</div>
                  {submittedAt && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                      <Clock size={12} />
                      {new Date(submittedAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {monthStatus === 'approved' && approvedBy && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: '#D1FAE5', borderRadius: '8px', border: '1px solid var(--success)' }}>
                <Check size={16} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>承認者</div>
                  <div style={{ fontWeight: 600, color: 'var(--success)' }}>{approvedBy}</div>
                  {approvedAt && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem', opacity: 0.8 }}>
                      <Clock size={12} />
                      {new Date(approvedAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>従業員一覧</h3>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn-danger" 
              onClick={() => handleAction('reject')} 
              disabled={monthStatus === 'draft'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: monthStatus === 'draft' ? 0.5 : 1 }}
            >
              <XSquare size={16} /> この月を差戻す
            </button>
            <button 
              className="btn-primary" 
              onClick={() => handleAction('approve')} 
              disabled={monthStatus !== 'submitted'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success)', opacity: monthStatus !== 'submitted' ? 0.5 : 1 }}
            >
              <CheckSquare size={16} /> この月を承認する
            </button>
          </div>
        </div>

        {errorMsg && <div className="alert-error"><AlertCircle size={16} /> {errorMsg}</div>}
        {successMsg && <div className="alert-error" style={{ backgroundColor: '#D1FAE5', color: 'var(--success)' }}><Check size={16} /> {successMsg}</div>}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table className="data-table" style={{ border: 'none' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap', minWidth: '100px' }}>スタッフコード</th>
                  <th style={{ whiteSpace: 'nowrap', minWidth: '120px' }}>氏名</th>
                  {fields.map(f => (
                    <th key={f.id} style={{ whiteSpace: 'nowrap' }}>{f.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={2 + fields.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>対象となるデータがありません</td></tr>
                ) : data.map(item => {
                  const currentGroupId = item.snapshotSalaryGroupId || (item.employee as any).salaryGroupId;
                  return (
                    <tr key={item.employee.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{item.employee.employeeCode}</td>
                      <td style={{ fontWeight: 500 }}>{item.employee.name}</td>
                      {fields.map(f => {
                        const isCommon = f.isCommon;
                        const isLinked = allGroupFields.some(agf => agf.salaryGroupId === currentGroupId && agf.attendanceFieldId === f.id);
                        const canView = isCommon || isLinked;

                        return (
                          <td key={f.id} style={{ backgroundColor: !canView ? 'var(--background)' : undefined, color: !canView ? 'var(--background)' : undefined }}>
                            {canView ? (item.values[f.id] || '-') : ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
