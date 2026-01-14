import client from '@/api/Api'
import { TableOperation } from '@/types/table'
import { buildApiUrl } from '@/utils/urlUtils'
import {
  getOperationConfig,
  isOperationSupported,
} from '@/services/FrontendAutomationService'
import { getLocalizedMessage } from '@/utils/i18nUtils'

export default class TableRepository {
  private tableConfig: any
  private t?: (key: string, params?: Record<string, any>) => string

  constructor(
    tableConfig: any,
    t?: (key: string, params?: Record<string, any>) => string,
  ) {
    this.tableConfig = tableConfig
    this.t = t
  }

  // Generic method to perform any table operation
  private async performOperation(
    operation: TableOperation,
    params: Record<string, any> = {},
    data: any = null,
  ): Promise<any> {
    if (!isOperationSupported(this.tableConfig, operation)) {
      const message = this.t
        ? this.t('table.repository.operationNotSupported')
        : 'This action is not available for this table'
      throw new Error(message)
    }

    const operationConfig = getOperationConfig(this.tableConfig, operation)
    const url = buildApiUrl(operationConfig.url, params)
    const method = operationConfig.http_method.toLowerCase()

    let response
    try {
      switch (method) {
        case 'get':
          response = await client.get(url, {}, {}, true)
          break
        case 'post':
          response = await client.post(url, data, {}, true)
          break
        case 'put':
          response = await client.put(url, data, {}, true)
          break
        case 'patch':
          // Use put for patch operations since API client doesn't have patch method
          response = await client.put(url, data, {}, true)
          break
        case 'delete':
          response = await client.remove(url, {}, true, data)
          break
        default:
          const unsupportedMethodMessage = this.t
            ? this.t('table.repository.unsupportedHttpMethod')
            : 'An error occurred while processing your request'
          throw new Error(unsupportedMethodMessage)
      }

      if (response.status >= 200 && response.status < 300) {
        return response.content
      } else {
        const apiCallFailedMessage = response.content.message
          ? getLocalizedMessage(response.content.message)
          : 'An error occurred while saving your data. Please try again'
        throw new Error(apiCallFailedMessage)
      }
    } catch (error) {
      console.error(`Error performing ${operation}:`, error)
      throw error
    }
  }

  // Get all items
  async getList(): Promise<any[]> {
    return this.performOperation(TableOperation.GET_LIST)
  }

  // Get a single item by ID
  async getItem(id: string | number): Promise<any> {
    return this.performOperation(TableOperation.GET_ITEM, { idx: id })
  }

  // Create a new item
  async createItem(itemData: any): Promise<any> {
    return this.performOperation(TableOperation.POST_ITEM, {}, itemData)
  }

  // Update an existing item by ID (partial update)
  async patchItem(id: string | number, itemData: any): Promise<any> {
    return this.performOperation(
      TableOperation.PATCH_ITEM,
      { idx: id },
      itemData,
    )
  }

  // Replace an existing item by ID (full update)
  async updateItem(id: string | number, itemData: any): Promise<any> {
    return this.performOperation(TableOperation.PUT_ITEM, { idx: id }, itemData)
  }

  // Alias for updateItem to match component usage
  async putItem(id: string | number, itemData: any): Promise<any> {
    return this.updateItem(id, itemData)
  }

  // Create multiple new items
  async createBulk(items: any[]): Promise<any> {
    return this.performOperation(TableOperation.POST_BULK, {}, items)
  }

  // Update multiple existing items
  async updateBulk(items: any[]): Promise<any> {
    return this.performOperation(TableOperation.POST_UPDATE_BULK, {}, items)
  }

  // Delete an item by ID
  async deleteItem(id: string | number): Promise<any> {
    return this.performOperation(TableOperation.DELETE_ITEM, { idx: id })
  }

  // Delete multiple items by IDs
  async deleteBulk(ids: (string | number)[]): Promise<any> {
    return this.performOperation(TableOperation.DELETE_BULK, {}, { ids })
  }

  // Delete all items
  async deleteAll(): Promise<any> {
    return this.performOperation(TableOperation.DELETE_ALL)
  }

  // Overwrite all items
  async overwriteAll(items: any[]): Promise<any> {
    return this.performOperation(TableOperation.OVERWRITE_ALL, {}, items)
  }

  // Restore all previously deleted items
  async restoreAll(): Promise<any> {
    return this.performOperation(TableOperation.RESTORE_ALL)
  }

  // Helper method to get supported operations
  getSupportedOperations(): TableOperation[] {
    const operations: TableOperation[] = []

    Object.values(TableOperation).forEach((operation) => {
      if (isOperationSupported(this.tableConfig, operation)) {
        operations.push(operation)
      }
    })

    return operations
  }

  // Helper method to check if an operation is supported
  isOperationSupported(operation: TableOperation): boolean {
    return isOperationSupported(this.tableConfig, operation)
  }
}
