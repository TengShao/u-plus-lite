import { RequiredDot } from './RequiredDot'

const GREEN = '#8ECA2E'

export function DesignerChip({ name, days, mine, nameWeight }: { name: string; days: string; mine?: boolean; nameWeight?: number }) {
  return (
    <div className="flex h-[33px] items-center rounded-[8px] border border-[#EEEEEE] bg-white px-[8px] font-alibaba">
      <span className="text-[12px] leading-[17px]" style={{ fontWeight: nameWeight ?? 400, color: mine ? GREEN : '#8C8C8C' }}>{name}</span>
      <span className="mx-[6px] h-[10px] w-px bg-[#00000013]" />
      <span className="text-[12px] leading-[17px] text-black" style={{ fontWeight: 800 }}>{days}</span>
    </div>
  )
}

export function Cube({ label, value, labelColor, valueColor, width, required, disabled, isEmpty, children }: {
  label: string
  value?: string
  labelColor?: string
  valueColor?: string
  width?: number
  required?: boolean
  disabled?: boolean
  isEmpty?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className="relative flex h-[80px] shrink-0 flex-col items-center rounded-[12px] border border-[#EEEEEE] bg-[#FDFDFD] px-[8px] font-alibaba"
      style={{ width: width ?? 80 }}
    >
      <span className="mt-[14px] text-[12px] leading-[17px]" style={{ fontWeight: 400, color: labelColor || '#8C8C8C' }}>{label}</span>
      {required && !disabled && isEmpty && <RequiredDot className="right-[8px] top-[8px]" />}
      {children && !disabled
        ? <div className="relative mt-[5px]">{children}</div>
        : <span className="mt-[12px] text-[16px] leading-[22px] text-black" style={{ fontWeight: 600, color: valueColor }}>{value}</span>
      }
    </div>
  )
}
