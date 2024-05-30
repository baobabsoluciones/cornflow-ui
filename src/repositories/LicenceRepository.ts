import client from '@/api/Api'
import Licence from '@/models/Licence'

export default class LicenceRepository {
  getLicences(): Promise<any> {
    return new Promise((resolve, reject) => {
      client
        .get(`/licences/`)
        .then((response) => {
          if (response.status === 200) {
            const licences = response.content.map(
              (licence) =>
                new Licence(
                  licence.library,
                  licence.license,
                  licence.version,
                  licence.author,
                  licence.description,
                  licence['home page'],
                ),
            )
            resolve(licences)
          } else {
            reject(new Error('Error getting licences'))
          }
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
}
