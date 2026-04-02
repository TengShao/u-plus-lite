import { useState } from 'react'

export function DeleteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
        <path d="M19,6 L19,20 C19,21.1 18.1,22 17,22 L7,22 C5.9,22 5,21.1 5,20 L5,6" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M8,6 L8,4 C8,2.9 8.9,2 10,2 L14,2 C15.1,2 16,2.9 16,4 L16,6" />
      </g>
    </svg>
  )
}

export function ConfirmIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M21.801,10 C22.7420871,14.6185198 20.3303452,19.2671577 16.0125145,21.1573186 C11.6946838,23.0474795 6.64318402,21.6659284 3.88827649,17.8414212 C1.13336896,14.0169141 1.42309317,8.78791867 4.58365122,5.29117117 C7.74420926,1.79442367 12.9174154,0.979395279 17,3.335" stroke="#8ECA2E" />
        <polyline points="9 11 12 14 22 4" stroke="#8ECA2E" />
      </g>
    </svg>
  )
}

export function SubmitIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="22" x2="12" y2="12" />
        <polyline points="16 17 18 19 22 15" />
        <path d="M21 11.127V8C20.9993 7.2862 20.6182 6.6269 20 6.27L13 2.27C12.3812 1.91273 11.6188 1.91273 11 2.27L4 6.27C3.38183 6.6269 3.00073 7.2862 3 8V16C3.00109 16.7134 3.38214 17.3723 4 17.729L11 21.729C11.6186 22.0866 12.381 22.087 13 21.73L14.32 20.977" />
        <polyline points="3.29 7 12 12 20.71 7" />
      </g>
    </svg>
  )
}

export function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" opacity="0.3">
      <g stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="8 7 8 8.1 8.8 8.6" />
        <path d="M8 2h1a1 1 0 0 1 1 1v.4" />
        <path d="M4 2H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1" />
        <circle cx="8" cy="8" r="3" />
        <rect x="4" y="1" width="4" height="2" rx=".5" />
      </g>
    </svg>
  )
}

export function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="3" x2="12" y2="15" />
        <polyline points="17 8 12 3 7 8" />
        <path d="M21,15 L21,19 C21,20.1045695 20.1045695,21 19,21 L5,21 C3.8954305,21 3,20.1045695 3,19 L3,15" />
      </g>
    </svg>
  )
}

export function ActionIconButton({ type, disabled, onClick }: { type: 'complete' | 'delete' | 'upload' | 'upload-dark'; disabled: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const isDelete = type === 'delete'
  const isUpload = type === 'upload' || type === 'upload-dark'
  const isUploadDark = type === 'upload-dark'
  const showTint = !disabled && (hover || active)
  const color = isDelete ? (hover || active ? '#E91B1B' : '#000000') : isUpload ? '#000000' : '#8ECA2E'
  const iconOpacity = disabled
    ? 0.1
    : isDelete
    ? active ? 0.4 : hover ? 1 : 0.3
    : isUpload
    ? active ? 0.2 : hover ? 0.5 : 0.3
    : active ? 0.4 : 1
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
      style={{ background: isUpload ? (showTint ? (isUploadDark ? '#ECECEC' : '#F7F7F7') : 'transparent') : (showTint ? (isDelete ? '#FF000017' : '#8ECA2E2F') : 'transparent'), color }}
    >
      <span style={{ opacity: iconOpacity }}>
        {type === 'complete' ? <ConfirmIcon /> : type === 'delete' ? <DeleteIcon /> : <UploadIcon />}
      </span>
    </button>
  )
}
