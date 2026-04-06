'use client'

interface RequirementTagsProps {
  pipeline?: string | null
  module?: string | null
  types?: string[] | null
  isLastSubmitted?: boolean
  isDraft?: boolean
  status?: string
  lastSubmittedAt?: string | null
}

function Divider() {
  return <span className="mx-0 inline-block h-[10px] w-px shrink-0 bg-[#00000013]" style={{ marginTop: 4 }} />
}

export default function RequirementTags({
  pipeline,
  module,
  types,
  isLastSubmitted,
  isDraft,
  status,
  lastSubmittedAt,
}: RequirementTagsProps) {
  const tags: string[] = []
  if (pipeline) tags.push(pipeline)
  // module 和 types 暂不显示，后续按需启用

  const showPending = isDraft || (status === 'INCOMPLETE' && lastSubmittedAt === null)

  return (
    <div className="flex items-center gap-[12px]">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-[12px]">
          <Divider />
          <span className="shrink-0 text-[12px] leading-[17px] text-[#8C8C8C]" style={{ fontWeight: 400 }}>
            {t}
          </span>
        </span>
      ))}
      {showPending && (
        <span className="ml-[6px] flex items-center rounded-[4px] bg-[#f22f4627] px-[3px]" style={{ height: 18 }}>
          <span className="text-[12px] text-[#f22f46]">待完成</span>
        </span>
      )}
      {!showPending && isLastSubmitted && (
        <span className="ml-[6px] flex items-center rounded-[4px] bg-[#8eca2e27] px-[3px]" style={{ height: 18 }}>
          <span className="text-[12px] text-[#8eca2e]">上次提交</span>
        </span>
      )}
    </div>
  )
}
