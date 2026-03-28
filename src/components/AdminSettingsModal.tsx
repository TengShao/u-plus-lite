'use client'
import { useEffect, useState } from 'react'
import { LEVELS, BUDGET_ITEMS } from '@/lib/constants'

type User = { id: number; name: string; role: string; level: string | null }

type Tab = 'members' | 'budget'

type EditingMember = { id: number; name: string; level: string; role: string }

export default function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const [users, setUsers] = useState<User[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', level: '', role: 'MEMBER' })
  const [editingMember, setEditingMember] = useState<EditingMember | null>(null)

  // Budget items state - flatten for easier management
  const [budgetItems, setBudgetItems] = useState<Record<string, string[]>>(BUDGET_ITEMS)
  const [newItemPipeline, setNewItemPipeline] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newPipelineName, setNewPipelineName] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }

  async function updateUser(userId: number, data: { name?: string; role?: string; level?: string }) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    }
  }

  async function deleteUser(userId: number) {
    if (!confirm('确定删除该成员？')) return
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    }
  }

  function startAddMember() {
    setIsAdding(true)
    setNewMember({ name: '', level: '', role: 'MEMBER' })
  }

  async function confirmAddMember() {
    if (!newMember.name.trim()) {
      alert('请填写姓名')
      return
    }
    const defaultPassword = '12345678'
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMember.name.trim(), password: defaultPassword, confirmPassword: defaultPassword }),
    })
    if (res.ok) {
      const created = await res.json()
      // Update with selected level and role
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: created.id, level: newMember.level || undefined, role: newMember.role }),
      })
      setIsAdding(false)
      fetchUsers()
    } else {
      const err = await res.json()
      alert(err.error || '添加失败')
    }
  }

  function cancelAddMember() {
    setIsAdding(false)
    setNewMember({ name: '', level: '', role: 'MEMBER' })
  }

  function startEditMember(user: User) {
    setEditingMember({ id: user.id, name: user.name, level: user.level || '', role: user.role })
  }

  async function confirmEditMember() {
    if (!editingMember) return
    const { id, name, level, role } = editingMember
    if (!name.trim()) {
      alert('请填写姓名')
      return
    }
    await updateUser(id, { name: name.trim(), level: level || undefined, role })
    setEditingMember(null)
  }

  function cancelEditMember() {
    setEditingMember(null)
  }

  function addBudgetItem() {
    if (!newItemPipeline || !newItemName.trim()) return
    setBudgetItems((prev) => ({
      ...prev,
      [newItemPipeline]: [...(prev[newItemPipeline] || []), newItemName.trim()]
    }))
    setNewItemName('')
  }

  function deleteBudgetItem(pipeline: string, index: number) {
    if (!confirm('确定删除该预算项？')) return
    setBudgetItems((prev) => ({
      ...prev,
      [pipeline]: prev[pipeline].filter((_, i) => i !== index)
    }))
  }

  function addPipeline() {
    if (!newPipelineName.trim()) return
    setBudgetItems((prev) => ({
      ...prev,
      [newPipelineName.trim()]: []
    }))
    setNewPipelineName('')
  }

  function deletePipeline(pipeline: string) {
    if (!confirm(`确定删除"${pipeline}"管线及其所有预算项？`)) return
    setBudgetItems((prev) => {
      const copy = { ...prev }
      delete copy[pipeline]
      return copy
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="max-h-[80vh] w-[700px] overflow-hidden rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header with tabs */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('members')}
              className={`text-lg font-bold ${activeTab === 'members' ? 'text-black' : 'text-gray-400'}`}
            >
              成员管理
            </button>
            <button
              onClick={() => setActiveTab('budget')}
              className={`text-lg font-bold ${activeTab === 'budget' ? 'text-black' : 'text-gray-400'}`}
            >
              预算项管理
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-auto p-6">
          {activeTab === 'members' ? (
            <>
              {/* Add member button */}
              <div className="mb-4 flex justify-end">
                <button
                  onClick={startAddMember}
                  disabled={isAdding}
                  className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  新增成员
                </button>
              </div>

              {/* Members table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">姓名</th>
                    <th className="pb-2">职级</th>
                    <th className="pb-2">角色</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {isAdding && (
                    <tr className="border-b bg-gray-50">
                      <td className="py-2">
                        <input
                          type="text"
                          value={newMember.name}
                          onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                          className="w-24 rounded border px-2 py-1 text-sm"
                          placeholder="姓名"
                          autoFocus
                        />
                      </td>
                      <td className="py-2">
                        <select
                          value={newMember.level}
                          onChange={(e) => setNewMember({ ...newMember, level: e.target.value })}
                          className="rounded border px-2 py-1 text-sm"
                        >
                          <option value="">未设置</option>
                          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </td>
                      <td className="py-2">
                        <select
                          value={newMember.role}
                          onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                          className="rounded border px-2 py-1 text-sm"
                        >
                          <option value="MEMBER">成员</option>
                          <option value="ADMIN">管理员</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={confirmAddMember} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                          <button onClick={cancelAddMember} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.id} className={`border-b ${editingMember?.id === u.id ? 'bg-gray-50' : ''}`}>
                      {editingMember?.id === u.id ? (
                        <>
                          <td className="py-2">
                            <input
                              type="text"
                              value={editingMember.name}
                              onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                              className="w-24 rounded border px-2 py-1 text-sm"
                              autoFocus
                            />
                          </td>
                          <td className="py-2">
                            <select
                              value={editingMember.level}
                              onChange={(e) => setEditingMember({ ...editingMember, level: e.target.value })}
                              className="rounded border px-2 py-1 text-sm"
                            >
                              <option value="">未设置</option>
                              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          </td>
                          <td className="py-2">
                            <select
                              value={editingMember.role}
                              onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                              className="rounded border px-2 py-1 text-sm"
                            >
                              <option value="MEMBER">成员</option>
                              <option value="ADMIN">管理员</option>
                            </select>
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <button onClick={confirmEditMember} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                              <button onClick={cancelEditMember} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2">{u.name}</td>
                          <td className="py-2">{u.level || '-'}</td>
                          <td className="py-2">{u.role === 'ADMIN' ? '管理员' : '成员'}</td>
                          <td className="py-2">
                            <div className="flex gap-3">
                              <button
                                onClick={() => startEditMember(u)}
                                className="text-blue-500 hover:text-blue-700 text-xs"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => deleteUser(u.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              {/* Add pipeline form */}
              <div className="mb-4 flex gap-2 items-end">
                <input
                  type="text"
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  className="w-32 rounded border px-2 py-1 text-sm"
                  placeholder="新管线名称"
                />
                <button
                  onClick={addPipeline}
                  className="px-4 py-1 bg-black text-white rounded text-sm hover:bg-gray-800"
                >
                  新增管线
                </button>
              </div>

              {/* Budget items */}
              {Object.entries(budgetItems).map(([pipeline, items]) => (
                <div key={pipeline} className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold">{pipeline}</h3>
                    <button
                      onClick={() => deletePipeline(pipeline)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      删除管线
                    </button>
                  </div>

                  {/* Add item form */}
                  <div className="mb-2 flex gap-2">
                    <input
                      type="text"
                      value={newItemPipeline === pipeline ? newItemName : ''}
                      onChange={(e) => {
                        setNewItemPipeline(pipeline)
                        setNewItemName(e.target.value)
                      }}
                      className="flex-1 rounded border px-2 py-1 text-sm"
                      placeholder="新增预算项"
                    />
                    <button
                      onClick={() => {
                        if (newItemPipeline === pipeline && newItemName.trim()) {
                          addBudgetItem()
                        }
                      }}
                      className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
                    >
                      添加
                    </button>
                  </div>

                  {/* Items list */}
                  <div className="space-y-1">
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded text-sm">
                        <span>{item}</span>
                        <button
                          onClick={() => deleteBudgetItem(pipeline, index)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-gray-400 text-sm py-2">暂无预算项</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
