import { describe, test, expect, vi, beforeEach } from 'vitest'
import RoleRepository from '@cornflow-ui/core/repositories/RoleRepository'

vi.mock('@cornflow-ui/core/api/Api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), remove: vi.fn() },
}))

import client from '@cornflow-ui/core/api/Api'

const mockClient = client as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

let repo: RoleRepository

beforeEach(() => {
  vi.clearAllMocks()
  repo = new RoleRepository()
})

describe('RoleRepository - roles CRUD', () => {
  test('getRoles resolves content on 200 and rejects otherwise', async () => {
    mockClient.get.mockResolvedValueOnce({ status: 200, content: [{ id: 1, name: 'admin' }] })
    await expect(repo.getRoles()).resolves.toEqual([{ id: 1, name: 'admin' }])
    expect(mockClient.get).toHaveBeenCalledWith('/roles/')

    mockClient.get.mockResolvedValueOnce({ status: 500, content: null })
    await expect(repo.getRoles()).rejects.toThrow('Error getting roles')
  })

  test('getRoles propagates network errors via catch', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('network'))
    await expect(repo.getRoles()).rejects.toThrow('network')
  })

  test('createRole accepts 200 and 201', async () => {
    mockClient.post.mockResolvedValueOnce({ status: 201, content: { id: 2, name: 'editor' } })
    await expect(repo.createRole('editor')).resolves.toEqual({ id: 2, name: 'editor' })
    expect(mockClient.post).toHaveBeenCalledWith('/roles/', { name: 'editor' })

    mockClient.post.mockResolvedValueOnce({ status: 400, content: null })
    await expect(repo.createRole('x')).rejects.toThrow('Error creating role')
  })

  test('updateRole resolves on 200 and rejects otherwise', async () => {
    mockClient.put.mockResolvedValueOnce({ status: 200, content: { id: 3, name: 'r3' } })
    await expect(repo.updateRole(3, 'r3')).resolves.toEqual({ id: 3, name: 'r3' })
    expect(mockClient.put).toHaveBeenCalledWith('/roles/3/', { name: 'r3' })

    mockClient.put.mockResolvedValueOnce({ status: 404, content: null })
    await expect(repo.updateRole(3, 'r3')).rejects.toThrow('Error updating role')
  })

  test('deleteRole returns boolean by status', async () => {
    mockClient.remove.mockResolvedValueOnce({ status: 204 })
    await expect(repo.deleteRole(3)).resolves.toBe(true)
    expect(mockClient.remove).toHaveBeenCalledWith('/roles/3/')

    mockClient.remove.mockResolvedValueOnce({ status: 500 })
    await expect(repo.deleteRole(3)).resolves.toBe(false)
  })
})

describe('RoleRepository - user/role assignments', () => {
  test('getAllUserRoleAssignments resolves on 200, rejects otherwise', async () => {
    mockClient.get.mockResolvedValueOnce({ status: 200, content: [{ id: 1, user_id: 1, role_id: 2 }] })
    await expect(repo.getAllUserRoleAssignments()).resolves.toHaveLength(1)
    expect(mockClient.get).toHaveBeenCalledWith('/user/role/')

    mockClient.get.mockResolvedValueOnce({ status: 403, content: null })
    await expect(repo.getAllUserRoleAssignments()).rejects.toThrow('Error getting user role assignments')
  })

  test('getUserRole hits the nested path', async () => {
    mockClient.get.mockResolvedValueOnce({ status: 200, content: { id: 9 } })
    await expect(repo.getUserRole(1, 2)).resolves.toEqual({ id: 9 })
    expect(mockClient.get).toHaveBeenCalledWith('/user/role/1/2/')

    mockClient.get.mockResolvedValueOnce({ status: 404, content: null })
    await expect(repo.getUserRole(1, 2)).rejects.toThrow('Error getting user role')
  })

  test('assignRoleToUser posts ids and accepts 200/201', async () => {
    mockClient.post.mockResolvedValueOnce({ status: 200, content: { id: 5 } })
    await expect(repo.assignRoleToUser(1, 2)).resolves.toEqual({ id: 5 })
    expect(mockClient.post).toHaveBeenCalledWith('/user/role/', { user_id: 1, role_id: 2 })

    mockClient.post.mockResolvedValueOnce({ status: 409, content: null })
    await expect(repo.assignRoleToUser(1, 2)).rejects.toThrow('Error assigning role to user')
  })

  test('assignRoleToUser omits totp_code from the body when not provided', async () => {
    mockClient.post.mockResolvedValueOnce({ status: 200, content: { id: 5 } })
    await repo.assignRoleToUser(1, 901)
    expect(mockClient.post).toHaveBeenCalledWith('/user/role/', { user_id: 1, role_id: 901 })
    const body = mockClient.post.mock.calls[0][1]
    expect(body).not.toHaveProperty('totp_code')
  })

  test('assignRoleToUser omits totp_code from the body when it is an empty string', async () => {
    mockClient.post.mockResolvedValueOnce({ status: 200, content: { id: 5 } })
    await repo.assignRoleToUser(1, 901, '')
    expect(mockClient.post).toHaveBeenCalledWith('/user/role/', { user_id: 1, role_id: 901 })
    const body = mockClient.post.mock.calls[0][1]
    expect(body).not.toHaveProperty('totp_code')
  })

  test('assignRoleToUser includes totp_code in the body when provided', async () => {
    mockClient.post.mockResolvedValueOnce({ status: 200, content: { id: 5 } })
    await repo.assignRoleToUser(1, 901, '123456')
    expect(mockClient.post).toHaveBeenCalledWith('/user/role/', {
      user_id: 1,
      role_id: 901,
      totp_code: '123456',
    })
  })

  test('assignRoleToUser rejects with totp_required on a 400 two-factor error', async () => {
    mockClient.post.mockResolvedValueOnce({
      status: 400,
      content: { error: 'A valid two-factor authentication code is required to grant a platform role' },
    })
    await expect(repo.assignRoleToUser(1, 901)).rejects.toThrow('totp_required')
  })

  test('assignRoleToUser recognizes the two-factor error case-insensitively', async () => {
    mockClient.post.mockResolvedValueOnce({
      status: 400,
      content: { error: 'Two-Factor authentication required' },
    })
    await expect(repo.assignRoleToUser(1, 901)).rejects.toThrow('totp_required')
  })

  test('assignRoleToUser keeps the generic error for other 400 failures', async () => {
    mockClient.post.mockResolvedValueOnce({
      status: 400,
      content: { error: 'Some unrelated validation error' },
    })
    await expect(repo.assignRoleToUser(1, 2)).rejects.toThrow('Error assigning role to user')
  })

  test('assignRoleToUser keeps the generic error for a 400 with no content', async () => {
    mockClient.post.mockResolvedValueOnce({ status: 400, content: null })
    await expect(repo.assignRoleToUser(1, 2)).rejects.toThrow('Error assigning role to user')
  })

  test('removeRoleFromUser returns boolean by status', async () => {
    mockClient.remove.mockResolvedValueOnce({ status: 200 })
    await expect(repo.removeRoleFromUser(1, 2)).resolves.toBe(true)
    expect(mockClient.remove).toHaveBeenCalledWith('/user/role/1/2/')

    mockClient.remove.mockResolvedValueOnce({ status: 500 })
    await expect(repo.removeRoleFromUser(1, 2)).resolves.toBe(false)
  })
})
