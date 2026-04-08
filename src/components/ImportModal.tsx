// src/components/ImportModal.tsx

'use client'
import { useState, useRef } from 'react'

interface ParsedItem {
  originalText: string
  manDays: number
  designers: string[]
}

interface ParsedGroup {
  name: string
  action: 'MATCH' | 'CREATE_NEW'
  matchedGroup: { id: number; name: string } | null
  matchReason: string
  items: ParsedItem[]
}

interface Props {
  cycleId: number
  onClose: () => void
  onImportComplete: () => void
  onDraftsImported?: (draftIds: number[]) => void
}

export default function ImportModal({ cycleId, onClose, onImportComplete, onDraftsImported }: Props) {
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [rawContent, setRawContent] = useState('')
  const [groups, setGroups] = useState<ParsedGroup[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState<number | null>(null)
  const [editedName, setEditedName] = useState('')
  const [primaryAction, setPrimaryAction] = useState<'import' | 'merge'>('import')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理 CSV 文件上传
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRawContent(ev.target?.result as string ?? '')
    }
    reader.readAsText(file)
  }

  // 调用解析 API
  async function handleParse() {
    if (!rawContent.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: rawContent, cycleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析失败')
      setGroups(data.groups)
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 删除单个条目
  function handleDeleteItem(groupIdx: number, itemIdx: number) {
    setGroups(prev => {
      const next = [...prev]
      next[groupIdx] = { ...next[groupIdx] }
      next[groupIdx].items = next[groupIdx].items.filter((_, i) => i !== itemIdx)
      return next
    })
  }

  // 删除整组
  function handleDeleteGroup(groupIdx: number) {
    setGroups(prev => prev.filter((_, i) => i !== groupIdx))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(groupIdx)
      return next
    })
  }

  // 编辑组名
  function handleStartEditName(groupIdx: number, currentName: string) {
    setEditingGroupName(groupIdx)
    setEditedName(currentName)
  }

  function handleSaveEditName(groupIdx: number) {
    setGroups(prev => {
      const next = [...prev]
      next[groupIdx] = { ...next[groupIdx], name: editedName }
      return next
    })
    setEditingGroupName(null)
  }

  // 全选 / 取消全选
  function handleToggleSelectAll() {
    if (selectedIds.size === groups.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(groups.map((_, i) => i)))
    }
  }

  // 多选切换
  function handleToggleSelect(groupIdx: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(groupIdx)) next.delete(groupIdx)
      else next.add(groupIdx)
      return next
    })
  }

  // 合并选中组（调用 API）
  async function handleMergeSelected() {
    if (selectedIds.size < 2) return
    const selectedGroups = groups.filter((_, i) => selectedIds.has(i))
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/import/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: selectedGroups }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '合并失败')
      const mergedGroup = data.group as ParsedGroup
      const remaining = groups.filter((_, i) => !selectedIds.has(i))
      setGroups([...remaining, mergedGroup])
      setSelectedIds(new Set())
      setPrimaryAction('import')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 点击合并按钮
  function handleStartMerge() {
    setPrimaryAction('merge')
  }

  // 取消合并
  function handleCancelMerge() {
    setPrimaryAction('import')
  }

  // 确认导入
  async function handleConfirm() {
    if (groups.length === 0) return
    const decisions = groups.filter((_, i) => selectedIds.has(i)).map(g => ({
      name: g.name,
      action: g.action === 'MATCH' ? 'MERGE' : 'CREATE',
      targetGroupId: g.matchedGroup?.id ?? null,
      items: g.items,
    }))
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId, decisions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '导入失败')
      // Extract draft IDs from results
      const draftIds = (data.results as { groupId: number; importedCount: number; isDraft: boolean }[])
        .filter((r) => r.isDraft)
        .map((r) => r.groupId)
      if (draftIds.length > 0) {
        onDraftsImported?.(draftIds)
      }
      onImportComplete()
      onClose()
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  const allSelected = groups.length > 0 && selectedIds.size === groups.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < groups.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 font-alibaba" onClick={onClose}>
      <div className="flex flex-col rounded-[24px] bg-bg-panel" style={{ width: 680, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10">
          <span className="text-[18px] font-bold text-black">导入需求组</span>
          <button onClick={onClose} className="text-black/40 hover:text-black">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'input' ? (
            <div className="flex flex-col gap-4">
              <textarea
                className="w-full h-48 p-3 rounded-lg border border-border-default text-[14px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand resize-none"
                style={{ fontFamily: 'inherit' }}
                placeholder="粘贴纯文本或 CSV 内容..."
                value={rawContent}
                onChange={e => setRawContent(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 h-10 px-4 rounded-[8px] border border-border-default bg-bg-panel text-[14px] text-text-primary hover:border-brand"
                >
                  📎 上传 CSV
                </button>
                {fileInputRef.current?.files?.[0] && (
                  <span className="text-[14px] text-brand">{fileInputRef.current.files[0].name}</span>
                )}
              </div>
              {error && <div className="text-[14px] text-red-500">{error}</div>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-text-muted">未解析出任何需求组</div>
              ) : (
                <>
                  {/* 全选操作栏 */}
                  <div className="flex items-center gap-3 px-1">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4"
                    />
                    <span className="text-[13px] text-text-secondary">
                      {selectedIds.size > 0 ? `已选 ${selectedIds.size} 项` : '全选'}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      {primaryAction === 'import' && groups.length < 2 && (
                        <span className="text-[12px] text-text-muted">至少需要2个需求组</span>
                      )}
                      <button
                        onClick={primaryAction === 'merge' ? handleCancelMerge : handleStartMerge}
                        disabled={primaryAction === 'import' && groups.length < 2}
                        className={`px-3 py-1 rounded-[6px] border text-[13px] transition-colors ${
                          primaryAction === 'merge'
                            ? 'border-brand bg-brand text-white'
                            : groups.length >= 2
                              ? 'border-brand text-brand hover:bg-brand-hover'
                              : 'border-border-strong text-text-muted cursor-not-allowed'
                        }`}
                      >
                        {primaryAction === 'merge' ? '取消合并' : '合并'}
                      </button>
                    </div>
                  </div>

                  {/* 分组卡片列表 */}
                  {groups.map((group, gi) => (
                    <div key={gi} className="rounded-[12px] border border-border-default bg-bg-panel p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(gi)}
                          onChange={() => handleToggleSelect(gi)}
                          className="w-4 h-4"
                        />
                        {editingGroupName === gi ? (
                          <input
                            className="flex-1 h-8 px-2 rounded border border-brand text-[14px] text-black outline-none"
                            value={editedName}
                            onChange={e => setEditedName(e.target.value)}
                            onBlur={() => handleSaveEditName(gi)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEditName(gi)}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="flex-1 text-[16px] font-bold text-black cursor-pointer hover:text-brand"
                            onClick={() => handleStartEditName(gi, group.name)}
                          >
                            {group.name}
                          </span>
                        )}
                        <span className={`text-[12px] px-2 py-0.5 rounded-full ${group.action === 'MATCH' ? 'bg-brand-hover text-brand' : 'bg-bg-hover text-text-muted'}`}>
                          {group.action === 'MATCH' ? `已有「${group.matchedGroup?.name}」` : '新建'}
                        </span>
                        <button onClick={() => handleDeleteGroup(gi)} className="text-[14px] hover:underline" style={{ color: 'var(--u-danger)' }}>删除</button>
                      </div>
                      <div className="flex flex-col gap-1 pl-7">
                        {group.items.map((item, ii) => (
                          <div key={ii} className="flex items-center justify-between text-[13px]">
                            <span className="text-text-secondary">{item.originalText}</span>
                            <span className="font-bold" style={{ color: 'var(--u-text-primary)' }}>{item.manDays} 人天</span>
                            <button onClick={() => handleDeleteItem(gi, ii)} className="hover:underline" style={{ color: 'var(--u-danger)' }}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {error && <div className="text-[14px] text-red-500">{error}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10">
          {step === 'input' ? (
            <>
              <button
                onClick={onClose}
                className="h-10 w-28 rounded-[8px] text-[16px] font-bold"
                style={{ backgroundColor: 'var(--u-bg-hover)', color: 'var(--u-text-primary)' }}
              >
                取消
              </button>
              <button
                onClick={handleParse}
                disabled={!rawContent.trim() || isLoading}
                className="h-10 w-28 rounded-[8px] text-[16px] font-bold disabled:opacity-50"
                style={{ backgroundColor: 'var(--u-text-primary)', color: 'var(--u-bg-panel)' }}
              >
                {isLoading ? '解析中...' : '解析'}
              </button>
            </>
          ) : (
            <>
              {primaryAction !== 'merge' && (
                <button
                  onClick={() => { setStep('input'); setGroups([]); setError(null); setPrimaryAction('import') }}
                  className="h-10 w-28 rounded-[8px] text-[16px] font-bold"
                  style={{ backgroundColor: 'var(--u-bg-hover)', color: 'var(--u-text-primary)' }}
                >
                  上一步
                </button>
              )}
              <button
                onClick={primaryAction === 'merge' ? handleMergeSelected : handleConfirm}
                disabled={
                  primaryAction === 'merge'
                    ? selectedIds.size < 2 || isLoading
                    : groups.length === 0 || selectedIds.size === 0 || isLoading
                }
                title={primaryAction === 'import' && groups.length < 2 ? '需求组数量不足以合并' : undefined}
                className={`h-10 w-32 rounded-[8px] text-[16px] font-bold disabled:opacity-50 ${
                  primaryAction === 'merge' ? '' : ''
                }`}
                style={{
                  backgroundColor: primaryAction === 'merge' ? 'var(--u-text-primary)' : 'var(--color-brand)',
                  color: 'var(--u-bg-panel)',
                }}
              >
                {isLoading ? '处理中...' : primaryAction === 'merge' ? '合并' : '确认导入'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
