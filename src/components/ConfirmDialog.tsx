'use client'

import { useState } from 'react'


export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
}) {
  const [confirmActive, setConfirmActive] = useState(false)
  const [cancelActive, setCancelActive] = useState(false)

  const btnW = 160
  const btnH = 46
  const gap = 14

  // Fixed container: cancel(160) + gap(14) + confirm(160) = 334px
  const containerW = btnW + gap + btnW

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        className="flex flex-col items-center rounded-[24px] bg-bg-panel font-alibaba"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 369, padding: '28px 17.5px 18px' }}
      >
        {/* Title */}
        <div
          className="text-[18px]"
          style={{ fontWeight: 700, letterSpacing: '-1px', color: 'var(--u-text-primary)' }}
        >
          {title}
        </div>

        {/* Message */}
        <div
          className="mt-[16px] text-[16px]"
          style={{ fontWeight: 400, maxWidth: 302, wordWrap: 'break-word', textAlign: 'center', color: 'var(--u-text-primary)' }}
        >
          {message}
        </div>

        {/* Buttons */}
        <div
          className="mt-[42px] flex items-center justify-center gap-[14px]"
        >
          {/* Cancel button (light) - LEFT */}
          <button
            onClick={onCancel}
            onMouseDown={() => setCancelActive(true)}
            onMouseUp={() => setCancelActive(false)}
            onMouseLeave={() => setCancelActive(false)}
            className="flex items-center justify-center rounded-[8px] text-[18px]"
            style={{
              width: btnW,
              height: btnH,
              fontWeight: 900,
              backgroundColor: cancelActive ? 'var(--u-bg-active)' : 'var(--u-bg-hover)',
              color: 'var(--u-text-primary)',
              letterSpacing: '-0.5px',
            }}
          >
            {cancelText}
          </button>

          {/* Confirm button (dark) - RIGHT */}
          <button
            onClick={onConfirm}
            onMouseDown={() => setConfirmActive(true)}
            onMouseUp={() => setConfirmActive(false)}
            onMouseLeave={() => setConfirmActive(false)}
            className="flex items-center justify-center rounded-[8px] text-[18px]"
            style={{
              width: btnW,
              height: btnH,
              fontWeight: 900,
              backgroundColor: confirmActive ? 'var(--u-bg-active)' : 'var(--u-text-primary)',
              color: 'var(--u-bg-panel)',
              letterSpacing: '-0.5px',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
