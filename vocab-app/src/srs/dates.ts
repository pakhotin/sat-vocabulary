export function localISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localISODate(date)
}

export function daysBetween(earlier: string, later: string): number {
  const [ay, am, ad] = earlier.split('-').map(Number)
  const [by, bm, bd] = later.split('-').map(Number)
  const start = new Date(ay, am - 1, ad).getTime()
  const end = new Date(by, bm - 1, bd).getTime()
  return Math.round((end - start) / 86400000)
}
