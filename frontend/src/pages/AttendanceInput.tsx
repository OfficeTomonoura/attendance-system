import React, { useState, useEffect } from 'react';
import { Search, Save, AlertCircle, Edit2, X, Send, Layers } from 'lucide-react';
import api from '../services/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Header Component ---
function SortableHeader({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? 'var(--surface)' : undefined,
    zIndex: isDragging ? 10 : 0,
    position: isDragging ? 'relative' as const : undefined,
    cursor: 'grab',
  };

  return (
    <th ref={setNodeRef} style={{ ...style, minWidth: '100px', whiteSpace: 'nowrap' }} {...attributes} {...listeners}>
      {children}
    </th>
  );
}

interface SalaryGroup {
  id: string;
  name: string;
}

interface SalaryGroupField {
  id: string;
  salaryGroupId: string;
  attendanceFieldId: string;
  required: boolean;
  displayOrder: number;
  attendanceField: {
    id: string;
    name: string;
    fieldType: string;
  };
}

interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  salaryGroupId: string;
}

interface AttendanceRecord {
  employee: Employee;
  recordId: string | null;
  snapshotSalaryGroupId: string | null;
  status: string; // draft, submitted, approved
  values: Record<string, string | null>; // fieldId -> value
}

interface ValidationRule {
  id: string;
  salaryGroupId: string;
  attendanceFieldId: string;
  operator: string;
  referenceValue: string | null;
  errorMessage: string;
}

export default function AttendanceInput() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 取得した全データ
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [monthStatus, setMonthStatus] = useState<string>('draft');
  // グループマスタ
  const [groups, setGroups] = useState<SalaryGroup[]>([]);
  const [allFields, setAllFields] = useState<any[]>([]);
  const [allGroupFields, setAllGroupFields] = useState<SalaryGroupField[]>([]);
  
  // 選択中のグループタブ
  const [activeGroupId, setActiveGroupId] = useState<string>('all');
  // 選択中グループの項目定義
  const [activeGroupFields, setActiveGroupFields] = useState<SalaryGroupField[]>([]);

  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  // 編集モード
  const [isEditing, setIsEditing] = useState(false);

  // Validation
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [validationErrors, setValidationErrors] = useState<{employeeName: string, errorMessage: string}[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const lockTimerRef = React.useRef<any>(null);
  const lockedMonthRef = React.useRef<string | null>(null);

  // ロック解除処理
  const releaseLock = async (monthToUnlock: string) => {
    try {
      await api.post('/attendance/unlock', { month: monthToUnlock });
    } catch (err) {
      console.error('Failed to unlock month:', monthToUnlock, err);
    }
  };

  // タイマークリアとロック解除
  const clearLockAndTimer = async () => {
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    if (lockedMonthRef.current) {
      const prevLockedMonth = lockedMonthRef.current;
      lockedMonthRef.current = null;
      await releaseLock(prevLockedMonth);
    }
  };

  // 画面アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
      if (lockedMonthRef.current) {
        releaseLock(lockedMonthRef.current);
      }
    };
  }, []);

  // --- DND Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [groupsRes, fieldsRes, groupFieldsRes, validationRes] = await Promise.all([
        api.get('/salary-groups'),
        api.get('/fields'),
        api.get('/salary-group-fields'),
        api.get('/validation-rules')
      ]);
      setGroups(groupsRes.data);
      setAllFields(fieldsRes.data);
      setAllGroupFields(groupFieldsRes.data);
      setValidationRules(validationRes.data);
    } catch (err) {
      console.error(err);
      setErrorMsg('初期データの取得に失敗しました');
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setRecords([]);
    try {
      // 1. 古いロックのクリアと、対象月へのロック要求
      await clearLockAndTimer();

      try {
        await api.post('/attendance/lock', { month });
        lockedMonthRef.current = month;
      } catch (lockErr: any) {
        const message = lockErr.response?.data?.message || '他のユーザーが入力中か、ロックの取得に失敗しました';
        setErrorMsg(message);
        setLoading(false);
        return; // ロックが取れない場合はデータ取得に進まない
      }

      // 2. データ取得
      const res = await api.get(`/attendance?month=${month}`);
      setRecords(res.data.data);
      setMonthStatus(res.data.monthStatus);
      setIsEditing(false);
      setEditValues({});

      // 3. 自動延長（ハートビート）タイマーを起動 (1分間隔)
      lockTimerRef.current = setInterval(async () => {
        if (!lockedMonthRef.current) return;
        try {
          await api.post('/attendance/lock', { month: lockedMonthRef.current });
        } catch (heartbeatErr: any) {
          console.error('Heartbeat lock extension failed:', heartbeatErr);
          if (heartbeatErr.response?.status === 409) {
            alert('別のユーザーが編集を開始したか、セッションがタイムアウトしたためロックが解除されました。画面をリロードします。');
            window.location.reload();
          }
        }
      }, 60 * 1000);

    } catch (err) {
      console.error('Error fetching attendance:', err);
      setErrorMsg('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // タブ切り替え時にそのグループの項目定義を取得
  useEffect(() => {
    if (activeGroupId === 'all') {
      const mapped = allFields.map(f => ({
        id: `all-${f.id}`,
        salaryGroupId: 'all',
        attendanceFieldId: f.id,
        required: false,
        displayOrder: f.displayOrder,
        attendanceField: f
      }));
      setActiveGroupFields(mapped);
    } else if (activeGroupId) {
      fetchActiveGroupFields(activeGroupId);
    }
  }, [activeGroupId, allFields]);

  const fetchActiveGroupFields = async (groupId: string) => {
    try {
      const res = await api.get(`/salary-group-fields/${groupId}`);
      setActiveGroupFields(res.data);
    } catch (err) {
      console.error(err);
      setErrorMsg('グループの項目設定の取得に失敗しました');
    }
  };

  const handleEditClick = () => {
    const initialValues: Record<string, Record<string, string>> = {};
    records.forEach(r => {
      const vals: Record<string, string> = {};
      activeGroupFields.forEach(gf => {
        const val = r.values[gf.attendanceFieldId];
        vals[gf.attendanceFieldId] = (val === null || val === undefined || val === '') 
          ? (gf.attendanceField.fieldType === 'number' ? '0' : gf.attendanceField.fieldType === 'time' ? '00:00' : '')
          : val;
      });
      initialValues[r.employee.id] = vals;
    });
    setEditValues(initialValues);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValues({});
  };

  const handleValueChange = (employeeId: string, fieldId: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [fieldId]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      // 保存対象のデータを構築 [{ employeeId, values: { fieldId: val } }]
      // アクティブなグループの従業員のみを対象とする
      const targetRecords = activeGroupId === 'all' 
        ? records 
        : records.filter(r => (r.snapshotSalaryGroupId || r.employee.salaryGroupId) === activeGroupId);
      
      const payload = targetRecords.map(r => ({
        employeeId: r.employee.id,
        values: editValues[r.employee.id] || {}
      }));

      await api.post('/attendance/save', {
        month,
        data: payload
      });
      
      setSuccessMsg('保存しました');
      setIsEditing(false);
      fetchAttendance(); // 再取得して反映
    } catch (err) {
      console.error('Error saving attendance:', err);
      setErrorMsg('保存に失敗しました');
    }
  };

  const handleSubmitAll = async () => {
    // 提出前にバリデーション評価
    const errors: {employeeName: string, errorMessage: string}[] = [];
    for (const record of records) {
      const groupId = record.snapshotSalaryGroupId || record.employee.salaryGroupId;
      const rules = validationRules.filter(r => r.salaryGroupId === groupId);
      
      for (const rule of rules) {
        const valStr = editValues[record.employee.id]?.[rule.attendanceFieldId] ?? record.values[rule.attendanceFieldId] ?? '';
        const valNum = parseFloat(valStr);
        const refNum = parseFloat(rule.referenceValue || '');
        
        let isError = false;
        if (rule.operator === 'NOT_EMPTY') {
          if (!valStr || valStr.trim() === '') isError = true;
        } else if (rule.operator === 'EQUALS_SUM') {
          const sumFieldIds = (rule.referenceValue || '').split(',').filter(Boolean);
          let sum = 0;
          for (const sid of sumFieldIds) {
            const sVal = editValues[record.employee.id]?.[sid] ?? record.values[sid] ?? '';
            const sNum = parseFloat(sVal);
            if (!isNaN(sNum)) sum += sNum;
          }
          const targetNum = isNaN(valNum) ? 0 : valNum;
          if (targetNum !== sum) isError = true;
        } else if (valStr !== '') {
          switch (rule.operator) {
            case '==': isError = (valStr == rule.referenceValue); break;
            case '!=': isError = (valStr != rule.referenceValue); break;
            case '>': isError = !isNaN(valNum) && !isNaN(refNum) && (valNum > refNum); break;
            case '<': isError = !isNaN(valNum) && !isNaN(refNum) && (valNum < refNum); break;
            case '>=': isError = !isNaN(valNum) && !isNaN(refNum) && (valNum >= refNum); break;
            case '<=': isError = !isNaN(valNum) && !isNaN(refNum) && (valNum <= refNum); break;
          }
        }
        
        if (isError) {
          errors.push({ employeeName: record.employee.name, errorMessage: rule.errorMessage });
        }
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }

    if (!confirm('この月のデータを提出（申請）しますか？\n提出すると編集できなくなります。')) return;
    try {
      await api.post('/attendance/submit', { month });
      setSuccessMsg(`データを提出しました`);
      fetchAttendance();
    } catch (err) {
      console.error('Error submitting:', err);
      setErrorMsg('提出に失敗しました');
    }
  };

  const handleWithdraw = async () => {
    if (!confirm('提出を取り下げますか？\n取り下げると再度編集可能になります。')) return;
    try {
      await api.post('/attendance/withdraw', { month });
      setSuccessMsg('提出を取り下げました');
      fetchAttendance();
    } catch (err: any) {
      console.error('Error withdrawing:', err);
      setErrorMsg(err.response?.data?.error || '提出の取り下げに失敗しました');
    }
  };


  const handleDragEndColumns = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activeGroupFields.findIndex((gf) => gf.attendanceFieldId === active.id);
      const newIndex = activeGroupFields.findIndex((gf) => gf.attendanceFieldId === over.id);
      setActiveGroupFields(arrayMove(activeGroupFields, oldIndex, newIndex));
    }
  };

  // 表示対象の従業員
  const activeRecords = activeGroupId === 'all' 
    ? records 
    : records.filter(r => (r.snapshotSalaryGroupId || r.employee.salaryGroupId) === activeGroupId);

  const isMonthLocked = monthStatus !== 'draft';

  return (
    <div>
      <h1 className="page-title">勤怠入力</h1>
      
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>対象年月</label>
          <input 
            type="month" 
            className="form-control" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={isEditing}
          />
        </div>
        <button className="btn-primary" onClick={fetchAttendance} disabled={isEditing || loading}>
          <Search size={16} style={{ marginRight: '0.5rem' }}/> 
          {loading ? '検索中...' : '検索'}
        </button>
      </div>

      {errorMsg && <div className="alert-error" style={{ marginBottom: '1.5rem' }}><AlertCircle size={16} /> {errorMsg}</div>}
      {successMsg && <div className="alert-error" style={{ marginBottom: '1.5rem', backgroundColor: '#D1FAE5', color: 'var(--success)' }}>{successMsg}</div>}

      {loading ? (
        <div className="card" style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{
            display: 'inline-block',
            width: '28px',
            height: '28px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem'
          }}></div>
          <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>データを読み込み中...</div>
        </div>
      ) : (
        records.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
            <button
              onClick={() => {
                if (isEditing) {
                  if(!confirm('編集中ですがタブを切り替えますか？変更は破棄されます')) return;
                  setIsEditing(false);
                }
                setActiveGroupId('all');
              }}
              style={{
                padding: '1rem 1.5rem',
                border: 'none',
                background: activeGroupId === 'all' ? 'var(--surface)' : 'transparent',
                borderBottom: activeGroupId === 'all' ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: activeGroupId === 'all' ? 'bold' : 'normal',
                color: activeGroupId === 'all' ? 'var(--primary)' : 'var(--text-muted)'
              }}
            >
              <Layers size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
              全職員
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => {
                  if (isEditing) {
                    if(!confirm('編集中ですがタブを切り替えますか？変更は破棄されます')) return;
                    setIsEditing(false);
                  }
                  setActiveGroupId(g.id);
                }}
                style={{
                  padding: '1rem 1.5rem',
                  border: 'none',
                  background: activeGroupId === g.id ? 'var(--surface)' : 'transparent',
                  borderBottom: activeGroupId === g.id ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: activeGroupId === g.id ? 'bold' : 'normal',
                  color: activeGroupId === g.id ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                <Layers size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
                {g.name}
              </button>
            ))}
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{activeGroupId === 'all' ? '全職員' : groups.find(g => g.id === activeGroupId)?.name} の入力</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>ステータス:</span>
                <span className={`status-badge status-${monthStatus}`}>
                  {monthStatus === 'draft' ? '未提出' : monthStatus === 'submitted' ? '提出済' : '承認済'}
                </span>
                {!isEditing && monthStatus === 'draft' && (
                  <button className="btn-primary" onClick={handleSubmitAll} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                    <Send size={16} style={{ marginRight: '0.5rem' }}/> この月を提出する
                  </button>
                )}
                {!isEditing && monthStatus === 'submitted' && (
                  <button className="btn-secondary" onClick={handleWithdraw} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    <X size={16} style={{ marginRight: '0.5rem' }}/> 提出を取り下げる
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isEditing ? (
                  <>
                    <button className="btn-secondary" onClick={handleCancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <X size={18} /> キャンセル
                    </button>
                    <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Save size={18} /> 保存する
                    </button>
                  </>
                ) : (
                  <button 
                    className="btn-secondary" 
                    onClick={handleEditClick} 
                    disabled={isMonthLocked}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    title={isMonthLocked ? '提出済みのため編集できません' : ''}
                  >
                    <Edit2 size={18} /> 編集モード
                  </button>
                )}
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndColumns}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap', minWidth: '100px' }}>スタッフコード</th>
                      <th style={{ whiteSpace: 'nowrap', minWidth: '120px' }}>氏名</th>
                      <SortableContext items={activeGroupFields.map(gf => gf.attendanceFieldId)} strategy={horizontalListSortingStrategy}>
                        {activeGroupFields.map(gf => (
                          <SortableHeader key={gf.attendanceFieldId} id={gf.attendanceFieldId}>
                            {gf.attendanceField.name}
                            {gf.required && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>}
                          </SortableHeader>
                        ))}
                      </SortableContext>
                    </tr>
                  </thead>
                <tbody>
                  {activeRecords.length === 0 ? (
                    <tr><td colSpan={2 + activeGroupFields.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>対象の従業員が見つかりません</td></tr>
                  ) : (
                    activeRecords.map(record => {
                      return (
                        <tr key={record.employee.id} style={{ backgroundColor: isMonthLocked ? 'var(--background)' : 'transparent' }}>
                          <td style={{ whiteSpace: 'nowrap' }}>{record.employee.employeeCode}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{record.employee.name}</td>
                          {activeGroupFields.map(gf => {
                            const isCommon = (gf.attendanceField as any).isCommon;
                            const currentGroupId = record.snapshotSalaryGroupId || record.employee.salaryGroupId;
                            const isLinked = allGroupFields.some(agf => 
                              agf.salaryGroupId === currentGroupId && 
                              agf.attendanceFieldId === gf.attendanceFieldId
                            );
                            const canEdit = isCommon || isLinked;
                            const isCellDisabled = isMonthLocked || !canEdit;

                          return (
                            <td key={gf.attendanceFieldId} style={{ backgroundColor: !canEdit ? 'var(--background)' : undefined }}>
                              {isEditing ? (
                                <input 
                                  type={gf.attendanceField.fieldType === 'number' ? 'number' : 'text'}
                                  step={gf.attendanceField.fieldType === 'number' ? '0.5' : undefined}
                                  placeholder={gf.attendanceField.fieldType === 'time' ? 'hh:mm' : undefined}
                                  pattern={gf.attendanceField.fieldType === 'time' ? '^[0-9]+:[0-5][0-9]$' : undefined}
                                  title={gf.attendanceField.fieldType === 'time' ? '時間は hh:mm の形式で入力してください（例: 158:30）' : undefined}
                                  className="form-control"
                                  style={{ 
                                    width: '100%', 
                                    minWidth: '60px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.9rem',
                                    backgroundColor: isCellDisabled ? 'var(--border)' : undefined, 
                                    opacity: isCellDisabled ? 0.6 : 1 
                                  }}
                                  value={editValues[record.employee.id]?.[gf.attendanceFieldId] ?? ''}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    if (gf.attendanceField.fieldType === 'time') {
                                      val = val.replace(/[^0-9:]/g, '');
                                      const parts = val.split(':');
                                      if (parts.length > 2) {
                                        val = parts[0] + ':' + parts.slice(1).join('').replace(/:/g, '');
                                      }
                                      if (parts.length >= 2 && parts[1].length > 2) {
                                        val = parts[0] + ':' + parts[1].slice(0, 2);
                                      }
                                    }
                                    handleValueChange(record.employee.id, gf.attendanceFieldId, val);
                                  }}
                                  onBlur={(e) => {
                                    let val = e.target.value;
                                    if (gf.attendanceField.fieldType === 'time' && val) {
                                      if (!val.includes(':')) {
                                        val = `${val}:00`;
                                      } else if (val.endsWith(':')) {
                                        val = `${val}00`;
                                      } else {
                                        const parts = val.split(':');
                                        if (parts[1].length === 1) {
                                          val = `${parts[0]}:${parts[1]}0`;
                                        }
                                      }
                                      handleValueChange(record.employee.id, gf.attendanceFieldId, val);
                                    }
                                  }}
                                  disabled={isCellDisabled}
                                />
                              ) : (
                                <span style={{ opacity: canEdit ? 1 : 0.3, display: 'inline-block', width: '100%', padding: '0.25rem 0.5rem' }}>
                                  {canEdit ? (
                                    (record.values[gf.attendanceFieldId] !== null && record.values[gf.attendanceFieldId] !== undefined && record.values[gf.attendanceFieldId] !== '')
                                      ? record.values[gf.attendanceFieldId]
                                      : (gf.attendanceField.fieldType === 'number' ? '0' : gf.attendanceField.fieldType === 'time' ? '00:00' : '-')
                                  ) : '-'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
            </DndContext>
          </div>
        </div>
      ))}

      {/* VALIDATION ERROR MODAL */}
      {showValidationModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '2rem', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                <AlertCircle size={24} /> 提出エラー
              </h3>
              <button onClick={() => setShowValidationModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <p style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>
              自動チェックで以下のエラーが検出されました。<br/>内容を修正してから再度提出してください。
            </p>

            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #F87171', borderRadius: '6px', padding: '1rem', marginBottom: '1.5rem' }}>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#991B1B', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {validationErrors.map((err, idx) => (
                  <li key={idx}><strong>{err.employeeName}</strong>: {err.errorMessage}</li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowValidationModal(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
