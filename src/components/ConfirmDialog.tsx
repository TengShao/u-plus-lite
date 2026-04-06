'use client'

import { useState } from 'react'


export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
  middleText,
  onMiddle,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  middleText?: string
  onMiddle?: () => void
}) {
  const [confirmActive, setConfirmActive] = useState(false)
  const [cancelActive, setCancelActive] = useState(false)
  const [middleActive, setMiddleActive] = useState(false)

  const btnW = 100
  const btnH = 46
  const gap = 10

  const is3Buttons = !!middleText
  const containerW = is3Buttons ? btnW * 3 + gap * 2 + 28 : btnW * 2 + gap + 28

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        className="flex flex-col items-center rounded-[24px] bg-[#F9F9F9] font-alibaba"
        onClick={(e) => e.stopPropagation()}
        style={{ width: containerW, padding: '28px 14px 18px' }}
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
          className="mt-[42px] flex items-center justify-center gap-[10px]"
        >
          {is3Buttons ? (
            <>
              {/* Cancel button - LEFT */}
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
              {/* Middle button - CENTER */}
              <button
                onClick={onMiddle}
                onMouseDown={() => setMiddleActive(true)}
                onMouseUp={() => setMiddleActive(false)}
                onMouseLeave={() => setMiddleActive(false)}
                className="flex items-center justify-center rounded-[8px] text-[18px] text-white"
                style={{
                  width: btnW,
                  height: btnH,
                  fontWeight: 900,
                  backgroundColor: middleActive ? '#C5C5C5' : '#B6B6B6',
                  letterSpacing: '-0.5px',
                }}
              >
                {middleText}
              </button>
              {/* Confirm button - RIGHT */}
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
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
