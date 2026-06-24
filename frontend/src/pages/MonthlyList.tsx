import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Calendar as CalendarIcon, ArrowUpDown } from 'lucide-react';
import api from '../services/api';

interface AttendanceListRecord {
  employeeCode: string;
  name: string;
  salaryGroupId?: string;
  values: Record<string, string | null>;
  valueNames: Record<string, string | null>;
  updatedAt: string;
}

export default function MonthlyList() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [records, setRecords] = useState<AttendanceListRecord[]>([]);
  const [monthStatus, setMonthStatus] = useState<string>('draft');
  const [fields, setFields] = useState<{ id: string; name: string; displayOrder: number }[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [sortField, setSortField] = useState<'employeeCode' | 'name'>('employeeCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchAttendanceList = async () => {
    setLoading(true);
    try {
      const [listRes, fieldsRes] = await Promise.all([
        api.get(`/attendance/list?month=${month}`),
        api.get('/fields')
      ]);
      setRecords(listRes.data.data);
      setMonthStatus(listRes.data.monthStatus);
      setFields(fieldsRes.data);
    } catch (err) {
      console.error(err);
      alert('データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceList();
  }, [month]);

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/attendance/export?month=${month}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv; charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${month.replace('-', '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('CSV出力に失敗しました');
    }
  };

  const handleSort = (field: 'employeeCode' | 'name') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'employeeCode') {
      comparison = a.employeeCode.localeCompare(b.employeeCode);
    } else {
      comparison = a.name.localeCompare(b.name);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 表示されているすべての動的項目（列）をマスタ順に抽出
  const dynamicFieldNames = useMemo(() => {
    return fields.map(f => f.name);
  }, [fields]);

  return (
    <div>
      <h1 className="page-title">月別一覧</h1>
      
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>一覧データ</h3>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              ({records.length}件)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>対象月ステータス:</span>
              <span className={`status-badge status-${monthStatus}`}>
                {monthStatus === 'draft' ? '未提出' : monthStatus === 'submitted' ? '提出済 (承認待ち)' : '承認済'}
              </span>
            </div>
            <button 
              className="btn-secondary" 
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={16} /> CSV出力
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>対象年月</label>
            <input 
              type="month" 
              className="form-control" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={fetchAttendanceList} disabled={loading}>
            <Search size={16} style={{ marginRight: '0.5rem' }}/> 検索
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('employeeCode')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>スタッフコード <ArrowUpDown size={14} /></div>
                  </th>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>氏名 <ArrowUpDown size={14} /></div>
                  </th>
                  
                  {/* 動的列 */}
                  {dynamicFieldNames.map(fName => (
                    <th key={fName}>{fName}</th>
                  ))}

                  <th>最終更新日時</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4 + dynamicFieldNames.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      <CalendarIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <div>この月の勤怠データはありません</div>
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((record) => (
                    <tr key={record.employeeCode}>
                      <td>{record.employeeCode}</td>
                      <td style={{ fontWeight: 500 }}>{record.name}</td>
                      
                      {/* 動的列の値 */}
                      {dynamicFieldNames.map(fName => {
                        const val = record.valueNames[fName];
                        const isNotApplicable = val === null || val === undefined;
                        return (
                          <td
                            key={fName}
                            style={{
                              backgroundColor: isNotApplicable ? 'var(--background)' : undefined,
                              color: isNotApplicable ? 'var(--text-muted)' : undefined,
                              opacity: isNotApplicable ? 0.5 : 1,
                              textAlign: isNotApplicable ? 'center' : undefined,
                            }}
                          >
                            {isNotApplicable ? '-' : (val !== '' ? val : '-')}
                          </td>
                        );
                      })}

                      <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{formatDate(record.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
