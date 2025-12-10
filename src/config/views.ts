// Table configuration types for the application

export interface TableConfig {
  group: string
  title: string
  icon?: string
  _originalGroup?: any
  _originalTitle?: any
  // Operations
  get_list?: OperationConfig
  get_item?: OperationConfig
  post_item?: OperationConfig
  put_item?: OperationConfig
  delete_item?: OperationConfig
  post_bulk?: OperationConfig
  delete_bulk?: OperationConfig
  overwrite_all?: OperationConfig
}

export interface OperationConfig {
  url: string
  http_method: string
  request_schema?: any
  response_schema?: any
}

export interface TableSchema {
  [tableName: string]: TableConfig
}
