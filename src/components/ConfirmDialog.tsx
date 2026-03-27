'use client'

export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
        <h3 className="mb-2 font-bold">{title}</h3>
        <p className="mb-4 text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            取消
          </button>
          <button onClick={onConfirm} className="rounded bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600">
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
