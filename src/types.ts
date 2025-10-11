export interface ChecklistItem {
    id: string;
    task_id: string;
    text: string;
    is_checked: boolean;
    position: number;
    created_at?: string;
}

export interface Task {
    id: string;
    user_id: string;
    title: string;
    description: string;
    is_pinned: boolean;
    is_completed: boolean;
    due_date: string | null;
    completed_at: string | null;
    position: number;
    is_recurring: boolean;
    recurring_type: string | null;
    recurring_interval: string | null;
    recurring_counter: number;
    created_at: string;
    updated_at: string;
    checklist_items?: ChecklistItem[];
}

export type TabType = 'main' | 'upcoming' | 'completed';