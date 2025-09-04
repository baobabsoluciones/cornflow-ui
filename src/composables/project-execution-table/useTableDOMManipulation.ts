import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { HeaderItem } from './types';

export function useTableDOMManipulation(getHeaders: () => HeaderItem[]) {
  const resizeTimeout = ref<number | null>(null);
  
  // Add column group to enforce column widths
  const addColgroup = () => {
    nextTick(() => {
      const tables = document.querySelectorAll('.execution-table table');
      const containerWidth = getContainerWidth();
      const headers = getHeaders();
      const pixelWidths = calculatePixelWidths(headers, containerWidth);
      
      tables.forEach((table) => {
        addColgroupToTable(table, headers, pixelWidths);
      });
    });
  };

  const getContainerWidth = (): number => {
    return document.querySelector('.table-container')?.clientWidth || 1000;
  };

  const calculatePixelWidths = (headers: HeaderItem[], containerWidth: number): number[] => {
    return headers.map(header => {
      const percentage = parseFloat(header.width);
      return Math.floor((percentage / 100) * containerWidth);
    });
  };

  const addColgroupToTable = (table: Element, headers: HeaderItem[], pixelWidths: number[]): void => {
    if (table.querySelector('colgroup')) {
      return; // Colgroup already exists
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