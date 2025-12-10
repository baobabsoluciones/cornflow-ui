// Operation types for dynamic API calls
export enum TableOperation {
  GET_LIST = 'get_list',
  GET_ITEM = 'get_item',
  POST_ITEM = 'post_item',
  PATCH_ITEM = 'patch_item',
  PUT_ITEM = 'put_item',
  POST_BULK = 'post_bulk',
  POST_UPDATE_BULK = 'post_update_bulk',
  DELETE_ITEM = 'delete_item',
  DELETE_BULK = 'delete_bulk',
  DELETE_ALL = 'delete_all',
  OVERWRITE_ALL = 'overwrite_all',
  RESTORE_ALL = 'restore_all',
}
