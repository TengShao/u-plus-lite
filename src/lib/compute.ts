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

export function getSuitableRating(totalManDays: number, currentRating: string | null): string | null {
  // If no rating selected, use the original logic (find closest rating)
  if (!currentRating || currentRating === '') {
    const ratingOrder = ['D', 'C', 'B', 'A', 'S'] as const
    let closestRating = 'S'
    let minDistance = Infinity

    for (const r of ratingOrder) {
      const standard = RATING_STANDARDS[r]
      const min = standard * 0.7
      const max = standard * 1.1

      let distance: number
      if (totalManDays < min) {
        distance = min - totalManDays
      } else if (totalManDays > max) {
        distance = totalManDays - max
      } else {
        distance = 0 // Within range
      }

      if (distance < minDistance) {
        minDistance = distance
        closestRating = r
      }
    }

    return closestRating
  }

  // Check if totalManDays falls within current rating's suitable range
  const standard = RATING_STANDARDS[currentRating]
  const min = standard * 0.7
  const max = standard * 1.1

  // Use tolerance to handle floating point precision issues
  const tolerance = 0.01
  if (totalManDays >= min - tolerance && totalManDays <= max + tolerance) {
    return null // Within suitable range, no recommendation needed
  }

  // Find the rating whose suitable range is closest to totalManDays
  const ratingOrder = ['D', 'C', 'B', 'A', 'S'] as const
  let closestRating = currentRating
  let minDistance = Infinity

  for (const r of ratingOrder) {
    const rStandard = RATING_STANDARDS[r]
    const rMin = rStandard * 0.7
    const rMax = rStandard * 1.1

    let distance: number
    if (totalManDays < rMin) {
      distance = rMin - totalManDays
    } else if (totalManDays > rMax) {
      distance = totalManDays - rMax
    } else {
      distance = 0 // Within range
    }

    if (distance < minDistance) {
      minDistance = distance
      closestRating = r
    }
  }

  return closestRating
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
