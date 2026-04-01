export function RequiredDot({ className }: { className?: string }) {
  return <span className={`absolute h-[4px] w-[4px] rounded-full bg-[#FF0000] ${className ?? ''}`} />
}
