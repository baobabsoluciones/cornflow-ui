import client from '@/api/Api'
import config from '@/config'

/**
 * Response type for latest plan operations
 */
interface LatestPlanResponse {
  execution_id: string | null
  exists: boolean
  featureAvailable: boolean // Indicates if the feature is supported by the backend
}

/**
 * Repository for managing the latest plan (actual plan) feature.
 *
 * This feature is ONLY available when:
 * 1. isExternalApp is true (configured via VITE_APP_EXTERNAL_APP)
 * 2. The backend supports the /plan-latest/ endpoint
 *
 * If either condition is not met, the feature is completely disabled.
 */
export default class LatestPlanRepository {
  private readonly DUMMY_MODE = true // Set to false when backend endpoints are ready
  private featureAvailable: boolean | null = null // Cache for feature availability

  /**
   * Checks if the latest plan feature is available.
   * This must be called before using any other methods.
   *
   * The feature is available only if:
   * 1. isExternalApp is true
   * 2. The backend endpoint exists and responds correctly
   *
   * @returns Promise<boolean> indicating if the feature is available
   */
  async checkFeatureAvailability(): Promise<boolean> {
    // If not external app, feature is not available
    if (!config.hasExternalApp) {
      this.featureAvailable = false
      return false
    }

    // If we already checked, return cached result
    if (this.featureAvailable !== null) {
      return this.featureAvailable
    }

    // Check if the endpoint exists
    try {
      if (this.DUMMY_MODE) {
        // In dummy mode, feature is available
        this.featureAvailable = true
        return true
      }

      const response = await client.get('/plan-latest/', {}, {}, true)

      // If we get 200 or 404 (no plan set), the endpoint exists
      // 404 for "not found" resource is OK, it means the endpoint exists but no plan is set
      if (response.status === 200 || response.status === 404) {
        this.featureAvailable = true
        return true
      }

      // Any other status means the endpoint doesn't exist or isn't working
      this.featureAvailable = false
      return false
    } catch (error: any) {
      // Check if it's a 404 "endpoint not found" vs 404 "resource not found"
      // If the error indicates the endpoint doesn't exist, disable the feature
      console.warn(
        'Latest Plan feature not available:',
        error?.message || error,
      )
      this.featureAvailable = false
      return false
    }
  }

  /**
   * Returns whether the feature is available.
   * Returns null if checkFeatureAvailability hasn't been called yet.
   */
  isFeatureAvailable(): boolean {
    return this.featureAvailable === true
  }

  /**
   * Gets the ID of the current latest plan.
   * Only works if the feature is available.
   *
   * @returns Object with execution_id, exists flag, and featureAvailable flag
   */
  async getLatestPlan(): Promise<LatestPlanResponse> {
    // Check if feature is available
    if (!config.hasExternalApp) {
      return { execution_id: null, exists: false, featureAvailable: false }
    }

    // If we haven't checked availability yet, do it now
    if (this.featureAvailable === null) {
      await this.checkFeatureAvailability()
    }

    if (!this.featureAvailable) {
      return { execution_id: null, exists: false, featureAvailable: false }
    }

    return this.getLatestPlanFromEndpoint()
  }

  /**
   * Sets an execution as the latest plan.
   * Only available when the feature is available.
   *
   * @param executionId The ID of the execution to set as latest
   * @returns Success status
   */
  async setLatestPlan(executionId: string): Promise<boolean> {
    if (!this.featureAvailable) {
      console.warn('setLatestPlan: feature is not available')
      return false
    }

    return this.setLatestPlanEndpoint(executionId)
  }

  /**
   * Checks if the set latest plan feature is available
   * @deprecated Use isFeatureAvailable() instead
   */
  isSetLatestPlanAvailable(): boolean {
    return this.featureAvailable === true
  }

  // Private methods for endpoint calls

  private async getLatestPlanFromEndpoint(): Promise<LatestPlanResponse> {
    if (this.DUMMY_MODE) {
      const result = await this.getDummyLatestPlan()
      return { ...result, featureAvailable: true }
    }

    try {
      const response = await client.get('/plan-latest/', {}, {}, true)

      if (response.status === 200 && response.content?.execution_id) {
        return {
          execution_id: response.content.execution_id,
          exists: true,
          featureAvailable: true,
        }
      }

      // 200 with no execution_id means no plan is set
      if (response.status === 200) {
        return { execution_id: null, exists: false, featureAvailable: true }
      }

      // 404 means no plan is set (endpoint exists but no resource)
      if (response.status === 404) {
        return { execution_id: null, exists: false, featureAvailable: true }
      }

      // Other status codes indicate a problem
      this.featureAvailable = false
      return { execution_id: null, exists: false, featureAvailable: false }
    } catch (error) {
      console.error('Error fetching latest plan:', error)
      // On error, assume feature is not available
      this.featureAvailable = false
      return { execution_id: null, exists: false, featureAvailable: false }
    }
  }

  private async setLatestPlanEndpoint(executionId: string): Promise<boolean> {
    if (this.DUMMY_MODE) {
      return this.setDummyLatestPlan(executionId)
    }

    try {
      const response = await client.post(
        '/set-plan-latest/',
        { id_execution: executionId },
        {},
        true,
      )

      return response.status === 200
    } catch (error) {
      console.error('Error setting latest plan:', error)
      return false
    }
  }

  // Dummy implementations for testing

  private dummyLatestPlanId: string | null = null

  private async getDummyLatestPlan(): Promise<{
    execution_id: string | null
    exists: boolean
  }> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300))

    // Check localStorage for persisted dummy data
    const storedId = localStorage.getItem('dummy_latest_plan_id')

    if (storedId) {
      this.dummyLatestPlanId = storedId
      return { execution_id: storedId, exists: true }
    }

    return { execution_id: null, exists: false }
  }

  private async setDummyLatestPlan(executionId: string): Promise<boolean> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    this.dummyLatestPlanId = executionId
    localStorage.setItem('dummy_latest_plan_id', executionId)

    return true
  }

  /**
   * Clears the dummy latest plan (for testing purposes)
   */
  clearDummyLatestPlan(): void {
    this.dummyLatestPlanId = null
    localStorage.removeItem('dummy_latest_plan_id')
  }

  /**
   * Resets the feature availability cache (for testing purposes)
   */
  resetFeatureAvailability(): void {
    this.featureAvailable = null
  }
}
