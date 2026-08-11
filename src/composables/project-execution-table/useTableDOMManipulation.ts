import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { HeaderItem } from './types';

export function useTableDOMManipulation(getHeaders: () => HeaderItem[]) {
  const resizeTimeout = ref<number | null>(null);
  const resizeObserver = ref<ResizeObserver | null>(null);
  const observedContainers = ref<Set<Element>>(new Set());
  
  // Add or update column group to enforce column widths.
  //
  // The widths are applied as PERCENTAGES (taken straight from the header
  // definition). Combined with `table-layout: fixed; width: 100%` in the
  // stylesheet this gives us, for free:
  //   - identical column widths on every day's table (perfect alignment
  //     across dates, including the header-less tables that have no <th>),
  //   - fully responsive columns that follow the viewport without any
  //     pixel recomputation, so no horizontal scroll appears.
  const addColgroup = () => {
    nextTick(() => {
      const tables = document.querySelectorAll('.execution-table table');
      const headers = getHeaders();

      tables.forEach((table) => {
        updateColgroupInTable(table, headers);

        // Observe new containers for resize (kept so the table re-renders
        // cleanly if the layout changes; widths themselves are pure CSS).
        const container = table.closest('.table-container');
        if (container && resizeObserver.value && !observedContainers.value.has(container)) {
          resizeObserver.value.observe(container);
          observedContainers.value.add(container);
        }
      });
    });
  };

  const updateColgroupInTable = (table: Element, headers: HeaderItem[]): void => {
    // Remove existing colgroup to update with new widths
    const existingColgroup = table.querySelector('colgroup');
    if (existingColgroup) {
      existingColgroup.remove();
    }

    const colgroup = document.createElement('colgroup');
    createColumnElements(colgroup, headers);
    table.insertBefore(colgroup, table.firstChild);
  };

  const createColumnElements = (colgroup: HTMLElement, headers: HeaderItem[]): void => {
    headers.forEach((header) => {
      const col = document.createElement('col');
      // header.width is a percentage string (e.g. "13%"); fall back to auto.
      col.style.width = header.width || 'auto';
      colgroup.appendChild(col);
    });
  };
  
  // Handle resize with debounce
  const handleResize = () => {
    // Debounce resize handler to avoid performance issues
    if (resizeTimeout.value !== null) {
      globalThis.window.clearTimeout(resizeTimeout.value);
    }
    resizeTimeout.value = globalThis.window.setTimeout(() => {
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
      globalThis.window.clearTimeout(resizeTimeout.value);
    }
  });

  return {
    addColgroup,
    handleResize
  };
} 