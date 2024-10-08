// Define a type for each filter type
interface CheckboxFilter {
  type: 'checkbox'
  value: string[]
}

interface RangeFilter {
  type: 'range'
  value: [number, number]
}

interface DateRangeFilter {
  type: 'daterange'
  value: [string, string]
}

// Union type for all filter types
type Filter = CheckboxFilter | RangeFilter | DateRangeFilter

export default function useFilters(
  data,
  searchText,
  filtersSelected,
  ignoredAttributes = [],
) {
  // Check if the elements of the array are some other object
  // and applies 'some' again to see if any of its attributes match the search string.
  const deepSearch = (value, searchText, innerKey?: string) => {
    if (value === null || value === undefined) {
      return false
    } else if (typeof value === 'object') {
      return Object.entries(value).some(([innerKey, innerValue]) =>
        deepSearch(innerValue, searchText, innerKey),
      )
    } else {
      return value.toString().toLowerCase().includes(searchText)
    }
  }

  return data.filter((d) => {
    // Check if the data matches the search text
    const matchesSearchText = Object.entries(d)
      .filter(([key]) => !ignoredAttributes.includes(key))
      .some(([key, val]) =>
        val ? deepSearch(val, searchText.toLowerCase()) : false,
      )
    // Check if the data matches the selected filters
    const matchesFilters = Object.entries(filtersSelected || {}).every(
      ([filterKey, filter]: [string, Filter]) => {
        if (!filter) {
          return true
        }
        const dValue = d[filterKey]
        switch (filter.type) {
          case 'checkbox':
            const dValueStr = dValue ? dValue.toString() : 'false'
            return filter.value.includes(dValueStr)
          case 'range':
            return dValue >= filter.value[0] && dValue <= filter.value[1]
          case 'daterange':
            const startDate = new Date(filter.value[0])
            const endDate = new Date(filter.value[1])
            const dateValue = new Date(dValue)
            return dateValue >= startDate && dateValue <= endDate
          default:
            return true
        }
      },
    )

    // Returns true if the data matches both the search text and the selected filters
    return matchesSearchText && matchesFilters
  })
}
