export interface RequestOptions {
  method?: string;
  mode?: RequestMode;
  body?: any;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  _retried?: boolean;
}
