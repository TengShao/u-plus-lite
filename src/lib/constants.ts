export const LEVEL_COEFFICIENTS: Record<string, number> = {
  P3: 1,
  P4: 1.3,
  P5: 2,
  OUTSOURCE: 1,
  INTERN: 0.2,
}

export const RATING_STANDARDS: Record<string, number> = {
  S: 20,
  A: 10,
  B: 5,
  C: 2,
  D: 0.5,
}

export const MODULES = ['活动', '核心体验', '社交', '常规', '评估诊断'] as const
export const RATINGS = ['S', 'A', 'B', 'C', 'D'] as const
export const TYPES = ['自主', '复用', '迭代', '创新'] as const
export const LEVELS = ['P5', 'P4', 'P3', 'INTERN', 'OUTSOURCE'] as const
