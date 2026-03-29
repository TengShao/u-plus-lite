'use client'

import { useState } from 'react'

const FONT = { fontFamily: 'Alibaba PuHuiTi 2.0' }

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
        className="flex flex-col items-center rounded-[24px] bg-[#F9F9F9]"
        style={{ width: 369, padding: '28px 17.5px 18px', ...FONT }}
      >
        {/* Title */}
        <div
          className="text-[18px] text-black"
          style={{ fontWeight: 700, letterSpacing: '-1px' }}
        >
          {title}
        </div>

        {/* Message */}
        <div
          className="mt-[16px] text-[16px] text-black"
          style={{ fontWeight: 400, maxWidth: 302, wordWrap: 'break-word', textAlign: 'center' }}
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
            className="flex items-center justify-center rounded-[8px] text-[18px] text-black"
            style={{
              width: btnW,
              height: btnH,
              fontWeight: 900,
              backgroundColor: cancelActive ? '#D7D7D7' : '#F2F2F2',
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
            className="flex items-center justify-center rounded-[8px] text-[18px] text-white"
            style={{
              width: btnW,
              height: btnH,
              fontWeight: 900,
              backgroundColor: confirmActive ? '#3A3A3A' : '#000000',
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
