export type CategoryType = string;

export interface CustomCategory {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  category: CategoryType;
  priority: 'high' | 'medium' | 'low';
  estimatedPomodoros: number;
  completedPomodoros: number;
  completed: boolean;
  createdAt: string;
  notes?: string;
  completedAt?: string;
  archived?: boolean;
}

export interface TimeLog {
  id: string;
  taskId?: string;
  taskTitle?: string;
  category: CategoryType;
  durationMinutes: number;
  timestamp: string;
}

export interface OptimizedScheduleItem {
  time: string;
  activity: string;
  reason: string;
  isFocusSession: boolean;
}

export interface AIOptimizedPlan {
  summary: string;
  schedule: OptimizedScheduleItem[];
  tips: string[];
}
