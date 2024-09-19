export interface RequestOptions {
  method ?: string;
  mode ?: string;
  body ?: object;
  params ?: Record<string, string>;
  headers ?: object;
}
