import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Edit2, Trash2, Save, X, AlertCircle, Layers, CheckSquare, GripVertical, Link as LinkIcon } from 'lucide-react';
import api from '../services/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
interface SalaryGroup {
  id: string;
  name: string;
  displayOrder?: number;
}
interface AttendanceField {
  id: string;
  name: string;
  fieldType: string;
  isCommon?: boolean;
  displayOrder?: number;
  csvEnabled?: boolean;
  csvLabel?: string | null;
}
interface SalaryGroupField {
  id: string;
  salaryGroupId: string;
  attendanceFieldId: string;
  required: boolean;
  displayOrder: number;
  attendanceField?: AttendanceField;
}
interface MappingState {
  attendanceFieldId: string;
  required: boolean;
  displayOrder: number;
  isLinked: boolean;
  isCommon: boolean;
}
interface ValidationRule {
  id: string;
  salaryGroupId: string;
  attendanceFieldId: string;
  operator: string;
  referenceValue: string | null;
  errorMessage: string;
}
interface User {
  id: string;
  loginId: string;
  name: string;
  role: string;
  createdAt: string;
}

// --- Sortable Row Component ---
function SortableRow({ id, children, dragHandleProps }: { id: string, children: React.ReactNode, dragHandleProps?: any }) {
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
    zIndex: isDragging ? 1 : 0,
    position: isDragging ? 'relative' as const : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: '40px', textAlign: 'center', cursor: 'grab' }} {...attributes} {...listeners} {...dragHandleProps}>
        <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
      </td>
      {children}
    </tr>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'groups' | 'fields' | 'mappings' | 'validations' | 'users'>('groups');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // --- Data States ---
  const [groups, setGroups] = useState<SalaryGroup[]>([]);
  const [fields, setFields] = useState<AttendanceField[]>([]);
  const [mappingState, setMappingState] = useState<MappingState[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // --- Fetching ---
  const fetchGroups = async () => {
    try {
      const res = await api.get('/salary-groups');
      setGroups(res.data);
    } catch (err) {
      setErrorMsg('グループの取得に失敗しました');
    }
  };
  const fetchFields = async () => {
    try {
      const res = await api.get('/fields');
      setFields(res.data);
    } catch (err) {
      setErrorMsg('項目の取得に失敗しました');
    }
  };
  const fetchValidationRules = async () => {
    try {
      const res = await api.get('/validation-rules');
      setValidationRules(res.data);
    } catch (err) { setErrorMsg('バリデーションルールの取得に失敗しました'); }
  };
  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) { setErrorMsg('ユーザーの取得に失敗しました'); }
  };

  useEffect(() => {
    fetchGroups();
    fetchFields();
    fetchValidationRules();
    fetchUsers();
    fetchCsvBaseColumns();
  }, []);

  // --- DND Sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- CSV基本列設定 ---
  interface CsvBaseColConfig { enabled: boolean; label: string; }
  interface CsvBaseColumns {
    employeeCode: CsvBaseColConfig;
    name: CsvBaseColConfig;
    targetMonth: CsvBaseColConfig;
  }
  const DEFAULT_CSV_BASE: CsvBaseColumns = {
    employeeCode: { enabled: true, label: 'スタッフコード' },
    name:         { enabled: true, label: '氏名' },
    targetMonth:  { enabled: true, label: '対象年月' },
  };
  const [csvBaseColumns, setCsvBaseColumns] = useState<CsvBaseColumns>(DEFAULT_CSV_BASE);
  const [csvBaseSaving, setCsvBaseSaving] = useState(false);

  const fetchCsvBaseColumns = async () => {
    try {
      const res = await api.get('/system-settings/csv-base-columns');
      setCsvBaseColumns({ ...DEFAULT_CSV_BASE, ...res.data });
    } catch (err) {
      // 設定取得失敗時はデフォルト値を使用
    }
  };

  const handleSaveCsvBaseColumns = async () => {
    setCsvBaseSaving(true);
    try {
      await api.put('/system-settings/csv-base-columns', csvBaseColumns);
      setSuccessMsg('CSV基本列設定を保存しました');
    } catch (err) {
      setErrorMsg('CSV基本列設定の保存に失敗しました');
    } finally {
      setCsvBaseSaving(false);
    }
  };

  const updateCsvBaseCol = (key: keyof CsvBaseColumns, field: 'enabled' | 'label', value: boolean | string) => {
    setCsvBaseColumns(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  // --- Handlers: Groups ---
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await api.post('/salary-groups', { name: newGroupName });
      setNewGroupName('');
      fetchGroups();
      setSuccessMsg('グループを作成しました');
    } catch (err) { setErrorMsg('作成に失敗しました'); }
  };
  const handleUpdateGroup = async (id: string) => {
    try {
      await api.put(`/salary-groups/${id}`, { name: editGroupName });
      setEditingGroupId(null);
      fetchGroups();
      setSuccessMsg('グループを更新しました');
    } catch (err) { setErrorMsg('更新に失敗しました'); }
  };

  const handleDragEndGroups = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      const newGroups = arrayMove(groups, oldIndex, newIndex);
      setGroups(newGroups);

      // 保存APIコール
      try {
        const payload = newGroups.map((g, idx) => ({ id: g.id, displayOrder: idx }));
        await api.put('/salary-groups/reorder/all', { items: payload });
        setSuccessMsg('並び順を保存しました');
      } catch (err) {
        setErrorMsg('並び順の保存に失敗しました');
      }
    }
  };

  // --- Handlers: Fields ---
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('number');
  const [newFieldIsCommon, setNewFieldIsCommon] = useState(false);

  // CSV設定編集状態
  const [editingCsvFieldId, setEditingCsvFieldId] = useState<string | null>(null);
  const [editCsvLabel, setEditCsvLabel] = useState('');

  const handleCreateField = async () => {
    if (!newFieldName.trim()) return;
    try {
      await api.post('/fields', { name: newFieldName, fieldType: newFieldType, isCommon: newFieldIsCommon });
      setNewFieldName('');
      setNewFieldIsCommon(false);
      fetchFields();
      setSuccessMsg('項目を作成しました');
    } catch (err) { setErrorMsg('項目の作成に失敗しました'); }
  };
  const handleDeleteField = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return;
    try {
      await api.delete(`/fields/${id}`);
      fetchFields();
      setSuccessMsg('項目を削除しました');
    } catch (err) { setErrorMsg('削除に失敗しました'); }
  };
  const handleToggleCommon = async (field: AttendanceField) => {
    try {
      await api.put(`/fields/${field.id}`, {
        name: field.name,
        fieldType: field.fieldType,
        isCommon: !field.isCommon,
        csvEnabled: field.csvEnabled !== false,
        csvLabel: field.csvLabel || null
      });
      fetchFields();
    } catch (err) { setErrorMsg('更新に失敗しました'); }
  };
  const handleToggleCsvEnabled = async (field: AttendanceField) => {
    try {
      await api.put(`/fields/${field.id}`, {
        name: field.name,
        fieldType: field.fieldType,
        isCommon: field.isCommon || false,
        csvEnabled: !(field.csvEnabled !== false),
        csvLabel: field.csvLabel || null
      });
      fetchFields();
    } catch (err) { setErrorMsg('CSV設定の更新に失敗しました'); }
  };
  const handleSaveCsvLabel = async (field: AttendanceField) => {
    try {
      await api.put(`/fields/${field.id}`, {
        name: field.name,
        fieldType: field.fieldType,
        isCommon: field.isCommon || false,
        csvEnabled: field.csvEnabled !== false,
        csvLabel: editCsvLabel.trim() || null
      });
      setEditingCsvFieldId(null);
      fetchFields();
      setSuccessMsg('CSV列名を保存しました');
    } catch (err) { setErrorMsg('CSV列名の保存に失敗しました'); }
  };

  // --- Field Mappings Modal ---
  const [selectedFieldForMapping, setSelectedFieldForMapping] = useState<AttendanceField | null>(null);
  const [fieldMappingGroups, setFieldMappingGroups] = useState<string[]>([]);

  const openFieldMappingModal = async (field: AttendanceField) => {
    setSelectedFieldForMapping(field);
    try {
      const res = await api.get(`/fields/${field.id}/salary-groups`);
      setFieldMappingGroups(res.data); // array of groupIds
    } catch (err) {
      setErrorMsg('グループ紐付けの取得に失敗しました');
    }
  };

  const toggleFieldMappingGroup = (groupId: string) => {
    setFieldMappingGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const saveFieldMapping = async () => {
    if (!selectedFieldForMapping) return;
    try {
      await api.put(`/fields/${selectedFieldForMapping.id}/salary-groups`, { groupIds: fieldMappingGroups });
      setSelectedFieldForMapping(null);
      setSuccessMsg('グループ紐付けを保存しました');
    } catch (err) {
      setErrorMsg('グループ紐付けの保存に失敗しました');
    }
  };

  const handleDragEndFields = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      const newFields = arrayMove(fields, oldIndex, newIndex);
      setFields(newFields);

      // 保存APIコール
      try {
        const payload = newFields.map((f, idx) => ({ id: f.id, displayOrder: idx }));
        await api.put('/fields/reorder/all', { items: payload });
        setSuccessMsg('並び順を保存しました');
      } catch (err) {
        setErrorMsg('並び順の保存に失敗しました');
      }
    }
  };

  // --- Handlers: Mappings ---
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  
  useEffect(() => {
    if (activeTab === 'mappings' && selectedGroupId) {
      fetchGroupFields(selectedGroupId);
    }
  }, [activeTab, selectedGroupId]);

  const fetchGroupFields = async (groupId: string) => {
    try {
      const res = await api.get(`/salary-group-fields/${groupId}`);
      const data: SalaryGroupField[] = res.data;
      
      const initialState = fields.map(f => {
        const existing = data.find(d => d.attendanceFieldId === f.id);
        const isCommon = f.isCommon || false;
        return {
          attendanceFieldId: f.id,
          required: existing ? existing.required : false,
          displayOrder: existing ? existing.displayOrder : 999,
          isLinked: isCommon || !!existing, // 共通項目は自動的に表示ON
          isCommon
        };
      });
      initialState.sort((a, b) => a.displayOrder - b.displayOrder);
      setMappingState(initialState);
    } catch (err) {
      setErrorMsg('紐付けの取得に失敗しました');
    }
  };

  const handleSaveMappings = async () => {
    if (!selectedGroupId) return;
    try {
      // 画面の並び順に基づいてdisplayOrderを再設定。isCommonは除外するかバックエンド側でフィルタされるが、送っておく。
      const payload = mappingState.filter(m => m.isLinked && !m.isCommon).map((m, idx) => ({
        attendanceFieldId: m.attendanceFieldId,
        required: m.required,
        displayOrder: idx
      }));
      
      await api.post(`/salary-group-fields/${selectedGroupId}`, { fields: payload });
      setSuccessMsg('紐付け設定を保存しました');
      fetchGroupFields(selectedGroupId);
    } catch (err) {
      setErrorMsg('紐付けの保存に失敗しました');
    }
  };

  const toggleLink = (fieldId: string) => {
    setMappingState(prev => prev.map(m => {
      if (m.attendanceFieldId === fieldId && !m.isCommon) {
        return { ...m, isLinked: !m.isLinked };
      }
      return m;
    }));
  };
  const toggleRequired = (fieldId: string) => {
    setMappingState(prev => prev.map(m => m.attendanceFieldId === fieldId ? { ...m, required: !m.required } : m));
  };

  const handleDragEndMappings = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = mappingState.findIndex((m) => m.attendanceFieldId === active.id);
      const newIndex = mappingState.findIndex((m) => m.attendanceFieldId === over.id);
      const newMapping = arrayMove(mappingState, oldIndex, newIndex);
      // Mappingsは「設定を保存」ボタンで一括保存するため、ここではStateのみ更新
      setMappingState(newMapping);
    }
  };

  // --- Handlers: Validations ---
  const [newValidation, setNewValidation] = useState({ salaryGroupId: '', attendanceFieldId: '', operator: '==', referenceValue: '', errorMessage: '' });
  const [selectedSumFields, setSelectedSumFields] = useState<string[]>([]);
  const [selectedTargetGroups, setSelectedTargetGroups] = useState<string[]>([]);

  const handleCreateValidation = async () => {
    if (selectedTargetGroups.length === 0) {
      setErrorMsg('対象グループを1つ以上選択してください');
      return;
    }
    try {
      const payload = { ...newValidation };
      if (payload.operator === 'EQUALS_SUM') {
        payload.referenceValue = selectedSumFields.join(',');
      }
      
      const promises = selectedTargetGroups.map(groupId => 
        api.post('/validation-rules', { ...payload, salaryGroupId: groupId })
      );
      await Promise.all(promises);

      fetchValidationRules();
      setNewValidation({ salaryGroupId: '', attendanceFieldId: '', operator: '==', referenceValue: '', errorMessage: '' });
      setSelectedSumFields([]);
      setSelectedTargetGroups([]);
      setSuccessMsg('バリデーションルールを追加しました');
    } catch (err) { setErrorMsg('追加に失敗しました'); }
  };
  const handleDeleteValidation = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    try {
      await api.delete(`/validation-rules/${id}`);
      fetchValidationRules();
    } catch (err) { setErrorMsg('削除に失敗しました'); }
  };

  // --- Handlers: Users ---
  const [newUser, setNewUser] = useState({ loginId: '', password: '', name: '', role: 'GENERAL' });
  const handleCreateUser = async () => {
    try {
      await api.post('/users', newUser);
      fetchUsers();
      setNewUser({ loginId: '', password: '', name: '', role: 'GENERAL' });
      setSuccessMsg('ユーザーを追加しました');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'ユーザーの追加に失敗しました');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('このユーザーを削除しますか？')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
      setSuccessMsg('ユーザーを削除しました');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'ユーザーの削除に失敗しました');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>設定</h1>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => { setActiveTab('groups'); setErrorMsg(''); setSuccessMsg(''); }} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'groups' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'groups' ? 'bold' : 'normal', color: activeTab === 'groups' ? 'var(--primary)' : 'var(--text-muted)' }}><Layers size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>給与規定グループ</button>
        <button className={`tab-btn ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => { setActiveTab('fields'); setErrorMsg(''); setSuccessMsg(''); }} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'fields' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'fields' ? 'bold' : 'normal', color: activeTab === 'fields' ? 'var(--primary)' : 'var(--text-muted)' }}><CheckSquare size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>勤怠項目マスタ</button>
        <button className={`tab-btn ${activeTab === 'mappings' ? 'active' : ''}`} onClick={() => { setActiveTab('mappings'); setErrorMsg(''); setSuccessMsg(''); }} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'mappings' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'mappings' ? 'bold' : 'normal', color: activeTab === 'mappings' ? 'var(--primary)' : 'var(--text-muted)' }}><SettingsIcon size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>グループ別項目紐付け</button>
        <button className={`tab-btn ${activeTab === 'validations' ? 'active' : ''}`} onClick={() => { setActiveTab('validations'); setErrorMsg(''); setSuccessMsg(''); }} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'validations' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'validations' ? 'bold' : 'normal', color: activeTab === 'validations' ? 'var(--primary)' : 'var(--text-muted)' }}><AlertCircle size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>自動チェック設定</button>
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setErrorMsg(''); setSuccessMsg(''); }} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: activeTab === 'users' ? 'bold' : 'normal', color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)' }}>ユーザー管理</button>
      </div>

      {errorMsg && <div className="alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {errorMsg}</div>}
      {successMsg && <div className="alert-error" style={{ marginBottom: '1rem', backgroundColor: '#D1FAE5', color: 'var(--success)' }}>{successMsg}</div>}

      {/* GROUPS TAB */}
      {activeTab === 'groups' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3>給与規定グループ管理</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>左端のアイコンをドラッグ＆ドロップして表示順を変更できます。</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="新しいグループ名" 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <button className="btn-primary" onClick={handleCreateGroup}><Plus size={16} /> 追加</button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndGroups}>
            <table className="data-table">
              <thead><tr><th style={{ width: '40px' }}></th><th>グループ名</th><th style={{ width: '150px' }}>操作</th></tr></thead>
              <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {groups.map(group => (
                    <SortableRow key={group.id} id={group.id}>
                      <td>
                        {editingGroupId === group.id ? (
                          <input type="text" className="form-control" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} />
                        ) : ( group.name )}
                      </td>
                      <td>
                        {editingGroupId === group.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleUpdateGroup(group.id)}><Save size={14} /></button>
                            <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setEditingGroupId(null)}><X size={14} /></button>
                          </div>
                        ) : (
                          <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }}><Edit2 size={14} /> 編集</button>
                        )}
                      </td>
                    </SortableRow>
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

      {/* FIELDS TAB */}
      {activeTab === 'fields' && (
        <div className="card" style={{ padding: '1.5rem' }}>

          {/* CSV基本列設定セクション */}
          <div style={{ marginBottom: '2rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--background)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ margin: 0, marginBottom: '0.25rem' }}>CSV基本列設定</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>スタッフコード・氏名・対象年月のCsv出力要否と列名を設定できます。</p>
              </div>
              <button
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={handleSaveCsvBaseColumns}
                disabled={csvBaseSaving}
              >
                <Save size={14} />保存
              </button>
            </div>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>列名</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>CSV出力</th>
                  <th>CSV列名(別名)</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { key: 'employeeCode' as const, label: 'スタッフコード' },
                  { key: 'name' as const, label: '氏名' },
                  { key: 'targetMonth' as const, label: '対象年月' },
                ]).map(col => (
                  <tr key={col.key}>
                    <td style={{ fontWeight: 500 }}>{col.label}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={csvBaseColumns[col.key].enabled}
                        onChange={e => updateCsvBaseCol(col.key, 'enabled', e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                        placeholder={col.label}
                        value={csvBaseColumns[col.key].label}
                        onChange={e => updateCsvBaseCol(col.key, 'label', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>勤怠項目マスタ管理</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>左端のアイコンをドラッグ＆ドロップして表示順を変更できます。</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="新しい項目名（例：残業時間）" 
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              style={{ flex: 2 }}
            />
            <select className="form-control" value={newFieldType} onChange={e => setNewFieldType(e.target.value)} style={{ flex: 1 }}>
              <option value="number">数値</option>
              <option value="time">時間 (hh:mm)</option>
              <option value="text">テキスト</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={newFieldIsCommon} onChange={e => setNewFieldIsCommon(e.target.checked)} />
              共通項目
            </label>
            <button className="btn-primary" onClick={handleCreateField}><Plus size={16} /> 追加</button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndFields}>
            <table className="data-table">
              <thead><tr><th style={{ width: '40px' }}></th><th>項目名</th><th>データ型</th><th style={{ textAlign: 'center' }}>共通</th><th style={{ textAlign: 'center' }}>CSV出力</th><th>CSV列名(別名)</th><th style={{ width: '100px' }}>操作</th></tr></thead>
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {fields.map(field => (
                    <SortableRow key={field.id} id={field.id}>
                      <td>{field.name}</td>
                      <td>
                        {field.fieldType === 'number' ? '数値' : 
                         field.fieldType === 'time' ? '時間 (hh:mm)' : 'テキスト'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={field.isCommon || false} onChange={() => handleToggleCommon(field)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={field.csvEnabled !== false}
                          onChange={() => handleToggleCsvEnabled(field)}
                          title="CSV出力に含めるか"
                        />
                      </td>
                      <td>
                        {editingCsvFieldId === field.id ? (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
                              placeholder={field.name}
                              value={editCsvLabel}
                              onChange={e => setEditCsvLabel(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveCsvLabel(field); if (e.key === 'Escape') setEditingCsvFieldId(null); }}
                              autoFocus
                            />
                            <button className="btn-primary" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleSaveCsvLabel(field)}><Save size={12} /></button>
                            <button className="btn-secondary" style={{ padding: '0.2rem 0.4rem' }} onClick={() => setEditingCsvFieldId(null)}><X size={12} /></button>
                          </div>
                        ) : (
                          <div
                            onClick={() => { setEditingCsvFieldId(field.id); setEditCsvLabel(field.csvLabel || ''); }}
                            style={{ cursor: 'pointer', padding: '0.2rem 0.4rem', borderRadius: '4px', minHeight: '1.6em', color: field.csvLabel ? 'var(--text-main)' : 'var(--text-muted)', fontStyle: field.csvLabel ? 'normal' : 'italic', fontSize: '0.85rem' }}
                            title="クリックして編集"
                          >
                            {field.csvLabel || '(未設定 - 項目名を使用)'}
                          </div>
                        )}
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => openFieldMappingModal(field)}>
                          <LinkIcon size={14} style={{ marginRight: '0.25rem' }} /> グループ紐付け
                        </button>
                        <button className="btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDeleteField(field.id)}><Trash2 size={14} /></button>
                      </td>
                    </SortableRow>
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

      {/* MAPPINGS TAB */}
      {activeTab === 'mappings' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3>グループ別項目紐付け設定</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>左端のアイコンをドラッグ＆ドロップして表示順を変更できます。「設定を保存」ボタンで確定します。</p>
          
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ fontWeight: 500 }}>対象グループ:</label>
            <select className="form-control" style={{ width: '300px' }} value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
              <option value="">-- 選択してください --</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {selectedGroupId && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn-primary" onClick={handleSaveMappings}><Save size={16} style={{ marginRight: '0.5rem' }}/> 設定を保存</button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndMappings}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th style={{ width: '60px', textAlign: 'center' }}>表示</th>
                      <th>項目名</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>必須</th>
                    </tr>
                  </thead>
                  <SortableContext items={mappingState.map(m => m.attendanceFieldId)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {mappingState.map((m) => {
                        const fieldDef = fields.find(f => f.id === m.attendanceFieldId);
                        return (
                          <SortableRow key={m.attendanceFieldId} id={m.attendanceFieldId}>
                            <td style={{ textAlign: 'center' }}>
                              <input type="checkbox" checked={m.isLinked} onChange={() => toggleLink(m.attendanceFieldId)} disabled={m.isCommon} />
                            </td>
                            <td style={{ opacity: m.isLinked ? 1 : 0.4 }}>
                              {fieldDef?.name} 
                              {m.isCommon && <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--surface)', padding: '0.1rem 0.3rem', borderRadius: '4px', marginLeft: '0.5rem', color: 'var(--primary)' }}>共通</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input type="checkbox" checked={m.required} onChange={() => toggleRequired(m.attendanceFieldId)} disabled={!m.isLinked || m.isCommon} />
                            </td>
                          </SortableRow>
                        );
                      })}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          )}
        </div>
      )}

      {/* VALIDATIONS TAB */}
      {activeTab === 'validations' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3>自動チェック設定 (バリデーション)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            提出時にシステムが自動でチェックする条件を設定します。条件に一致した場合（エラー）は提出がブロックされます。
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>対象グループ (複数選択可)</label>
              <div style={{ border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedTargetGroups.length === groups.length && groups.length > 0} 
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTargetGroups(groups.map(g => g.id));
                      else setSelectedTargetGroups([]);
                    }} 
                  />
                  全選択
                </label>
                {groups.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedTargetGroups.includes(g.id)} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTargetGroups([...selectedTargetGroups, g.id]);
                        else setSelectedTargetGroups(selectedTargetGroups.filter(id => id !== g.id));
                      }} 
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>対象項目</label>
              <select className="form-control" value={newValidation.attendanceFieldId} onChange={e => setNewValidation({...newValidation, attendanceFieldId: e.target.value})}>
                <option value="">項目を選択...</option>
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 0 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>条件式</label>
              <select className="form-control" value={newValidation.operator} onChange={e => setNewValidation({...newValidation, operator: e.target.value})}>
                <option value="==">と等しい (==)</option>
                <option value="!=">と異なる (!=)</option>
                <option value="<">より小さい (&lt;)</option>
                <option value="<=">以下 (&lt;=)</option>
                <option value=">">より大きい (&gt;)</option>
                <option value=">=">以上 (&gt;=)</option>
                <option value="NOT_EMPTY">空欄でない</option>
                <option value="EQUALS_SUM">他の項目の合計と等しい</option>
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{newValidation.operator === 'EQUALS_SUM' ? '合算する項目 (複数選択)' : '基準値'}</label>
              {newValidation.operator === 'EQUALS_SUM' ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {fields.map(f => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedSumFields.includes(f.id)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSumFields([...selectedSumFields, f.id]);
                          else setSelectedSumFields(selectedSumFields.filter(id => id !== f.id));
                        }} 
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
              ) : (
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="値 (空欄可)" 
                  disabled={newValidation.operator === 'NOT_EMPTY'}
                  value={newValidation.referenceValue}
                  onChange={e => setNewValidation({...newValidation, referenceValue: e.target.value})}
                />
              )}
            </div>
            <div style={{ flex: '2 1 200px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>エラーメッセージ</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="例: 出勤日数が不足しています" 
                value={newValidation.errorMessage}
                onChange={e => setNewValidation({...newValidation, errorMessage: e.target.value})}
              />
            </div>
            <button className="btn-primary" onClick={handleCreateValidation}><Plus size={16} /> 追加</button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>グループ</th>
                <th>項目</th>
                <th>条件 (エラーになる条件)</th>
                <th>エラーメッセージ</th>
                <th style={{ width: '80px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {validationRules.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>設定されたルールはありません</td></tr>
              ) : validationRules.map(rule => {
                const groupName = groups.find(g => g.id === rule.salaryGroupId)?.name || '不明';
                const fieldName = fields.find(f => f.id === rule.attendanceFieldId)?.name || '不明';
                
                let conditionText = '';
                if (rule.operator === 'NOT_EMPTY') {
                  conditionText = '空欄でない';
                } else if (rule.operator === 'EQUALS_SUM') {
                  const refFields = (rule.referenceValue || '').split(',').map(id => fields.find(f => f.id === id)?.name || '不明');
                  conditionText = `[ ${refFields.join(' + ')} ] と等しい`;
                } else {
                  conditionText = `${rule.operator} ${rule.referenceValue || ''}`;
                }

                return (
                  <tr key={rule.id}>
                    <td>{groupName}</td>
                    <td>{fieldName}</td>
                    <td>{conditionText}</td>
                    <td>{rule.errorMessage}</td>
                    <td>
                      <button className="btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDeleteValidation(rule.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3>システムユーザー管理</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            システムにログインするユーザー（管理者・一般）を管理します。
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ログインID</label>
              <input type="text" className="form-control" value={newUser.loginId} onChange={e => setNewUser({...newUser, loginId: e.target.value})} placeholder="半角英数字" />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>名前</label>
              <input type="text" className="form-control" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="表示名" />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>パスワード</label>
              <input type="password" className="form-control" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="••••••••" />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>権限</label>
              <select className="form-control" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="GENERAL">一般</option>
                <option value="ADMIN">管理者</option>
              </select>
            </div>
            <button className="btn-primary" onClick={handleCreateUser} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Plus size={16} /> 追加
            </button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>ログインID</th>
                <th>名前</th>
                <th>権限</th>
                <th style={{ width: '100px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>ユーザーがいません</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>{u.loginId}</td>
                  <td>{u.name}</td>
                  <td>
                    <span className={`status-badge ${u.role === 'ADMIN' ? 'status-approved' : 'status-draft'}`}>
                      {u.role === 'ADMIN' ? '管理者' : '一般'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn-icon" onClick={() => handleDeleteUser(u.id)} style={{ color: 'var(--danger)' }} title="削除">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FIELD MAPPING MODAL */}
      {selectedFieldForMapping && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '2rem', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>グループ紐付け: {selectedFieldForMapping.name}</h3>
              <button onClick={() => setSelectedFieldForMapping(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            {selectedFieldForMapping.isCommon ? (
              <div className="alert-error" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                この項目は「共通項目」として設定されているため、すべての給与規定グループに自動的に適用されます。
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                この勤怠項目を利用する給与規定グループを選択してください。
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
              {groups.map(g => {
                const isChecked = selectedFieldForMapping.isCommon || fieldMappingGroups.includes(g.id);
                return (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '4px', cursor: selectedFieldForMapping.isCommon ? 'not-allowed' : 'pointer', backgroundColor: selectedFieldForMapping.isCommon ? 'var(--background)' : 'transparent', opacity: selectedFieldForMapping.isCommon ? 0.7 : 1 }}>
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={() => toggleFieldMappingGroup(g.id)}
                      disabled={selectedFieldForMapping.isCommon}
                    />
                    {g.name}
                  </label>
                );
              })}
              {groups.length === 0 && <p style={{ color: 'var(--text-muted)' }}>給与規定グループが登録されていません。</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" onClick={() => setSelectedFieldForMapping(null)}>キャンセル</button>
              <button className="btn-primary" onClick={saveFieldMapping} disabled={selectedFieldForMapping.isCommon}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
