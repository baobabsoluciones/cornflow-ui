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
  /** Excel export (GET); automation must use `download_excel_table` (url + http_method). */
  DOWNLOAD_EXCEL = 'download_excel_table',
  // Async bulk operations: accept an unprocessed file, launch an Airflow job, return an
  // upload_id (202), then poll ASYNC_UPLOAD_STATUS until terminal. A table declares either
  // the sync bulk operations OR their async counterparts, not both.
  /** Async create-many: POST a raw file, returns upload_id (202). Async counterpart of POST_BULK. */
  ASYNC_POST_BULK = 'async_post_bulk',
  /** Async update-many: POST a raw file, returns upload_id (202). Async counterpart of POST_UPDATE_BULK. */
  ASYNC_POST_UPDATE_BULK = 'async_post_update_bulk',
  /** Async overwrite-all: POST a raw file, returns upload_id (202). Async counterpart of OVERWRITE_ALL. */
  ASYNC_OVERWRITE_ALL = 'async_overwrite_all',
  /** Poll an async upload status by upload_id (GET, url has an `{upload_id}` placeholder). */
  ASYNC_UPLOAD_STATUS = 'async_upload_status',
}
