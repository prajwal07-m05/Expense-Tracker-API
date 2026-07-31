import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * Animates from the previous value to the next whenever `target` changes, so
 * totals roll rather than jump. Honours `prefers-reduced-motion` by snapping.
 */
export function useCountUp(target: number, duration = 620) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === target || prefersReducedMotion()) {
      fromRef.current = target
      setValue(target)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setValue(Math.round(from + (target - from) * easeOutExpo(progress)))
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return value
}
