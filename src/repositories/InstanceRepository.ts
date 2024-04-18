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
        useGeneralStore().getSchemaName,
        instanceContent.checks,
      )
      return instance
    } else {
      throw new Error('Error getting instance')
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
}
