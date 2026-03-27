'use client'
import { useEffect, useState } from 'react'
import { LEVELS } from '@/lib/constants'

type User = { id: number; name: string; role: string; level: string | null }

export default function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    fetch('/api/users').then((r) => r.json()).then(setUsers)
  }, [])

  async function updateUser(userId: number, data: { role?: string; level?: string }) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-h-[80vh] w-[500px] overflow-auto rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">成员管理</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2">姓名</th>
              <th className="pb-2">职级</th>
              <th className="pb-2">角色</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-2">{u.name}</td>
                <td className="py-2">
                  <select
                    value={u.level || ''}
                    onChange={(e) => updateUser(u.id, { level: e.target.value || undefined })}
                    className="rounded border px-1 py-0.5 text-sm"
                  >
                    <option value="">未设置</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
                <td className="py-2">
                  <select
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="rounded border px-1 py-0.5 text-sm"
                  >
                    <option value="MEMBER">成员</option>
                    <option value="ADMIN">管理员</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
