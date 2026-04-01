'use client'
import { useState, useEffect } from 'react'

function round1(v: number) {
  return Math.round(v * 10) / 10
}

interface ManDayStepperProps {
  value: number
  onChange: (value: number) => void
  onDirty?: () => void
  disabled?: boolean
  isComplete?: boolean
}

export default function ManDayStepper({ value, onChange, onDirty, disabled, isComplete }: ManDayStepperProps) {
  const [focused, setFocused] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const [decreaseAnim, setDecreaseAnim] = useState<number | null>(null)
  const [increaseAnim, setIncreaseAnim] = useState<number | null>(null)

  // Sync external value changes when not focused
  useEffect(() => {
    if (!focused) {
      setLocalValue(value)
    }
  }, [value, focused])

  function handleDecrease() {
    const next = Math.max(0, round1(localValue - 0.1))
    setLocalValue(next)
    onChange(next)
    onDirty?.()
    const id = Date.now()
    setDecreaseAnim(id)
    setTimeout(() => setDecreaseAnim(null), 1000)
  }

  function handleIncrease() {
    const next = round1(localValue + 0.1)
    setLocalValue(next)
    onChange(next)
    onDirty?.()
    const id = Date.now()
    setIncreaseAnim(id)
    setTimeout(() => setIncreaseAnim(null), 1000)
  }

  return (
    <div className={`relative flex h-[60px] items-center rounded-[8px] border border-[#EEEEEE] px-[12px] ${isComplete ? 'w-[64px] justify-center bg-transparent' : 'w-[176px] bg-white'}`}>
      {/* Decrease button with animation — hidden when COMPLETE */}
      {!isComplete && (
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={handleDecrease}
            className="flex h-[36px] w-[36px] items-center justify-center text-[24px] leading-none text-black/80 disabled:text-black/20 transition-transform duration-100 hover:scale-[1.2] active:scale-[0.95]"
            style={{ fontWeight: 300 }}
          >
            🦴
          </button>
          {decreaseAnim && (
            <span
              key={decreaseAnim}
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-[4px] text-[16px] animate-fade-out"
              style={{ fontWeight: 800, color: '#E96631' }}
            >
              🦴
            </span>
          )}
        </div>
      )}

      {/* Input — no browser spinners */}
      <input
        type="number"
        step="0.1"
        min="0"
        value={focused && localValue === 0 ? '' : localValue === 0 ? '0' : localValue || ''}
        disabled={disabled || isComplete}
        readOnly={isComplete}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value) || 0
          setLocalValue(parsed)
          onChange(parsed)
          onDirty?.()
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`mx-[8px] h-[36px] w-[64px] rounded-[8px] text-center text-[20px] leading-[36px] outline-none ${isComplete ? 'border-transparent bg-transparent' : 'border border-[#EEEEEE]'}`}
        style={{ fontWeight: 800, appearance: 'textfield', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
      />
      <style>{`input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{appearance:none;-webkit-appearance:none;margin:0}`}</style>

      {/* Increase button with animation — hidden when COMPLETE */}
      {!isComplete && (
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={handleIncrease}
            className="flex h-[36px] w-[36px] items-center justify-center text-[24px] leading-none text-black/80 disabled:text-black/20 transition-transform duration-100 hover:scale-[1.2] active:scale-[0.95]"
            style={{ fontWeight: 300 }}
          >
            <span className="inline-block scale-y-[-1]">🍗</span>
          </button>
          {increaseAnim && (
            <span
              key={increaseAnim}
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-[4px] text-[16px] animate-fade-out"
              style={{ fontWeight: 800, color: '#8ECA2E' }}
            >
              <span className="inline-block scale-y-[-1]">🍗</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
