/**
 * The help of the app: the "?" button at the top right of every page. Its menu starts the guided
 * tours (of the app, and of the page the user is on when it has one), opens the help centre (the
 * app's help files) and the licences, and shows the versions of the app and of Cornflow.
 *
 * A guided tour shows one step at a time: a card with a title and a text, beside the part of the
 * screen it points at, which it lights up.
 */
import { expect, type Locator, type Page } from '@playwright/test'

/** What the help menu offers: the general tour, the page's tour, the help centre, the licences. */
export type HelpItem = 'tour' | 'page-tour' | 'help' | 'licences'

/** Opens the help menu. */
export async function openHelpMenu(page: Page): Promise<void> {
  await page.getByTestId('help-menu-trigger').click()
  await expect(page.getByTestId('help-menu-help')).toBeVisible()
}

/** The entry `item` of the help menu (open it first). */
export const helpItem = (page: Page, item: HelpItem): Locator =>
  page.getByTestId(`help-menu-${item}`)

/** Opens the help menu and picks `item`. */
export async function pickHelp(page: Page, item: HelpItem): Promise<void> {
  await openHelpMenu(page)
  await helpItem(page, item).click()
}

/** The card of the step of the tour shown. */
export const tourCard = (page: Page): Locator =>
  page.getByTestId('core-tour-card')

/** Waits until no tour is shown. */
export async function expectNoTour(page: Page): Promise<void> {
  await expect(page.getByTestId('core-tour'), 'the tour is closed').toHaveCount(
    0,
  )
}

/** The step shown (from 1), how many the tour has, and the title of the step. */
export async function tourStep(
  page: Page,
): Promise<{ step: number; steps: number; title: string }> {
  const card = tourCard(page)
  await expect(card).toBeVisible()
  return {
    step: Number(await card.getAttribute('data-step')),
    steps: Number(await card.getAttribute('data-steps')),
    title: (await card.getByRole('heading').innerText()).trim(),
  }
}

/** Steps a tour can have, at most: a bound, so that a tour that never ends fails. */
const MAX_STEPS = 40

/**
 * Checks the step shown: it has a title and a text, its card is in the window, and the part of
 * the screen it lights up, if any, is in the window too.
 */
async function expectStepShown(page: Page, where: string): Promise<void> {
  const card = tourCard(page)
  const size = page.viewportSize() ?? { width: 1280, height: 720 }
  const inWindow = async (element: Locator, what: string) => {
    const box = await element.boundingBox()
    expect(box, `${what} is on the screen`).not.toBeNull()
    expect(
      box!.width > 0 &&
        box!.height > 0 &&
        box!.x < size.width &&
        box!.y < size.height &&
        box!.x + box!.width > 0 &&
        box!.y + box!.height > 0,
      `${what} is in the window`,
    ).toBe(true)
  }
  await expect(
    card.getByRole('heading'),
    `${where} has a title`,
  ).not.toBeEmpty()
  const text = await card.getAttribute('aria-describedby')
  await expect(
    page.locator(`[id="${text}"]`),
    `${where} has a text`,
  ).not.toBeEmpty()
  await inWindow(card, `the card of ${where}`)
  const spotlight = page.getByTestId('core-tour-spotlight')
  if (await spotlight.count())
    await inWindow(spotlight, `what ${where} points at`)
}

/**
 * Goes over the tour shown with its "Next" button, checking every step, and ends it with the
 * button of the last one ("Done"). Returns the titles of the steps it went over.
 *
 * A step whose part does not show up once the tour gets to it is left out, so the tour can end up
 * with fewer steps than it started with: the count is read at each step.
 */
export async function followTour(page: Page): Promise<string[]> {
  const titles: string[] = []
  for (let seen = 0; seen < MAX_STEPS; seen++) {
    const { step, steps, title } = await tourStep(page)
    await expectStepShown(page, `step ${step} of ${steps} ("${title}")`)
    titles.push(title)
    await tourCard(page).getByTestId('core-tour-next').click()
    if (step === steps) {
      await expectNoTour(page)
      return titles
    }
    // The next step: another number, or the same one with another title when it was left out.
    await expect
      .poll(async () => {
        const card = tourCard(page)
        if (!(await card.count())) return 'closed'
        const now = await tourStep(page)
        return `${now.step}|${now.title}`
      })
      .not.toBe(`${step}|${title}`)
    if (!(await tourCard(page).count())) return titles
  }
  throw new Error(`the tour did not end after ${MAX_STEPS} steps`)
}
