import client from '@cornflow-ui/core/api/Api'

export interface Warning {
  message: string
}

export default class WarningsRepository {
  async getWarnings(): Promise<Warning[]> {
    const response = await client.get('/warnings/', {}, {}, true)
    if (response.status === 200) {
      return response.content as Warning[]
    }
    throw new Error(`Failed to fetch warnings (${response.status})`)
  }

  async downloadWarnings(): Promise<void> {
    const { status, blob, filename } = await client.getBlob('/warnings/download/', {}, true)
    if (status < 200 || status >= 300) {
      throw new Error(`Download failed (${status})`)
    }
    const safeName = filename || 'warnings.xlsx'
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = safeName
    a.click()
    URL.revokeObjectURL(objectUrl)
  }
}
