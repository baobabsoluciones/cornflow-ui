import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { HeaderItem } from './types';

export function useTableDOMManipulation(getHeaders: () => HeaderItem[]) {
  const resizeTimeout = ref<number | null>(null);
  
  // Add column group to enforce column widths
  const addColgroup = () => {
    nextTick(() => {
      // Add colgroup to enforce column widths
      const tables = document.querySelectorAll('.execution-table table');
      
      // Get the computed widths based on the container width
      let containerWidth = document.querySelector('.table-container')?.clientWidth || 1000;
      
      // Calculate fixed pixel widths based on percentage
      const headers = getHeaders();
      const pixelWidths = headers.map(header => {
        // Convert percentage to pixel width
        const percentage = parseFloat(header.width);
        return Math.floor((percentage / 100) * containerWidth);
      });
      
      tables.forEach((table) => {
        // Check if colgroup already exists
        if (!table.querySelector('colgroup')) {
          const colgroup = document.createElement('colgroup');
          
          // Apply the width from each header to create the colgroup using fixed pixel widths
          headers.forEach((header, index) => {
            const col = document.createElement('col');
            // Use pixel widths for more precise control
            col.style.width = `${pixelWidths[index]}px`;
            colgroup.appendChild(col);
          });

          // Insert colgroup at the beginning of the table
          table.insertBefore(colgroup, table.firstChild);
        }
      });
    });
  };
  
  // Handle window resize
  const handleResize = () => {
    // Debounce resize handler to avoid performance issues
    if (resizeTimeout.value !== null) {
      window.clearTimeout(resizeTimeout.value);
    }
    resizeTimeout.value = window.setTimeout(() => {
      addColgroup();
    }, 150);
  };
  
  // Lifecycle hooks
  onMounted(() => {
    addColgroup();
    // Add resize event listener for responsive tables
    window.addEventListener('resize', handleResize);
  });
  
  onBeforeUnmount(() => {
    // Clean up resize event listener
    window.removeEventListener('resize', handleResize);
    // Clear any pending timeout
    if (resizeTimeout.value !== null) {
      window.clearTimeout(resizeTimeout.value);
    }
  });
  
  return {
    addColgroup,
    handleResize
  };
} 