/**
 * The guided tours of the app. A tour is a list of steps; each step points at a part of the screen
 * (the element with `data-tour="<target>"`) and reads `onboarding.<tour>.<step>.title` and
 * `.text`. A step without target shows in the middle of the window. A step whose element is not
 * on the screen when the tour starts (a button this user may not use, a panel of another state) is
 * left out, and so is one whose element does not show up once the step opens it.
 *
 * The general tour goes over the parts every page shares; a page tour, over one page, and the help
 * menu offers the one of the page the user is on.
 */
import { markRaw, type Component } from 'vue'
import ChecksExample from '@cornflow-ui/core/components/onboarding/ChecksExample.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

export interface TourStep {
  key: string
  /** `data-tour` of the element the step points at. */
  target?: string
  /**
   * `data-tour` of the element that must be on the screen when the tour starts for the step to be
   * shown; by default, `target`. For a step that points at a part it opens itself.
   */
  shownWith?: string
  /** The part the step opens while it is shown (a menu, a row's buttons): see `onTourReveal`. */
  reveal?: string
  /** Terms the card explains, each read from `onboarding.<tour>.<step>.terms.<term>.title` and `.text`. */
  terms?: string[]
  /** An example the card shows, of something the page may not be showing. */
  example?: Component
}

/** A term a step's card explains. */
export interface TourTerm {
  title: string
  text: string
}

export interface Tour {
  key: string
  steps: TourStep[]
  /** For a page tour, whether it is the tour of this route path. */
  page?: (path: string) => boolean
  /** Runs before the first step; what it returns runs once the tour ends. */
  setup?: () => (() => void) | void
}

export const GENERAL_TOUR: Tour = {
  key: 'general',
  // The menu stays open while the tour goes over it, and folds back after if it was folded.
  setup() {
    const store = useGeneralStore()
    const pinned = store.isDrawerPinned
    store.setDrawerPinned(true)
    return () => store.setDrawerPinned(pinned)
  },
  steps: [
    { key: 'welcome' },
    { key: 'menu', target: 'drawer' },
    { key: 'newExecution', target: 'drawer-new-execution' },
    { key: 'loadedExecution', target: 'drawer-execution' },
    {
      key: 'switchExecution',
      target: 'drawer-execution-list',
      shownWith: 'drawer-execution',
      reveal: 'drawer-execution-list',
    },
    { key: 'shared', target: 'drawer-groups' },
    { key: 'tabs', target: 'execution-tabs' },
    { key: 'help', target: 'help-menu' },
    { key: 'account', target: 'drawer-user' },
  ],
}

/** The tour of a page at exactly this path. */
const atPath = (route: string) => (path: string) => path === route

export const HISTORY_TOUR: Tour = {
  key: 'history',
  page: atPath('/history-execution'),
  steps: [
    { key: 'filters', target: 'history-filters' },
    { key: 'list', target: 'history-list' },
    {
      key: 'row',
      target: 'history-row',
      terms: ['state', 'name', 'tags', 'time', 'solution', 'details'],
    },
    {
      key: 'rowActions',
      target: 'history-row-actions',
      shownWith: 'history-row',
      reveal: 'history-row-actions',
    },
    { key: 'detail', target: 'history-detail', reveal: 'history-detail' },
    {
      key: 'detailHead',
      target: 'history-detail-head',
      shownWith: 'history-row',
      reveal: 'history-detail',
      terms: ['load', 'excel', 'currentPlan', 'delete'],
    },
    {
      key: 'detailProgress',
      target: 'history-detail-progress',
      shownWith: 'history-row',
      reveal: 'history-detail',
    },
    {
      key: 'detailData',
      target: 'history-detail-data',
      shownWith: 'history-row',
      reveal: 'history-detail',
      terms: ['user', 'created', 'finished', 'duration', 'solver', 'timeLimit'],
    },
    {
      key: 'detailParameters',
      target: 'history-detail-parameters',
      shownWith: 'history-row',
      reveal: 'history-detail',
    },
    { key: 'newExecution', target: 'history-new-execution' },
  ],
}

export const CREATE_EXECUTION_TOUR: Tour = {
  key: 'createExecution',
  page: atPath('/project-execution'),
  steps: [
    { key: 'draft', target: 'create-draft' },
    { key: 'data', target: 'create-data' },
    { key: 'dataActions', target: 'create-data-actions' },
    { key: 'name', target: 'create-name' },
    { key: 'checks', target: 'create-checks' },
    {
      key: 'checksExample',
      target: 'create-checks',
      terms: ['error', 'warning'],
      example: markRaw(ChecksExample),
    },
    { key: 'fixChecks', target: 'create-data', shownWith: 'create-checks' },
    { key: 'parameters', target: 'create-parameters' },
    { key: 'launch', target: 'create-launch' },
  ],
}

/** The tables of the loaded execution (its input data and results) and the master data. */
const TABLE_PAGE = /^\/(input-data|results|configuration)\/(?!section\/)/

export const DATA_TABLE_TOUR: Tour = {
  key: 'dataTable',
  page: (path) => TABLE_PAGE.test(path),
  steps: [
    { key: 'execution', target: 'table-execution' },
    { key: 'tabs', target: 'table-tabs' },
    { key: 'search', target: 'table-search' },
    { key: 'filters', target: 'table-filters' },
    { key: 'addRow', target: 'table-add-row' },
    { key: 'excel', target: 'table-excel' },
    { key: 'density', target: 'table-density' },
    {
      key: 'moreActions',
      target: 'table-more-actions-menu',
      shownWith: 'table-more-actions',
      reveal: 'table-more-actions',
    },
    {
      key: 'bulkUpload',
      target: 'table-bulk-upload',
      shownWith: 'table-more-actions',
      reveal: 'table-more-actions',
    },
    { key: 'fullscreen', target: 'table-fullscreen' },
    { key: 'grid', target: 'table-grid' },
    { key: 'columnDescription', target: 'table-column-description' },
    { key: 'footer', target: 'table-footer' },
  ],
}

export const USER_SETTINGS_TOUR: Tour = {
  key: 'userSettings',
  page: atPath('/user-settings'),
  steps: [
    { key: 'account', target: 'settings-account' },
    { key: 'theme', target: 'settings-theme' },
    { key: 'language', target: 'settings-language' },
    { key: 'password', target: 'settings-password' },
  ],
}

export const ROLES_TOUR: Tour = {
  key: 'roles',
  page: atPath('/roles-management'),
  steps: [
    { key: 'roles', target: 'roles-roles' },
    { key: 'addRole', target: 'roles-add' },
    { key: 'search', target: 'roles-search' },
    { key: 'users', target: 'roles-users' },
  ],
}

/** The tours of single pages. */
export const PAGE_TOURS: Tour[] = [
  HISTORY_TOUR,
  CREATE_EXECUTION_TOUR,
  DATA_TABLE_TOUR,
  USER_SETTINGS_TOUR,
  ROLES_TOUR,
]

/** The tour of the page at this path, if it has one. */
export function pageTourOf(path: string): Tour | null {
  return PAGE_TOURS.find((tour) => tour.page?.(path)) ?? null
}

/** `onboarding.<tour>.<step>.title` and `.text`. */
export function stepTextKeys(tour: Tour, step: TourStep) {
  const base = `onboarding.${tour.key}.${step.key}`
  return { title: `${base}.title`, text: `${base}.text` }
}

/** `onboarding.<tour>.<step>.terms.<term>.title` and `.text`. */
export function termTextKeys(tour: Tour, step: TourStep, term: string) {
  const base = `onboarding.${tour.key}.${step.key}.terms.${term}`
  return { title: `${base}.title`, text: `${base}.text` }
}
