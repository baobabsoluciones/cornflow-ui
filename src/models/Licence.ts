export default class Licence {
  library: string
  license: string
  version: string
  author: string
  description: string
  homePage: string

  constructor(
    library: string,
    license: string,
    version: string,
    author: string,
    description: string,
    homePage: string,
  ) {
    this.library = library
    this.license = license
    this.version = version
    this.author = author
    this.description = description
    this.homePage = homePage
  }
}
