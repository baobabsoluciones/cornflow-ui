import client from '@/api/Api'

export default class VersionRepository {
  getCornflowVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      client
        .get(`/health/`)
        .then((response) => {
          if (response.status === 200) {
            resolve(response.content.cornflow_version)
          } else {
            reject(new Error('Error getting cornflow version'))
          }
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
} 