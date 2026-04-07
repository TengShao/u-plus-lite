'use client'
import { Fragment, useEffect, useState } from 'react'
import { LEVELS } from '@/lib/constants'
import ConfirmDialog from './ConfirmDialog'

function IconClear() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 3L11 11M3 11L11 3" stroke="#C8C8C8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const MASK_DOTS = '············'

type User = { id: number; name: string; role: string; level: string | null }
type BudgetItem = { id: number; name: string }
type Pipeline = { id: number; name: string; budgetItems: BudgetItem[] }

type Tab = 'members' | 'pipelines' | 'budget' | 'llm'

type EditingMember = { id: number; name: string; level: string; role: string }
type EditingBudgetItem = { id: number; pipelineId: number; name: string }
type EditingPipeline = { id: number; name: string }

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
  const [editingPipeline, setEditingPipeline] = useState<EditingPipeline | null>(null)
  const [pendingEditPipeline, setPendingEditPipeline] = useState<Pipeline | null>(null)
  const [pendingDeletePipeline, setPendingDeletePipeline] = useState<Pipeline | null>(null)
  const [budgetItemSearch, setBudgetItemSearch] = useState('')
  const [expandedPipelines, setExpandedPipelines] = useState<Record<number, boolean>>({})

  // LLM settings state
  const [llmProvider, setLlmProvider] = useState<'ollama' | 'minimax'>('ollama')
  const [llmOllamaModel, setLlmOllamaModel] = useState('qwen3:4b')
  const [llmMinimaxKey, setLlmMinimaxKey] = useState('')
  const [llmMinimaxKeySaved, setLlmMinimaxKeySaved] = useState(false)
  const [llmMinimaxKeyCleared, setLlmMinimaxKeyCleared] = useState(false)
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmMsg, setLlmMsg] = useState<string | null>(null)

  const [isAddingPipeline, setIsAddingPipeline] = useState(false)
  const [newPipelineName, setNewPipelineName] = useState('')
  const [newItemPipelineId, setNewItemPipelineId] = useState<number | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchSettings()
    fetchLLMSettings()
  }, [])

  async function fetchUsers() {
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }

  async function fetchSettings() {
    fetch('/api/settings').then((r) => r.json()).then(setPipelines)
  }

  async function fetchLLMSettings() {
    const r = await fetch('/api/settings/llm')
    if (r.ok) {
      const data = await r.json()
      setLlmProvider(data.provider as 'ollama' | 'minimax')
      setLlmOllamaModel(data.ollamaModel)
      setLlmMinimaxKeySaved(!!data.minimaxKeySet)
    }
  }

  async function saveLLMSettings() {
    setLlmSaving(true)
    setLlmMsg(null)
    // Determine minimaxKey value to send:
    // - empty string + was saved → null (delete key)
    // - empty string + was not saved → undefined (no change)
    // - has value → the value (update key)
    let minimaxKeyToSend: string | null | undefined
    if (llmMinimaxKey === '' && llmMinimaxKeyCleared) {
      // User explicitly cleared — delete key
      minimaxKeyToSend = null
    } else if (llmMinimaxKey === '') {
      // Empty but not explicitly cleared — no change
      minimaxKeyToSend = undefined
    } else if (llmMinimaxKey && llmMinimaxKey !== MASK_DOTS) {
      minimaxKeyToSend = llmMinimaxKey
    } else {
      minimaxKeyToSend = undefined
    }
    try {
      const res = await fetch('/api/settings/llm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: llmProvider,
          ollamaModel: llmOllamaModel,
          minimaxKey: minimaxKeyToSend,
        }),
      })
      if (res.ok) {
        setLlmMsg('保存成功')
        if (minimaxKeyToSend !== undefined && minimaxKeyToSend !== null) {
          // User typed a new key — save succeeded, clear input and show dots
          setLlmMinimaxKey('')
          setLlmMinimaxKeySaved(true)
        } else if (minimaxKeyToSend === null) {
          // User explicitly cleared — delete from env and reset state
          setLlmMinimaxKey('')
          setLlmMinimaxKeySaved(false)
          setLlmMinimaxKeyCleared(false)
        }
      } else {
        const err = await res.json()
        setLlmMsg(err.error || '保存失败')
      }
    } catch {
      setLlmMsg('保存失败')
    } finally {
      setLlmSaving(false)
    }
  }

  async function updateUser(userId: number, data: { name?: string; role?: string; level?: string }) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...data }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === Number(updated.id) ? updated : u)))
    }
  }

  async function deleteUser(userId: number) {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } else {
      let errMsg = '删除失败'
      try {
        const err = await res.json()
        errMsg = err.error || errMsg
      } catch {}
      alert(errMsg)
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
    setNewItemPipelineId(pipelineId)
  }

  function cancelAddBudgetItem() {
    setIsAddingBudgetItemPipelineId(null)
    setNewItemName('')
  }

  function startAddPipeline() {
    setIsAddingPipeline(true)
    setNewPipelineName('')
  }

  function cancelAddPipeline() {
    setIsAddingPipeline(false)
    setNewPipelineName('')
  }

  function startEditPipeline(pipeline: Pipeline) {
    setEditingPipeline({ id: pipeline.id, name: pipeline.name })
  }

  function cancelEditPipeline() {
    setEditingPipeline(null)
  }

  async function confirmEditPipeline() {
    if (!editingPipeline) return
    if (!editingPipeline.name.trim()) {
      alert('管线名称不能为空')
      return
    }
    // Find the pipeline object for the confirmation dialog
    const pipeline = pipelines.find((p) => p.id === editingPipeline.id)
    if (pipeline) {
      setPendingEditPipeline(pipeline)
    }
  }

  async function doEditPipeline() {
    if (!editingPipeline) return
    const res = await fetch(`/api/settings/pipelines/${editingPipeline.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingPipeline.name.trim() }),
    })
    if (res.ok) {
      setEditingPipeline(null)
      setPendingEditPipeline(null)
      fetchSettings()
    } else {
      const err = await res.json()
      alert(err.error || '更新失败')
    }
  }

  async function confirmDeletePipeline(pipeline: Pipeline) {
    setPendingDeletePipeline(pipeline)
  }

  async function doDeletePipeline() {
    if (!pendingDeletePipeline) return
    const res = await fetch(`/api/settings/pipelines/${pendingDeletePipeline.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPendingDeletePipeline(null)
      fetchSettings()
    } else {
      const err = await res.json()
      alert(err.error || '删除失败')
    }
  }

  async function confirmAddPipeline() {
    if (!newPipelineName.trim()) {
      alert('请填写管线名称')
      return
    }
    const res = await fetch('/api/settings/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPipelineName.trim() }),
    })
    if (res.ok) {
      setIsAddingPipeline(false)
      setNewPipelineName('')
      fetchSettings()
    } else {
      const err = await res.json()
      alert(err.error || '创建失败')
    }
  }

  async function confirmAddBudgetItem() {
    if (!isAddingBudgetItemPipelineId || !newItemName.trim()) {
      alert('请填写预算项名称')
      return
    }
    const res = await fetch('/api/settings/budget-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItemName.trim(), pipelineId: newItemPipelineId }),
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
              onClick={() => setActiveTab('pipelines')}
              className={`text-lg font-bold ${activeTab === 'pipelines' ? 'text-black' : 'text-gray-400'}`}
            >
              管线管理
            </button>
            <button
              onClick={() => setActiveTab('budget')}
              className={`text-lg font-bold ${activeTab === 'budget' ? 'text-black' : 'text-gray-400'}`}
            >
              预算项管理
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`text-lg font-bold ${activeTab === 'llm' ? 'text-black' : 'text-gray-400'}`}
            >
              LLM
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-auto p-6">
          {activeTab === 'llm' ? (
            <>
              <div className="flex flex-col gap-6">
                {/* Provider */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">供应商</label>
                  <div className="flex gap-3">
                    {(['ollama', 'minimax'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setLlmProvider(p)}
                        className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                          llmProvider === p
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-black'
                        }`}
                      >
                        {p === 'ollama' ? 'Ollama (本地)' : 'MiniMax (云端)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ollama fields */}
                {llmProvider === 'ollama' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">模型名称</label>
                    <div className="relative inline-flex items-center">
                      <input
                        type="text"
                        value={llmOllamaModel}
                        onChange={(e) => setLlmOllamaModel(e.target.value)}
                        className="w-64 rounded border border-gray-300 px-3 py-2 pr-8 text-sm hover:border-brand focus:border-brand focus:outline-none"
                        placeholder="qwen3:4b"
                      />
                      {llmOllamaModel && (
                        <button
                          type="button"
                          className="absolute right-2 flex items-center justify-center text-[#C8C8C8] hover:text-black"
                          onClick={() => setLlmOllamaModel('')}
                          aria-label="清空"
                        >
                          <IconClear />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">例如：qwen3:4b、llama3 等，需已在 Ollama 中下载</p>
                  </div>
                )}

                {/* MiniMax fields */}
                {llmProvider === 'minimax' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                    <div className="relative inline-flex items-center">
                      <input
                        type="text"
                        value={llmMinimaxKeyCleared ? '' : (llmMinimaxKeySaved && !llmMinimaxKey ? MASK_DOTS : llmMinimaxKey)}
                        onChange={(e) => {
                          setLlmMinimaxKey(e.target.value)
                          setLlmMinimaxKeyCleared(false)
                        }}
                        className="w-80 rounded border border-gray-300 px-3 py-2 pr-8 text-sm hover:border-brand focus:border-brand focus:outline-none font-mono tracking-widest"
                        placeholder="sk-cp-..."
                        autoComplete="new-password"
                        data-1p-ignore
                      />
                      {(llmMinimaxKey || (llmMinimaxKeySaved && !llmMinimaxKey)) && (
                        <button
                          type="button"
                          className="absolute right-2 flex items-center justify-center text-[#C8C8C8] hover:text-black"
                          onClick={() => {
                            setLlmMinimaxKey('')
                            setLlmMinimaxKeyCleared(true)
                          }}
                          aria-label="清空"
                        >
                          <IconClear />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {llmMinimaxKeySaved && !llmMinimaxKeyCleared ? 'API使用中' : '当前未配置API'}
                    </p>
                  </div>
                )}

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveLLMSettings}
                    disabled={llmSaving}
                    className="px-5 py-2 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:bg-gray-400"
                  >
                    {llmSaving ? '保存中...' : '保存'}
                  </button>
                  {llmMsg && (
                    <span className={`text-sm ${llmMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>
                      {llmMsg}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'members' ? (
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
          ) : activeTab === 'pipelines' ? (
            <>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={startAddPipeline}
                  disabled={isAddingPipeline}
                  className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:bg-gray-400"
                >
                  新增管线
                </button>
              </div>

              {/* 管线列表 */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2">管线名称</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {isAddingPipeline && (
                    <tr className="border-b bg-gray-50">
                      <td className="py-2">
                        <input
                          type="text"
                          value={newPipelineName}
                          onChange={(e) => setNewPipelineName(e.target.value)}
                          className="w-48 rounded border px-2 py-1 text-sm"
                          placeholder="管线名称"
                          autoFocus
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={confirmAddPipeline} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                          <button onClick={cancelAddPipeline} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {pipelines
                    .slice()
                    .sort((a, b) => {
                      if (a.name === '其他') return 1
                      if (b.name === '其他') return -1
                      return a.name.localeCompare(b.name, 'zh-CN')
                    })
                    .map((pl) => (
                      <tr key={pl.id} className={`border-b ${editingPipeline?.id === pl.id ? 'bg-gray-50' : ''}`}>
                        {editingPipeline?.id === pl.id ? (
                          <>
                            <td className="py-2">
                              <input
                                type="text"
                                value={editingPipeline.name}
                                onChange={(e) => setEditingPipeline({ ...editingPipeline, name: e.target.value })}
                                className="w-48 rounded border px-2 py-1 text-sm"
                                autoFocus
                              />
                            </td>
                            <td className="py-2">
                              <div className="flex gap-2">
                                <button onClick={confirmEditPipeline} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                                <button onClick={cancelEditPipeline} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 font-medium">{pl.name}</td>
                            <td className="py-2">
                              <div className="flex gap-3">
                                <button
                                  onClick={() => startEditPipeline(pl)}
                                  className="text-blue-500 hover:text-blue-700 text-xs"
                                  disabled={pl.name === '其他'}
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => confirmDeletePipeline(pl)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                  disabled={pl.name === '其他'}
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
                  {(() => {
                    const sortedPipelines = [...pipelines].sort((a, b) => {
                      if (a.name === '其他') return 1
                      if (b.name === '其他') return -1
                      return a.id - b.id
                    })
                    return sortedPipelines.map((pl) => {
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
                                <select
                                  value={newItemPipelineId ?? ''}
                                  onChange={(e) => setNewItemPipelineId(e.target.value ? Number(e.target.value) : null)}
                                  className="border rounded px-1 py-1 text-xs mr-2"
                                >
                                  <option value="">不关联管线</option>
                                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
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
                  })
                  })()}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
      {pendingEditPipeline && (
        <ConfirmDialog
          title="编辑管线"
          message={`确定将管线「${pendingEditPipeline.name}」名称修改为「${editingPipeline?.name}」？`}
          onConfirm={doEditPipeline}
          onCancel={() => {
            setPendingEditPipeline(null)
          }}
          confirmText="确认"
          cancelText="取消"
        />
      )}
      {pendingDeletePipeline && (
        <ConfirmDialog
          title="删除管线"
          message={`确定删除管线「${pendingDeletePipeline.name}」？\n删除后，该管线关联的预算项将移至"其他"管线，需求组中的管线信息也将更新。`}
          onConfirm={doDeletePipeline}
          onCancel={() => setPendingDeletePipeline(null)}
          confirmText="删除"
          cancelText="取消"
        />
      )}
    </div>
  )
}
