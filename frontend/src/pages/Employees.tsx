import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle, RefreshCw, Trash } from 'lucide-react';
import api from '../services/api';

interface SalaryGroup {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  salaryGroupId: string;
  paidLeaveBalance: number;
  salaryGroup: SalaryGroup;
  isDeleted: boolean;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryGroups, setSalaryGroups] = useState<SalaryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // モーダル・フォーム状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHardDeleteModalOpen, setIsHardDeleteModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  const [formData, setFormData] = useState({
    employeeCode: '',
    name: '',
    salaryGroupId: '',
    paidLeaveBalance: 0
  });
  const [errorMsg, setErrorMsg] = useState('');

  const fetchEmployees = async () => {
    try {
      const res = await api.get(`/employees?includeDeleted=${includeDeleted}`);
      setEmployees(res.data);
    } catch (err) {
      console.error('Error fetching employees', err);
    }
  };

  const fetchSalaryGroups = async () => {
    try {
      const res = await api.get('/salary-groups');
      setSalaryGroups(res.data);
    } catch (err) {
      console.error('Error fetching salary groups', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchSalaryGroups()]).finally(() => {
      setLoading(false);
    });
  }, [includeDeleted]);

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({ employeeCode: '', name: '', salaryGroupId: salaryGroups[0]?.id || '', paidLeaveBalance: 0 });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({ employeeCode: emp.employeeCode, name: emp.name, salaryGroupId: emp.salaryGroupId, paidLeaveBalance: emp.paidLeaveBalance || 0 });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openDeleteModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setIsDeleteModalOpen(true);
  };

  const openHardDeleteModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setIsHardDeleteModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsHardDeleteModalOpen(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, {
          employeeCode: formData.employeeCode,
          name: formData.name,
          salaryGroupId: formData.salaryGroupId,
          paidLeaveBalance: formData.paidLeaveBalance
        });
      } else {
        await api.post('/employees', formData);
      }
      await fetchEmployees();
      closeModal();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!editingEmployee) return;
    try {
      await api.delete(`/employees/${editingEmployee.id}`);
      await fetchEmployees();
      closeModal();
    } catch (err) {
      setErrorMsg('削除に失敗しました');
    }
  };

  const handleRestore = async (emp: Employee) => {
    if (!window.confirm(`${emp.name} を復元しますか？`)) return;
    try {
      await api.put(`/employees/${emp.id}/restore`);
      await fetchEmployees();
    } catch (err) {
      alert('復元に失敗しました');
    }
  };

  const handleHardDelete = async () => {
    if (!editingEmployee) return;
    try {
      await api.delete(`/employees/${editingEmployee.id}/hard`);
      await fetchEmployees();
      closeModal();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || '完全な削除に失敗しました。関連データが存在する可能性があります。');
    }
  };

  if (loading) return <div>読み込み中...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>従業員管理</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <input 
              type="checkbox" 
              checked={includeDeleted} 
              onChange={(e) => setIncludeDeleted(e.target.checked)} 
            />
            削除済みも表示
          </label>
          <button className="btn-primary" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> 新規登録
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>スタッフコード</th>
              <th>氏名</th>
              <th>給与規定グループ</th>
              <th>有休残日数</th>
              <th style={{ width: '120px', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>従業員が登録されていません</td></tr>
            ) : employees.map(emp => (
              <tr key={emp.id} style={{ opacity: emp.isDeleted ? 0.6 : 1, backgroundColor: emp.isDeleted ? 'var(--background)' : 'inherit' }}>
                <td style={{ fontWeight: 500 }}>{emp.employeeCode}</td>
                <td>
                  {emp.name}
                  {emp.isDeleted && <span className="badge" style={{ marginLeft: '0.5rem', backgroundColor: 'var(--text-muted)' }}>削除済み</span>}
                </td>
                <td>
                  <span className="badge">{emp.salaryGroup.name}</span>
                </td>
                <td>{emp.paidLeaveBalance ?? 0} 日</td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    {emp.isDeleted ? (
                      <>
                        <button className="btn-secondary" onClick={() => handleRestore(emp)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <RefreshCw size={14} /> 復元
                        </button>
                        <button className="btn-danger" onClick={() => openHardDeleteModal(emp)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Trash size={14} /> 完全に削除
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="icon-btn" onClick={() => openEditModal(emp)} title="編集">
                          <Edit2 size={16} />
                        </button>
                        <button className="icon-btn delete-btn" onClick={() => openDeleteModal(emp)} title="削除">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 登録・編集モーダル */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingEmployee ? '従業員編集' : '従業員登録'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {errorMsg && <div className="alert-error"><AlertCircle size={16} /> {errorMsg}</div>}
                
                <div className="form-group">
                  <label>スタッフコード</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.employeeCode} 
                    onChange={e => setFormData({...formData, employeeCode: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>有休残日数</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="form-control" 
                    value={formData.paidLeaveBalance} 
                    onChange={e => setFormData({...formData, paidLeaveBalance: Number(e.target.value)})}
                  />
                </div>

                <div className="form-group">
                  <label>氏名</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>給与規定グループ</label>
                  <select 
                    className="form-control"
                    value={formData.salaryGroupId}
                    onChange={e => setFormData({...formData, salaryGroupId: e.target.value})}
                    required
                  >
                    <option value="" disabled>選択してください</option>
                    {salaryGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal}>キャンセル</button>
                <button type="submit" className="btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && editingEmployee && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ color: 'var(--danger)' }}>従業員削除</h2>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>以下の従業員を削除します。よろしいですか？</p>
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--background)', borderRadius: '6px' }}>
                <strong>{editingEmployee.name}</strong> ({editingEmployee.employeeCode})
              </div>
              {errorMsg && <div className="alert-error" style={{ marginTop: '1rem' }}><AlertCircle size={16} /> {errorMsg}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>キャンセル</button>
              <button type="button" className="btn-danger" onClick={handleDelete}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* 完全削除確認モーダル */}
      {isHardDeleteModalOpen && editingEmployee && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ color: 'var(--danger)' }}>従業員データの完全削除</h2>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} /> <strong>警告: この操作は取り消せません。</strong>
              </div>
              <p>以下の従業員データと、紐づくすべての勤怠データをデータベースから<strong>物理的に削除</strong>します。</p>
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--background)', borderRadius: '6px' }}>
                <strong>{editingEmployee.name}</strong> ({editingEmployee.employeeCode})
              </div>
              {errorMsg && <div className="alert-error" style={{ marginTop: '1rem' }}><AlertCircle size={16} /> {errorMsg}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>キャンセル</button>
              <button type="button" className="btn-danger" onClick={handleHardDelete}>完全に削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
