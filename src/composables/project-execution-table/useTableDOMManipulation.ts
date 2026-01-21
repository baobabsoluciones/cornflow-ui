import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { HeaderItem } from './types';

export function useTableDOMManipulation(getHeaders: () => HeaderItem[]) {
  const resizeTimeout = ref<number | null>(null);
  const resizeObserver = ref<ResizeObserver | null>(null);
  const observedContainers = ref<Set<Element>>(new Set());
  
  // Add or update column group to enforce column widths
  const addColgroup = () => {
    nextTick(() => {
      const tables = document.querySelectorAll('.execution-table table');
      const headers = getHeaders();
      
      tables.forEach((table) => {
        // Get the container width for this specific table
        const container = table.closest('.table-container');
        const containerWidth = container?.clientWidth || 1000;
        const pixelWidths = calculatePixelWidths(headers, containerWidth);
        updateColgroupInTable(table, headers, pixelWidths);
        
        // Observe new containers for resize
        if (container && resizeObserver.value && !observedContainers.value.has(container)) {
          resizeObserver.value.observe(container);
          observedContainers.value.add(container);
        }
      });
    });
  };

  const calculatePixelWidths = (headers: HeaderItem[], containerWidth: number): number[] => {
    return headers.map(header => {
      const percentage = parseFloat(header.width);
      return Math.floor((percentage / 100) * containerWidth);
    });
  };

  const updateColgroupInTable = (table: Element, headers: HeaderItem[], pixelWidths: number[]): void => {
    // Remove existing colgroup to update with new widths
    const existingColgroup = table.querySelector('colgroup');
    if (existingColgroup) {
      existingColgroup.remove();
    }

    const colgroup = document.createElement('colgroup');
    createColumnElements(colgroup, headers, pixelWidths);
    table.insertBefore(colgroup, table.firstChild);
  };

  const createColumnElements = (colgroup: HTMLElement, headers: HeaderItem[], pixelWidths: number[]): void => {
    headers.forEach((header, index) => {
      const col = document.createElement('col');
      col.style.width = `${pixelWidths[index]}px`;
      colgroup.appendChild(col);
    });
  };
  
  // Handle resize with debounce
  const handleResize = () => {
    // Debounce resize handler to avoid performance issues
    if (resizeTimeout.value !== null) {
      window.clearTimeout(resizeTimeout.value);
    }
    resizeTimeout.value = window.setTimeout(() => {
      addColgroup();
    }, 150);
  };

  // Initialize ResizeObserver
  const initResizeObserver = () => {
    resizeObserver.value = new ResizeObserver(() => {
      handleResize();
    });
  };
  
  // Lifecycle hooks
  onMounted(() => {
    // Initialize ResizeObserver first
    initResizeObserver();
    // Then add colgroups (which will also observe containers)
    addColgroup();
    // Add resize event listener for window resize
    window.addEventListener('resize', handleResize);
  });
  
  onBeforeUnmount(() => {
    // Clean up resize event listener
    window.removeEventListener('resize', handleResize);
    // Clean up ResizeObserver
    if (resizeObserver.value) {
      resizeObserver.value.disconnect();
      resizeObserver.value = null;
    }
    observedContainers.value.clear();
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