/**
 * The ways a bulk upload can write a table, by the operation the backend calls it
 * (`post_update_bulk`, `post_bulk`, `overwrite_all`): the key of their texts
 * (`dataTable.bulkUpload.modes.<key>.title` and `.description`) and how they look.
 */
export const BULK_UPLOAD_MODES: Record<
  string,
  { key: string; icon: string; recommended?: boolean; danger?: boolean }
> = {
  post_update_bulk: { key: 'update', icon: 'mdi-database-refresh-outline', recommended: true },
  post_bulk: { key: 'append', icon: 'mdi-database-plus-outline' },
  overwrite_all: { key: 'replace', icon: 'mdi-database-remove-outline', danger: true },
}
