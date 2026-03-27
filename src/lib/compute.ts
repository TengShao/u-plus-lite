import { LEVEL_COEFFICIENTS, RATING_STANDARDS } from './constants'

export function getConvertedManDays(manDays: number, level: string | null): number {
  const coeff = level ? (LEVEL_COEFFICIENTS[level] ?? 1) : 1
  return Math.round(manDays * coeff * 10) / 10
}

export function getRecommendedRating(totalConvertedManDays: number): string {
  if (totalConvertedManDays <= 0.5) return 'D'
  if (totalConvertedManDays <= 2) return 'C'
  if (totalConvertedManDays <= 5) return 'B'
  if (totalConvertedManDays <= 10) return 'A'
  return 'S'
}

export function getRatingStandard(rating: string): number {
  return RATING_STANDARDS[rating] ?? 1
}

export function getInputRatio(totalConvertedManDays: number, rating: string | null): number {
  if (!rating) return 0
  const standard = getRatingStandard(rating)
  return Math.round((totalConvertedManDays / standard) * 100)
}

export function getHealthStatus(ratio: number): string {
  if (ratio > 110) return '过饱和'
  if (ratio < 70) return '欠饱和'
  return '适合'
}
