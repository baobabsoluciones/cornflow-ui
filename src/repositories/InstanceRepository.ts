import client from '@/api/Api'
import { useGeneralStore } from '@/stores/general'
import { InstanceCore } from '@/models/Instance'

export default class InstanceRepository {
  // Get instance by id
  async getInstance(id: string): Promise<InstanceCore> {
    const response = await client.get(`/instance/${id}/data/`)

    if (response.status === 200) {
      const { Instance } = useGeneralStore().appConfig
      const instanceContent = response.content
      const instance = new Instance(
        instanceContent.id,
        instanceContent.data,
        useGeneralStore().schemaConfig.instanceSchema,
        useGeneralStore().schemaConfig.instanceChecksSchema,
        useGeneralStore().getSchemaName,
        instanceContent.checks,
      )
      return instance
    } else {
      throw new Error('Error getting instance')
    }
  }

  async launchInstanceDataChecks(id: string) {
    const response = await client.post(
      `/data-check/instance/${id}/`,
      {},
      {
        'Content-Type': 'application/json',
      },
    )

    if (response.status === 201) {
      return response.content
    } else {
      throw new Error(
        `Error launching instance data checks: Status ${response.status} - ${response?.content?.message || 'Unknown error'}`,
      )
    }
  }

  async createInstance(data) {
    const json = {
      data: data.instance.data,
      name: data.name,
      schema: useGeneralStore().getSchemaName,
    }
    const response = await client.post('/instance/', json, {
      'Content-Type': 'application/json',
    })

    if (response.status === 201) {
      return response.content
    } else {
      throw new Error('Error creating instance')
    }
  }

  async etlBackend(files: File[]): Promise<any> {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }

    const response = await client.post('/etl/', formData, {}, true)

    if (response.status === 200 || response.status === 201) {
      return response.content
    }

    const error: any = new Error('Upload failed')
    if (Array.isArray(response.content)) {
      error.details = response.content
    } else if (response.content && Array.isArray(response.content.errors)) {
      error.details = response.content.errors
    } else if (response.content && response.content.message) {
      error.message = response.content.message
    }
    throw error
  }
}
