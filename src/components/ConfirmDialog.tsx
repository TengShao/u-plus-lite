'use client'

export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
  confirmClassName = 'bg-red-500 text-white hover:bg-red-600',
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  confirmClassName?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
        <h3 className="mb-2 font-bold">{title}</h3>
        <p className="mb-4 text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`rounded px-3 py-1.5 text-sm ${confirmClassName}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
