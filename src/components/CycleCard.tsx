'use client'

type Cycle = {
  id: number
  label: string
  startDate: string
  endDate: string
  status: string
}

function formatDate(d: string) {
  const date = new Date(d)
  return `${date.getMonth() + 1}.${date.getDate()}`
}

export default function CycleCard({
  cycle,
  isSelected,
  onSelect,
  onToggle,
}: {
  cycle: Cycle
  isSelected: boolean
  onSelect: () => void
  onToggle?: () => void
}) {
  const isOpen = cycle.status === 'OPEN'

  return (
    <div
      className={`relative flex h-[78px] w-[284px] items-center justify-between rounded-[12px] px-[18px] transition-shadow ${
        isSelected
          ? 'bg-white shadow-[0_0_8px_0_#0000001a]'
          : 'bg-transparent hover:shadow-[0_0_6px_0_rgba(0,0,0,0.15)]'
      } font-alibaba`}
    >
      <button
        onClick={onSelect}
        className="flex h-full flex-1 items-center gap-[8px] text-left"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: isOpen ? '#8ECA2E' : '#B6B6B6' }}
        />
        <div className="flex h-full items-center" style={{ gap: '6px' }}>
          <span
            className="text-[16px] leading-[22px] text-black"
            style={{ fontWeight: 800, letterSpacing: '-0.91px' }}
          >
            {cycle.label}
          </span>
          <span
            className="text-[16px] leading-[22px]"
            style={{
              fontWeight: 500,
              color: '#8C8C8C',
              letterSpacing: '-1.04px',
            }}
          >
            {formatDate(cycle.startDate)} ~ {formatDate(cycle.endDate)}
          </span>
        </div>
      </button>
      {isSelected && onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="flex h-[24px] w-[24px] shrink-0 items-center"
          onMouseEnter={(e) => {
            const img = e.currentTarget.querySelector('img') as HTMLImageElement | null
            if (img) {
              img.style.opacity = '1'
              img.src = isOpen ? '/shutdown-close.svg' : '/shutdown-open.svg'
            }
          }}
          onMouseLeave={(e) => {
            const img = e.currentTarget.querySelector('img') as HTMLImageElement | null
            if (img) {
              img.style.opacity = '0.1'
              img.src = '/shutdown.svg'
            }
          }}
        >
          <img
            src="/shutdown.svg"
            alt={isOpen ? '关闭月结' : '开启月结'}
            className="h-[24px] w-[24px]"
            style={{ opacity: 0.1 }}
          />
        </button>
      )}
    </div>
  )
}
