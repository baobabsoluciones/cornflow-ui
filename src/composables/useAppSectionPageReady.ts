import {
  computed,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  type InjectionKey,
} from 'vue'
import { useRoute } from 'vue-router'
import appConfig from '@/app/config'

export const APP_SECTION_PAGE_READY_KEY: InjectionKey<() => void> = Symbol(
  'appSectionPageReady',
)

declare module 'vue-router' {
  interface RouteMeta {
    showsLoadingOnEnter?: boolean
  }
}

/**
 * Signals that an app-specific section view has finished loading its data.
 * No-op when the current route does not use `showsLoadingOnEnter`, or when
 * the view instance is inactive (e.g. cached by keep-alive after navigation).
 */
export function useAppSectionPageReady() {
  const route = useRoute()
  const setPageReadyFromParent = inject(APP_SECTION_PAGE_READY_KEY, () => {})
  const isViewActive = ref(true)

  const showsLoadingOnEnter = computed(() =>
    appConfig.isAppSectionShowsLoadingOnEnter(route.path),
  )

  onActivated(() => {
    isViewActive.value = true
  })

  onDeactivated(() => {
    isViewActive.value = false
  })

  onBeforeUnmount(() => {
    isViewActive.value = false
  })

  function setPageReady() {
    if (!showsLoadingOnEnter.value || !isViewActive.value) return
    setPageReadyFromParent()
  }

  return {
    showsLoadingOnEnter,
    setPageReady,
  }
}
