import getUserFullName from '@cornflow-ui/core/utils/user'

export class User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  /**
   * Optional array of schema (DAG) names the user has access to.
   * - If undefined or empty, user has access to ALL frontend automation tables.
   * - If defined with values, user only sees tables that match these schemas.
   */
  schemas?: string[]
  /**
   * Roles assigned to the user. Used for view/endpoint permission checks.
   * If undefined or empty, no extra restrictions apply.
   */
  roles?: { id: number; name: string }[]
  /** Whether the user has two-factor authentication enabled. */
  mfaEnabled?: boolean

  constructor(
    id: string,
    username: string,
    email: string,
    firstName: string,
    lastName: string,
    schemas?: string[],
    roles?: { id: number; name: string }[],
  ) {
    this.id = id
    this.username = username
    this.email = email
    this.firstName = firstName
    this.lastName = lastName
    this.fullName = getUserFullName(firstName, lastName) || username
    this.schemas = schemas
    this.roles = roles
  }

  /**
   * Checks if the user has access to all tables (no schema restrictions).
   * Returns true if schemas is undefined, null, or empty array.
   */
  hasFullAccess(): boolean {
    return !this.schemas || this.schemas.length === 0
  }

  /**
   * Checks if the user has access to a specific schema.
   * @param schemaName - The schema name to check
   * @returns true if user has access to this schema or has full access
   */
  hasSchemaAccess(schemaName: string): boolean {
    if (this.hasFullAccess()) return true
    return this.schemas.includes(schemaName)
  }

  /**
   * Checks if the user has access to any of the provided schemas.
   * @param schemaNames - Array of schema names to check
   * @returns true if user has access to at least one schema or has full access
   */
  hasAnySchemaAccess(schemaNames: string[]): boolean {
    if (this.hasFullAccess()) return true
    if (!schemaNames || schemaNames.length === 0) return true // No restriction
    return schemaNames.some((schema) => this.schemas.includes(schema))
  }
}