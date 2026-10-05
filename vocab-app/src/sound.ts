let context: AudioContext | null = null

export function playTone(kind: 'ok' | 'miss', enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return
  const Audio = window.AudioContext
  if (!Audio) return
  context ??= new Audio()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = kind === 'ok' ? 620 : 196
  gain.gain.value = 0.03
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.08)
}
