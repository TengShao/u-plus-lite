'use client'
import { Fragment, useEffect, useState } from 'react'
import { LEVELS } from '@/lib/constants'

type User = { id: number; name: string; role: string; level: string | null }
type BudgetItem = { id: number; name: string }
type Pipeline = { id: number; name: string; budgetItems: BudgetItem[] }

type Tab = 'members' | 'budget'

type EditingMember = { id: number; name: string; level: string; role: string }
type EditingBudgetItem = { id: number; pipelineId: number; name: string }

export default function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('members')
  const [users, setUsers] = useState<User[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', level: '', role: 'MEMBER' })
  const [editingMember, setEditingMember] = useState<EditingMember | null>(null)

  const [pipelines, setPipelines] = useState<Pipeline[]>([])

  const [isAddingBudgetItemPipelineId, setIsAddingBudgetItemPipelineId] = useState<number | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [editingBudgetItem, setEditingBudgetItem] = useState<EditingBudgetItem | null>(null)
  const [budgetItemSearch, setBudgetItemSearch] = useState('')
  const [expandedPipelines, setExpandedPipelines] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetchUsers()
    fetchSettings()
  }, [])

  async function fetchUsers() {
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }

  async function fetchSettings() {
    fetch('/api/settings').then((r) => r.json()).then(setPipelines)
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
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } else {
      const err = await res.json()
      alert(err.error || '删除失败')
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
      body: JSON.stringify({
        name: newMember.name.trim(),
        password: defaultPassword,
        confirmPassword: defaultPassword,
        role: newMember.role,
        level: newMember.level || undefined,
      }),
    })
    if (res.ok) {
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

  function startAddBudgetItem(pipelineId: number) {
    setIsAddingBudgetItemPipelineId(pipelineId)
    setNewItemName('')
  }

  function cancelAddBudgetItem() {
    setIsAddingBudgetItemPipelineId(null)
    setNewItemName('')
  }

  async function confirmAddBudgetItem() {
    if (!isAddingBudgetItemPipelineId || !newItemName.trim()) {
      alert('请填写预算项名称')
      return
    }
    const res = await fetch('/api/settings/budget-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItemName.trim(), pipelineId: isAddingBudgetItemPipelineId }),
    })
    if (res.ok) {
      setIsAddingBudgetItemPipelineId(null)
      setNewItemName('')
      fetchSettings()
    } else {
      const err = await res.json()
      alert(err.error || '添加失败')
    }
  }

  function startEditBudgetItem(item: BudgetItem, pipelineId: number) {
    setEditingBudgetItem({ id: item.id, pipelineId, name: item.name })
  }

  function cancelEditBudgetItem() {
    setEditingBudgetItem(null)
  }

  async function confirmEditBudgetItem() {
    if (!editingBudgetItem) return
    if (!editingBudgetItem.name.trim()) {
      alert('请填写预算项名称')
      return
    }
    const res = await fetch(`/api/settings/budget-items/${editingBudgetItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingBudgetItem.name.trim() }),
    })
    if (res.ok) {
      setEditingBudgetItem(null)
      fetchSettings()
    } else {
      const err = await res.json()
      alert(err.error || '更新失败')
    }
  }

  async function deleteBudgetItem(itemId: number) {
    const res = await fetch(`/api/settings/budget-items/${itemId}`, { method: 'DELETE' })
    if (res.ok) fetchSettings()
  }

  function togglePipeline(pipelineId: number) {
    setExpandedPipelines((prev) => ({ ...prev, [pipelineId]: !(prev[pipelineId] ?? true) }))
  }

  function isPipelineExpanded(pipelineId: number) {
    return expandedPipelines[pipelineId] ?? true
  }

  function getFilteredBudgetItems(pipeline: Pipeline) {
    const sortedItems = [...pipeline.budgetItems].sort((a, b) =>
      a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base' })
    )
    if (!budgetItemSearch.trim()) return sortedItems
    return sortedItems.filter((item) => matchesSearch(item.name))
  }

  function matchesSearch(name: string) {
    return name.toLowerCase().includes(budgetItemSearch.trim().toLowerCase())
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
                                onClick={() => { if (confirm('确定删除该成员？')) deleteUser(u.id) }}
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
              <div className="mb-4">
                <input
                  type="text"
                  value={budgetItemSearch}
                  onChange={(e) => setBudgetItemSearch(e.target.value)}
                  placeholder="搜索预算项"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">名称</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelines.map((pl) => {
                    const expanded = isPipelineExpanded(pl.id)
                    const filteredBudgetItems = getFilteredBudgetItems(pl)

                    return (
                      <Fragment key={pl.id}>
                        <tr className="border-b">
                          <td className="py-2 font-semibold">
                            <button
                              type="button"
                              onClick={() => togglePipeline(pl.id)}
                              className="inline-flex items-center gap-2"
                            >
                              <span className="text-xs text-gray-500">{expanded ? '▾' : '▸'}</span>
                              <span>{pl.name}</span>
                            </button>
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => startAddBudgetItem(pl.id)}
                              className="rounded bg-black px-3 py-1 text-xs text-white hover:bg-[#3A3A3A]"
                            >
                              新增预算项
                            </button>
                          </td>
                        </tr>

                        {expanded && isAddingBudgetItemPipelineId === pl.id && (
                          <tr key={`add-item-${pl.id}`} className="border-b bg-gray-50">
                            <td className="py-2 pl-6">
                              <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                className="w-48 rounded border px-2 py-1 text-sm"
                                placeholder="预算项名称"
                                autoFocus
                              />
                            </td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <button onClick={confirmAddBudgetItem} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                                <button onClick={cancelAddBudgetItem} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                              </div>
                            </td>
                          </tr>
                        )}

                        {expanded && filteredBudgetItems.map((item) => (
                          <tr key={`item-${item.id}`} className={`border-b ${editingBudgetItem?.id === item.id ? 'bg-gray-50' : ''}`}>
                            {editingBudgetItem?.id === item.id ? (
                              <>
                                <td className="py-2 pl-6">
                                  <input
                                    type="text"
                                    value={editingBudgetItem.name}
                                    onChange={(e) => setEditingBudgetItem({ ...editingBudgetItem, name: e.target.value })}
                                    className="w-48 rounded border px-2 py-1 text-sm"
                                    autoFocus
                                  />
                                </td>
                                <td className="py-2">
                                  <div className="flex gap-2">
                                    <button onClick={confirmEditBudgetItem} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                                    <button onClick={cancelEditBudgetItem} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 pl-6">{item.name}</td>
                                <td className="py-2">
                                  <div className="flex gap-3">
                                    <button onClick={() => startEditBudgetItem(item, pl.id)} className="text-blue-500 hover:text-blue-700 text-xs">编辑</button>
                                    <button
                                      onClick={() => { if (confirm('确定删除该预算项？')) deleteBudgetItem(item.id) }}
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

                        {expanded && budgetItemSearch.trim() && filteredBudgetItems.length === 0 && isAddingBudgetItemPipelineId !== pl.id && (
                          <tr className="border-b">
                            <td className="py-2 pl-6 text-xs text-gray-400" colSpan={2}>无匹配预算项</td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
