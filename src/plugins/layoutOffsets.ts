/**
 * layoutOffsets.ts — Canal reactivo de offsets de layout (core ← premium).
 *
 * El CORE define este canal; los componentes globales premium (p. ej. banners fixed en la parte
 * superior) reportan aquí el alto que ocupan cuando son visibles. El layout del core
 * (`IndexView` → `.main-content`) lee el total y deja ese hueco, SIN conocer ningún módulo premium.
 *
 * Invariante: el core no importa banners concretos ni sus stores para calcular el padding; solo
 * suma las contribuciones registradas por clave. Sin módulos premium → total 0 (sin offset).
 */
import { reactive, computed, type ComputedRef } from 'vue'

/** Alturas (px) de banners fixed en el top, contribuidas por componentes premium, por clave. */
const topBannerOffsets = reactive<Record<string, number>>({})

/**
 * Un componente premium reporta el alto (px) que su banner fixed ocupa en el top.
 * `px <= 0` (o banner oculto/desmontado) elimina la contribución.
 */
export function setTopBannerOffset(key: string, px: number): void {
  if (px && px > 0) topBannerOffsets[key] = px
  else delete topBannerOffsets[key]
}

/** Padding-top total (px) que el `main-content` del core necesita para librar los banners fixed. */
export const totalTopBannerOffset: ComputedRef<number> = computed(() =>
  Object.values(topBannerOffsets).reduce((sum, px) => sum + px, 0),
)

/** Limpia todas las contribuciones (uso en tests para aislar estado entre casos). */
export function resetTopBannerOffsets(): void {
  for (const key of Object.keys(topBannerOffsets)) delete topBannerOffsets[key]
}
