// Helper function to build API URL with parameters
export function buildApiUrl(
  baseUrl: string,
  params: Record<string, any> = {},
): string {
  let url = baseUrl

  // Replace URL parameters in different formats
  Object.entries(params).forEach(([key, value]) => {
    // New format: {idx}
    url = url.replace(`{${key}}`, value.toString())
    // Old format: <int:idx> and <idx>
    url = url.replace(`<int:${key}>`, value.toString())
    url = url.replace(`<${key}>`, value.toString())
  })

  return url
}
