'use client'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'


type TipsType = 'positive' | 'negative'

interface TipsContextValue {
  showTips: (type: TipsType, message?: string) => void
}

const TipsContext = createContext<TipsContextValue>({ showTips: () => {} })

export function useTips() {
  return useContext(TipsContext)
}

export function TipsProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [type, setType] = useState<TipsType>('positive')
  const [message, setMessage] = useState('提交成功')
  const [left, setLeft] = useState<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate center of right container (viewport - 320px sidebar)
  useEffect(() => {
    const SIDEBAR_W = 320

    function update() {
      const vp = window.innerWidth
      // right container center = sidebar + (remaining width) / 2
      const rightCenter = SIDEBAR_W + (vp - SIDEBAR_W) / 2
      setLeft(rightCenter)
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])

  const showTips = useCallback((t: TipsType, msg?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setType(t)
    setMessage(msg || (t === 'positive' ? '提交成功' : '提交失败'))
    setVisible(true)
    // 50ms fade-in + 3000ms stay + 100ms fade-out = 3150ms total
    timerRef.current = setTimeout(() => {
      setVisible(false)
    }, 3150)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <TipsContext.Provider value={{ showTips }}>
      {children}
      {left !== null && (
        <div
          className="fixed z-50"
          style={{
            top: 137,
            left,
            transform: 'translateX(-50%)',
            opacity: visible ? 1 : 0,
            transition: visible ? 'opacity 50ms ease-out' : 'opacity 100ms ease-in',
            pointerEvents: 'none',
          }}
        >
          <div
            className="flex items-center justify-center font-alibaba"
            style={{
              minWidth: 134,
              height: 40,
              paddingLeft: 40,
              paddingRight: 40,
              backgroundColor: 'var(--u-bg-panel)',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: type === 'positive' ? 'var(--color-brand)' : 'var(--u-danger)',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: type === 'positive' ? 'var(--color-brand)' : 'var(--u-danger)',
              whiteSpace: 'nowrap',
            }}
          >
            {message}
          </div>
        </div>
      )}
    </TipsContext.Provider>
  )
}
