export interface Execution {
  id: string;
  createdAt: string;
  finishedAt: string | null;
  state: number;
  solution_state: any; 
  name: string;
  description: string;
  userName: string | null;
  config: {
    solver?: string;
    timeLimit?: number | string;
  };
  time?: string;
}

export interface HeaderItem {
  title: string;
  value: string;
  width: string;
  sortable: boolean;
  fixedWidth: boolean;
}

export interface StateInfo {
  color: string;
  message: string;
  code: string;
}

export interface ExecutionTableProps {
  executionsByDate: Execution[];
  formatDateByTime: boolean;
  showHeaders: boolean;
  showFooter: boolean;
  useFixedWidth: boolean;
} 