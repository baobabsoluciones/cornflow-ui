export default function useFilters(data, searchText, filtersSelected, ignoredAttributes = []) {
    
    // Check if the elements of the array are some other object
    // and applies 'some' again to see if any of its attributes match the search string.
    const deepSearch = (value, searchText) => {
        if (value === null || value === undefined) {
            return false;
        } else if (typeof value === 'object') {
            return Object.entries(value).some(([innerKey, innerValue]) => deepSearch(innerValue, searchText, innerKey));
        } else {
            return value.toString().toLowerCase().includes(searchText);
        }
    };

    return data.value.filter(d => {
        // Check if the data matches the search text
        const matchesSearchText = Object.entries(d)
            .filter(([key]) => !ignoredAttributes.includes(key))
            .some(([key, val]) => val ? deepSearch(val, searchText.value.toLowerCase())  : false);
        // Check if the data matches the selected filters
        const matchesFilters = filtersSelected.value.every(filter => {
            const dValue = d[filter.value.value];
            switch (filter.value.type) {
                case 'boolean':
                    return dValue === filter.value.selectedFilter.value;
                case 'category':
                    return filter.value.selectedFilter.value.includes(dValue.toString());
                case 'number':
                    switch (filter.value.selectedFilter.option) {
                        case 'lt':
                            return dValue < filter.value.selectedFilter.value;
                        case 'gt':
                            return dValue > filter.value.selectedFilter.value;
                        case 'eq':
                            return dValue == filter.value.selectedFilter.value;
                        default:
                            return true;
                    }
                case 'date':
                    return new Date(dValue) >= new Date(filter.value.selectedFilter.start) && new Date(dValue) <= new Date(filter.value.selectedFilter.end);
                default:
                    return true;
            }
        });

        // Returns true if the data matches both the search text and the selected filters
        return matchesSearchText && matchesFilters;
    });
}