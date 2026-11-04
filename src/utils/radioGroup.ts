/**
 * The keyboard of a group of `role="radio"` buttons, as the ARIA radio group pattern has it:
 * the arrows pick the previous or next option (and wrap), Home and End the first and the last,
 * and the picked option takes the focus. Only the picked option is in the tab order.
 *
 *   <div role="radiogroup" @keydown="onRadioGroupKey($event, values, current, pick)">
 *     <button v-for="v in values" role="radio" :tabindex="radioTabIndex(values, current, v)" …>
 */

const PREVIOUS = new Set(['ArrowLeft', 'ArrowUp'])
const NEXT = new Set(['ArrowRight', 'ArrowDown'])

/** 0 for the picked option (the first one when none is picked), -1 for the others. */
export function radioTabIndex<T>(values: readonly T[], current: T, value: T): 0 | -1 {
  const picked = values.includes(current) ? current : values[0]
  return value === picked ? 0 : -1
}

/** Picks the option the key points at; other keys are left alone. */
export function onRadioGroupKey<T>(
  event: KeyboardEvent,
  values: readonly T[],
  current: T,
  pick: (value: T) => void,
): void {
  if (values.length === 0) return
  const index = values.indexOf(current)
  let next: number
  if (PREVIOUS.has(event.key)) next = index <= 0 ? values.length - 1 : index - 1
  else if (NEXT.has(event.key)) next = index === -1 || index === values.length - 1 ? 0 : index + 1
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = values.length - 1
  else return
  event.preventDefault()
  pick(values[next])
  const group = event.currentTarget as HTMLElement | null
  group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
}
