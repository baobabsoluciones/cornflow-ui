import client from '@/api/Api'
import { useGeneralStore } from '@/stores/general'
import { InstanceCore } from '@/models/Instance'
import { getMessageFromResponseContent } from '@/utils/i18nUtils'
import { stripInvisibleParameterPropertiesFromInstanceData } from '@/utils/schemaUtils'

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
      const msg = getMessageFromResponseContent(
        response?.content,
        `Error launching instance data checks: Status ${response.status}`,
      )
      throw new Error(msg)
    }
  }

  async createInstance(data) {
    const store = useGeneralStore()
    const instanceSchema = store.schemaConfig?.instanceSchema
    const cleanedData = instanceSchema
      ? stripInvisibleParameterPropertiesFromInstanceData(
          data.instance.data,
          instanceSchema,
        )
      : data.instance.data
    const json = {
      data: cleanedData,
      name: data.name,
      schema: store.getSchemaName,
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
}
