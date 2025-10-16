import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Calendar, Plus, Search, Menu, X, Check, Edit2, Trash2, Bell, Settings } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Task, ChecklistItem, TabType } from './types';

export default function App() {
    // Auth State
    const [session, setSession] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [authError, setAuthError] = useState('');
    const [loading, setLoading] = useState(false);

    // Task State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('main');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    // Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDescModal, setShowDescModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formIsPinned, setFormIsPinned] = useState(false);
    const [formChecklist, setFormChecklist] = useState<ChecklistItem[]>([]);
    const [newChecklistText, setNewChecklistText] = useState('');
    const [formIsRecurring, setFormIsRecurring] = useState(false);
    const [formRecurringType, setFormRecurringType] = useState('simple');
    const [formRecurringInterval, setFormRecurringInterval] = useState('weekly');

    // Notification State
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const [notifDayBefore, setNotifDayBefore] = useState(true);
    const [notifDayOf, setNotifDayOf] = useState(true);
    const [notifTwoHours, setNotifTwoHours] = useState(true);

    // Check auth session on mount
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Load tasks when authenticated
    useEffect(() => {
        if (session) {
            loadTasks();
            checkNotificationPermission();
        }
    }, [session]);

    // Check notification permission
    const checkNotificationPermission = () => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
            setNotificationsEnabled(Notification.permission === 'granted');
        }
    };

    // Request notification permission
    const requestNotificationPermission = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            setNotificationsEnabled(permission === 'granted');

            if (permission === 'granted') {
                alert('✅ Notifications enabled! You will receive reminders for tasks with due dates.');
                // Reschedule all notifications
                tasks.forEach(task => {
                    if (task.due_date && !task.is_completed) {
                        scheduleNotifications(task);
                    }
                });
            } else {
                alert('❌ Notifications disabled. Enable them in your browser settings to receive reminders.');
            }
        } else {
            alert('❌ Your browser does not support notifications.');
        }
    };

    // Schedule notifications for a task
    const scheduleNotifications = (task: Task) => {
        if (!notificationsEnabled || !task.due_date || task.is_completed) return;

        const dueDate = new Date(task.due_date);
        const now = new Date();

        // Clear any existing scheduled notifications for this task
        const storageKey = `notifications_${task.id}`;
        const existingTimeouts = sessionStorage.getItem(storageKey);
        if (existingTimeouts) {
            const timeouts = JSON.parse(existingTimeouts);
            timeouts.forEach((id: number) => clearTimeout(id));
        }

        const timeoutIds: number[] = [];

        // Schedule notification function
        const scheduleNotification = (time: Date, message: string) => {
            if (time > now) {
                const timeout = time.getTime() - now.getTime();
                const id = window.setTimeout(() => {
                    new Notification('Task Reminder', {
                        body: `${message}: ${task.title}`,
                        icon: '/icon-192.png',
                        tag: task.id,
                        requireInteraction: false
                    });
                }, timeout);
                timeoutIds.push(id);
            }
        };

        // Day before at 9 AM (if enabled)
        if (notifDayBefore) {
            const dayBefore = new Date(dueDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            dayBefore.setHours(9, 0, 0, 0);
            scheduleNotification(dayBefore, 'Due tomorrow');
        }

        // Day of at 9 AM (if enabled)
        if (notifDayOf) {
            const dayOf = new Date(dueDate);
            dayOf.setHours(9, 0, 0, 0);
            scheduleNotification(dayOf, 'Due today');
        }

        // 2 hours before (if enabled)
        if (notifTwoHours) {
            const twoHoursBefore = new Date(dueDate);
            twoHoursBefore.setHours(twoHoursBefore.getHours() - 2);
            scheduleNotification(twoHoursBefore, 'Due in 2 hours');
        }

        // Store timeout IDs
        sessionStorage.setItem(storageKey, JSON.stringify(timeoutIds));
    };

    // Cancel notifications for a task
    const cancelNotifications = (taskId: string) => {
        const storageKey = `notifications_${taskId}`;
        const existingTimeouts = sessionStorage.getItem(storageKey);
        if (existingTimeouts) {
            const timeouts = JSON.parse(existingTimeouts);
            timeouts.forEach((id: number) => clearTimeout(id));
            sessionStorage.removeItem(storageKey);
        }
    };

    // Authentication functions
    const signIn = async () => {
        setAuthError('');
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setAuthError(error.message);
        }
        setLoading(false);
    };

    const signUp = async () => {
        setAuthError('');
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        if (error) {
            setAuthError(error.message);
        } else {
            alert('✅ Account created! Please sign in.');
            setIsSignUp(false);
        }
        setLoading(false);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setTasks([]);
        setExpandedTasks(new Set());
        setSearchQuery('');
    };

    // Load tasks from Supabase
    const loadTasks = async () => {
        const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .order('position', { ascending: true });

        if (tasksError) {
            console.error('Error loading tasks:', tasksError);
            return;
        }

        const { data: checklistData, error: checklistError } = await supabase
            .from('checklist_items')
            .select('*')
            .order('position', { ascending: true });

        if (checklistError) {
            console.error('Error loading checklist items:', checklistError);
            return;
        }

        const tasksWithChecklists = tasksData.map((task) => ({
            ...task,
            checklist_items: checklistData.filter((item) => item.task_id === task.id),
        }));

        setTasks(tasksWithChecklists);

        // Schedule notifications for tasks with due dates
        tasksWithChecklists.forEach((task) => {
            if (task.due_date && !task.is_completed) {
                scheduleNotifications(task);
            }
        });
    };

    // Save task (create or update)
    const saveTask = async () => {
        if (!formTitle.trim()) {
            alert('Please enter a task title');
            return;
        }

        const taskData = {
            title: formTitle.trim(),
            description: formDescription.trim(),
            is_pinned: formIsPinned,
            due_date: formDueDate || null,
            position: editingTask ? editingTask.position : tasks.length,
            is_recurring: formIsRecurring,
            recurring_type: formIsRecurring ? formRecurringType : null,
            recurring_interval: formIsRecurring ? formRecurringInterval : null,
        };

        if (editingTask) {
            // Update existing task
            const { error } = await supabase
                .from('tasks')
                .update(taskData)
                .eq('id', editingTask.id);

            if (error) {
                console.error('Error updating task:', error);
                alert('Failed to update task');
                return;
            }

            // Delete old checklist items
            await supabase.from('checklist_items').delete().eq('task_id', editingTask.id);

            // Insert new checklist items
            if (formChecklist.length > 0) {
                const checklistItems = formChecklist.map((item, index) => ({
                    task_id: editingTask.id,
                    text: item.text.trim(),
                    is_checked: item.is_checked,
                    position: index,
                }));

                await supabase.from('checklist_items').insert(checklistItems);
            }

            // Reschedule notifications
            cancelNotifications(editingTask.id);
            if (formDueDate && !editingTask.is_completed) {
                scheduleNotifications({ ...editingTask, ...taskData } as Task);
            }
        } else {
            // Create new task
            const { data, error } = await supabase
                .from('tasks')
                .insert([taskData])
                .select()
                .single();

            if (error) {
                console.error('Error creating task:', error);
                alert('Failed to create task');
                return;
            }

            // Save checklist items
            if (formChecklist.length > 0 && data) {
                const checklistItems = formChecklist.map((item, index) => ({
                    task_id: data.id,
                    text: item.text.trim(),
                    is_checked: item.is_checked,
                    position: index,
                }));

                await supabase.from('checklist_items').insert(checklistItems);
            }

            // Schedule notifications
            if (formDueDate && data) {
                scheduleNotifications(data as Task);
            }
        }

        closeModal();
        loadTasks();
    };

    // Delete task
    const deleteTask = async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return;

        cancelNotifications(taskId);

        const { error } = await supabase.from('tasks').delete().eq('id', taskId);

        if (error) {
            console.error('Error deleting task:', error);
            alert('Failed to delete task');
            return;
        }

        loadTasks();
    };

    // Toggle complete
    const toggleComplete = async (task: Task) => {
        const newCompleted = !task.is_completed;

        // Handle recurring tasks
        if (newCompleted && task.is_recurring) {
            // Create new recurring task
            let newTitle = task.title;

            if (task.recurring_type === 'progressive') {
                // Extract number and increment
                const match = task.title.match(/(\d+)/);
                if (match) {
                    const currentNum = parseInt(match[0]);
                    newTitle = task.title.replace(/\d+/, String(currentNum + 1));
                }
            }

            // Calculate next due date
            let nextDueDate = null;
            if (task.due_date) {
                const currentDue = new Date(task.due_date);
                nextDueDate = new Date(currentDue);

                if (task.recurring_interval === 'daily') {
                    nextDueDate.setDate(nextDueDate.getDate() + 1);
                } else if (task.recurring_interval === 'weekly') {
                    nextDueDate.setDate(nextDueDate.getDate() + 7);
                } else if (task.recurring_interval === 'monthly') {
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                }
            }

            // Create new task
            const newTaskData = {
                title: newTitle,
                description: task.recurring_type === 'progressive' ? '' : task.description,
                is_pinned: task.is_pinned,
                due_date: nextDueDate?.toISOString() || null,
                position: task.position,
                is_recurring: true,
                recurring_type: task.recurring_type,
                recurring_interval: task.recurring_interval,
            };

            await supabase.from('tasks').insert([newTaskData]);
        }

        // Mark current task as complete
        const { error } = await supabase
            .from('tasks')
            .update({
                is_completed: newCompleted,
                completed_at: newCompleted ? new Date().toISOString() : null,
            })
            .eq('id', task.id);

        if (error) {
            console.error('Error toggling complete:', error);
            alert('Failed to update task');
            return;
        }

        // Cancel or schedule notifications based on completion status
        if (newCompleted) {
            cancelNotifications(task.id);
        } else if (task.due_date) {
            scheduleNotifications(task);
        }

        loadTasks();
    };

    // Modal management
    const openModal = (task: Task | null = null) => {
        if (task) {
            setEditingTask(task);
            setFormTitle(task.title);
            setFormDescription(task.description);
            setFormDueDate(task.due_date ? task.due_date.slice(0, 16) : '');
            setFormIsPinned(task.is_pinned);
            setFormChecklist(task.checklist_items || []);
            setFormIsRecurring(task.is_recurring);
            setFormRecurringType(task.recurring_type || 'simple');
            setFormRecurringInterval(task.recurring_interval || 'weekly');
        } else {
            setEditingTask(null);
            setFormTitle('');
            setFormDescription('');
            setFormDueDate('');
            setFormIsPinned(false);
            setFormChecklist([]);
            setFormIsRecurring(false);
            setFormRecurringType('simple');
            setFormRecurringInterval('weekly');
        }
        setShowEditModal(true);
    };

    const closeModal = () => {
        setShowEditModal(false);
        setEditingTask(null);
        setNewChecklistText('');
    };

    const openDescriptionEditor = (task: Task) => {
        setEditingTask(task);
        setFormDescription(task.description);
        setShowDescModal(true);
    };

    const saveDescription = async () => {
        if (!editingTask) return;

        const { error } = await supabase
            .from('tasks')
            .update({ description: formDescription.trim() })
            .eq('id', editingTask.id);

        if (error) {
            console.error('Error updating description:', error);
            alert('Failed to update description');
            return;
        }

        setShowDescModal(false);
        loadTasks();
    };

    // Checklist functions
    const addChecklistItem = () => {
        if (!newChecklistText.trim()) return;
        setFormChecklist([
            ...formChecklist,
            {
                id: `temp-${Date.now()}`,
                task_id: editingTask?.id || '',
                text: newChecklistText.trim(),
                is_checked: false,
                position: formChecklist.length,
            },
        ]);
        setNewChecklistText('');
    };

    const toggleChecklistItem = (index: number) => {
        const updated = [...formChecklist];
        updated[index].is_checked = !updated[index].is_checked;
        setFormChecklist(updated);
    };

    const removeChecklistItem = (index: number) => {
        setFormChecklist(formChecklist.filter((_, i) => i !== index));
    };

    const toggleChecklistItemInline = async (
        itemId: string,
        currentChecked: boolean
    ) => {
        const { error } = await supabase
            .from('checklist_items')
            .update({ is_checked: !currentChecked })
            .eq('id', itemId);

        if (error) {
            console.error('Error updating checklist item:', error);
            return;
        }

        loadTasks();
    };

    // Toggle task expansion
    const toggleExpanded = (taskId: string) => {
        const newExpanded = new Set(expandedTasks);
        if (newExpanded.has(taskId)) {
            newExpanded.delete(taskId);
        } else {
            newExpanded.add(taskId);
        }
        setExpandedTasks(newExpanded);
    };

    // Drag and drop handler
    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(getFilteredTasks().filter(t => !t.is_pinned));
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // Update positions
        for (let i = 0; i < items.length; i++) {
            await supabase
                .from('tasks')
                .update({ position: i })
                .eq('id', items[i].id);
        }

        loadTasks();
    };

    // Utility functions
    const formatDate = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const formatDueDate = (dateString: string | null) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        if (checkDate.getTime() === today.getTime()) return 'Today';
        if (checkDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const isOverdue = (task: Task) => {
        if (!task.due_date || task.is_completed) return false;
        return new Date(task.due_date) < new Date();
    };

    const getFilteredTasks = () => {
        let filtered = tasks.filter((task) => {
            if (activeTab === 'main') return !task.is_completed;
            if (activeTab === 'upcoming') return !task.is_completed && task.due_date;
            if (activeTab === 'completed') return task.is_completed;
            return true;
        });

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (task) =>
                    task.title.toLowerCase().includes(query) ||
                    task.description.toLowerCase().includes(query)
            );
        }

        // Sort
        if (activeTab === 'upcoming') {
            filtered.sort((a, b) => {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            });
        } else if (activeTab === 'completed') {
            filtered.sort((a, b) => {
                if (!a.completed_at) return 1;
                if (!b.completed_at) return -1;
                return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
            });
        }

        return filtered;
    };

    const pinnedTasks = getFilteredTasks().filter((t) => t.is_pinned);
    const regularTasks = getFilteredTasks().filter((t) => !t.is_pinned);

    // Auth Screen
    if (!session) {
        return (
            <div style={styles.container}>
                <div style={styles.authCard}>
                    <h1 style={styles.authTitle}>📋 Organizer</h1>
                    <p style={styles.authSubtitle}>Personal Task Management</p>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        autoComplete="email"
                    />
                    <input
                        type="password"
                        placeholder="Password (min 6 characters)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (isSignUp ? signUp() : signIn())}
                        style={styles.input}
                        autoComplete="current-password"
                    />
                    {authError && <p style={styles.error}>{authError}</p>}
                    <button
                        onClick={isSignUp ? signUp : signIn}
                        style={styles.button}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                    <button onClick={() => setIsSignUp(!isSignUp)} style={styles.linkButton}>
                        {isSignUp
                            ? 'Already have an account? Sign In'
                            : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        );
    }

    // Main App
    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.headerTitle}>📋 Organizer</h1>
                <div style={styles.headerButtons}>
                    {notificationsEnabled && <Bell size={20} color="#58a6ff" />}
                    <button onClick={() => setShowSettingsModal(true)} style={styles.settingsButton}>
                        <Settings size={18} />
                    </button>
                    <button onClick={() => openModal()} style={styles.addButton}>
                        <Plus size={20} /> New
                    </button>
                    <button onClick={signOut} style={styles.signOutButton}>
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={styles.searchContainer}>
                <Search size={18} color="#8b949e" />
                <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={styles.searchInput}
                />
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                <button
                    onClick={() => setActiveTab('main')}
                    style={activeTab === 'main' ? styles.tabActive : styles.tab}
                >
                    Main ({tasks.filter(t => !t.is_completed).length})
                </button>
                <button
                    onClick={() => setActiveTab('upcoming')}
                    style={activeTab === 'upcoming' ? styles.tabActive : styles.tab}
                >
                    Upcoming ({tasks.filter(t => !t.is_completed && t.due_date).length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    style={activeTab === 'completed' ? styles.tabActive : styles.tab}
                >
                    Completed ({tasks.filter(t => t.is_completed).length})
                </button>
            </div>

            {/* Content Area */}
            <div style={styles.content}>
                {/* Pinned Tasks Grid */}
                {pinnedTasks.length > 0 && (
                    <div style={styles.pinnedSection}>
                        <h2 style={styles.sectionTitle}>📌 Pinned</h2>

                        {/* Compact unexpanded pinned tasks */}
                        <div style={styles.pinnedGrid}>
                            {pinnedTasks.filter(t => !expandedTasks.has(t.id)).map((task) => (
                                <div
                                    key={task.id}
                                    style={{
                                        ...styles.pinnedCard,
                                        ...(isOverdue(task) ? styles.taskOverdue : {}),
                                    }}
                                    onClick={() => toggleExpanded(task.id)}
                                >
                                    <div style={styles.pinnedTitle}>
                                        {task.title}
                                        {task.is_recurring && <span style={{ marginLeft: '4px' }}>🔄</span>}
                                    </div>
                                    {task.due_date && (
                                        <div style={styles.pinnedDate}>{formatDueDate(task.due_date)}</div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Expanded pinned tasks - full width below */}
                        {pinnedTasks.filter(t => expandedTasks.has(t.id)).length > 0 && (
                            <div style={styles.expandedPinnedSection}>
                                {pinnedTasks.filter(t => expandedTasks.has(t.id)).map((task) => (
                                    <div
                                        key={task.id}
                                        style={{
                                            ...styles.expandedPinnedCard,
                                            ...(isOverdue(task) ? styles.taskOverdue : {}),
                                        }}
                                    >
                                        <div
                                            style={styles.expandedPinnedHeader}
                                            onClick={() => toggleExpanded(task.id)}
                                        >
                                            <span style={styles.taskTitle}>
                                                📌 {task.title}
                                                {task.is_recurring && <span style={{ marginLeft: '4px' }}>🔄</span>}
                                            </span>
                                            {task.due_date && (
                                                <span style={styles.dueDateBadge}>
                                                    {formatDueDate(task.due_date)}
                                                </span>
                                            )}
                                        </div>

                                        <div style={styles.taskExpanded}>
                                            {task.description && (
                                                <p style={styles.description}>{task.description}</p>
                                            )}

                                            {task.checklist_items && task.checklist_items.length > 0 && (
                                                <div style={styles.checklistSection}>
                                                    {task.checklist_items.map((item) => (
                                                        <div key={item.id} style={styles.checklistItem}>
                                                            <input
                                                                type="checkbox"
                                                                checked={item.is_checked}
                                                                onChange={() => toggleChecklistItemInline(item.id, item.is_checked)}
                                                                style={styles.checkbox}
                                                            />
                                                            <span style={{
                                                                ...styles.checklistText,
                                                                ...(item.is_checked ? styles.checklistChecked : {}),
                                                            }}>
                                                                {item.text}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={styles.actionButtons}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleComplete(task);
                                                    }}
                                                    style={styles.actionButton}
                                                >
                                                    <Check size={16} />
                                                    {task.is_completed ? 'Uncomplete' : 'Complete'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openModal(task);
                                                    }}
                                                    style={styles.actionButton}
                                                >
                                                    <Edit2 size={16} /> Edit
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteTask(task.id);
                                                    }}
                                                    style={styles.actionButtonDanger}
                                                >
                                                    <Trash2 size={16} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Regular Tasks with Drag and Drop */}
                {regularTasks.length > 0 ? (
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="tasks">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    style={styles.taskList}
                                >
                                    {regularTasks.map((task, index) => {
                                        const isExpanded = expandedTasks.has(task.id);
                                        return (<Draggable key={task.id} draggableId={task.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    style={{
                                                        ...styles.taskCard,
                                                        ...provided.draggableProps.style,
                                                        ...(isOverdue(task) ? styles.taskOverdue : {}),
                                                        ...(snapshot.isDragging ? styles.taskDragging : {}),
                                                    }}
                                                >
                                                    {/* Task Header */}
                                                    <div
                                                        style={styles.taskHeader}
                                                        onClick={() => toggleExpanded(task.id)}
                                                    >
                                                        <div
                                                            {...provided.dragHandleProps}
                                                            style={styles.dragHandle}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Menu size={18} color="#8b949e" />
                                                        </div>
                                                        <span style={styles.taskTitle}>
                                                            {task.title}
                                                            {task.is_recurring && <span style={{ marginLeft: '4px' }}>🔄</span>}
                                                        </span>
                                                        {task.due_date && (
                                                            <span style={styles.dueDateBadge}>
                                                                {formatDueDate(task.due_date)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Expanded Content */}
                                                    {isExpanded && (
                                                        <div style={styles.taskExpanded}>
                                                            {task.description && (
                                                                <div style={styles.descriptionSection}>
                                                                    <p style={styles.description}>{task.description}</p>
                                                                    <button
                                                                        onClick={() => openDescriptionEditor(task)}
                                                                        style={styles.editDescButton}
                                                                    >
                                                                        <Edit2 size={14} /> Edit
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {task.checklist_items && task.checklist_items.length > 0 && (
                                                                <div style={styles.checklistSection}>
                                                                    {task.checklist_items.map((item) => (
                                                                        <div key={item.id} style={styles.checklistItem}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={item.is_checked}
                                                                                onChange={() =>
                                                                                    toggleChecklistItemInline(
                                                                                        item.id,
                                                                                        item.is_checked
                                                                                    )
                                                                                }
                                                                                style={styles.checkbox}
                                                                            />
                                                                            <span
                                                                                style={{
                                                                                    ...styles.checklistText,
                                                                                    ...(item.is_checked
                                                                                        ? styles.checklistChecked
                                                                                        : {}),
                                                                                }}
                                                                            >
                                                                                {item.text}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {task.due_date && (
                                                                <div style={styles.fullDateSection}>
                                                                    <Calendar size={14} color="#8b949e" />
                                                                    <span style={styles.fullDate}>
                                                                        {formatDate(task.due_date)}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {task.is_recurring && (
                                                                <div style={styles.recurringBadge}>
                                                                    🔄 Repeats {task.recurring_interval} ({task.recurring_type})
                                                                </div>
                                                            )}

                                                            {/* Action Buttons */}
                                                            <div style={styles.actionButtons}>
                                                                <button
                                                                    onClick={() => toggleComplete(task)}
                                                                    style={styles.actionButton}
                                                                >
                                                                    <Check size={16} />
                                                                    {task.is_completed ? 'Uncomplete' : 'Complete'}
                                                                </button>
                                                                <button
                                                                    onClick={() => openModal(task)}
                                                                    style={styles.actionButton}
                                                                >
                                                                    <Edit2 size={16} /> Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteTask(task.id)}
                                                                    style={styles.actionButtonDanger}
                                                                >
                                                                    <Trash2 size={16} /> Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                ) : (
                    <div style={styles.emptyState}>
                        <p style={styles.emptyText}>
                            {searchQuery
                                ? 'No tasks found'
                                : activeTab === 'completed'
                                    ? 'No completed tasks yet'
                                    : 'No tasks yet. Create one to get started!'}
                        </p>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {showSettingsModal && (
                <div style={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>⚙️ Settings</h2>
                            <button onClick={() => setShowSettingsModal(false)} style={styles.closeButton}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <h3 style={styles.sectionSubtitle}>🔔 Notifications</h3>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={notificationsEnabled && notificationPermission === 'granted'}
                                        onChange={(e) => {
                                            if (e.target.checked && notificationPermission === 'default') {
                                                requestNotificationPermission();
                                            } else if (e.target.checked && notificationPermission === 'denied') {
                                                alert('❌ Notifications are blocked. Enable them in your browser settings.');
                                            } else {
                                                setNotificationsEnabled(e.target.checked);
                                            }
                                        }}
                                        style={styles.checkbox}
                                        disabled={notificationPermission === 'denied'}
                                    />
                                    <span style={{ marginLeft: '8px' }}>
                                        Enable notifications
                                        {notificationPermission === 'denied' && ' (blocked in browser)'}
                                    </span>
                                </label>
                            </div>

                            {notificationsEnabled && notificationPermission === 'granted' && (
                                <div style={{ marginTop: '16px' }}>
                                    <h4 style={{ ...styles.label, marginTop: '16px' }}>Reminder Times</h4>

                                    <label style={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={notifDayBefore}
                                            onChange={(e) => setNotifDayBefore(e.target.checked)}
                                            style={styles.checkbox}
                                        />
                                        <span style={{ marginLeft: '8px' }}>Day before at 9 AM</span>
                                    </label>

                                    <label style={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={notifDayOf}
                                            onChange={(e) => setNotifDayOf(e.target.checked)}
                                            style={styles.checkbox}
                                        />
                                        <span style={{ marginLeft: '8px' }}>Day of at 9 AM</span>
                                    </label>

                                    <label style={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={notifTwoHours}
                                            onChange={(e) => setNotifTwoHours(e.target.checked)}
                                            style={styles.checkbox}
                                        />
                                        <span style={{ marginLeft: '8px' }}>2 hours before due time</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div style={styles.modalFooter}>
                            <button onClick={() => setShowSettingsModal(false)} style={styles.saveButton}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Task Modal */}
            {showEditModal && (
                <div style={styles.modalOverlay} onClick={closeModal}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>
                                {editingTask ? 'Edit Task' : 'New Task'}
                            </h2>
                            <button onClick={closeModal} style={styles.closeButton}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <input
                                type="text"
                                placeholder="Task title"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                style={styles.input}
                                autoFocus
                            />

                            <textarea
                                placeholder="Description (optional)"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                style={styles.textarea}
                                rows={4}
                            />

                            <div style={styles.formGroup}>
                                <label style={styles.label}>Due Date</label>
                                <input
                                    type="datetime-local"
                                    value={formDueDate}
                                    onChange={(e) => setFormDueDate(e.target.value)}
                                    style={styles.input}
                                />
                            </div>

                            <label style={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formIsPinned}
                                    onChange={(e) => setFormIsPinned(e.target.checked)}
                                    style={styles.checkbox}
                                />
                                <span style={{ marginLeft: '8px' }}>📌 Pin to top</span>
                            </label>

                            <div style={styles.recurringSection}>
                                <h3 style={styles.sectionSubtitle}>🔄 Recurring Task</h3>
                                <label style={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={formIsRecurring}
                                        onChange={(e) => setFormIsRecurring(e.target.checked)}
                                        style={styles.checkbox}
                                    />
                                    <span style={{ marginLeft: '8px' }}>Make this a recurring task</span>
                                </label>

                                {formIsRecurring && (
                                    <>
                                        <div style={styles.formGroup}>
                                            <label style={styles.label}>Recurring Type</label>
                                            <select
                                                value={formRecurringType}
                                                onChange={(e) => setFormRecurringType(e.target.value)}
                                                style={styles.input}
                                            >
                                                <option value="simple">Simple (same task repeats)</option>
                                                <option value="progressive">Progressive (task number increments)</option>
                                            </select>
                                        </div>

                                        <div style={styles.formGroup}>
                                            <label style={styles.label}>Repeat Every</label>
                                            <select
                                                value={formRecurringInterval}
                                                onChange={(e) => setFormRecurringInterval(e.target.value)}
                                                style={styles.input}
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        </div>

                                        {formRecurringType === 'progressive' && (
                                            <p style={styles.helpText}>
                                                💡 Progressive tasks increment the number in the title when completed (e.g., "Task 1" → "Task 2")
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={styles.checklistEditSection}>
                                <h3 style={styles.sectionSubtitle}>Checklist</h3>
                                {formChecklist.map((item, index) => (
                                    <div key={item.id} style={styles.checklistEditItem}>
                                        <input
                                            type="checkbox"
                                            checked={item.is_checked}
                                            onChange={() => toggleChecklistItem(index)}
                                            style={styles.checkbox}
                                        />
                                        <span style={styles.checklistText}>{item.text}</span>
                                        <button
                                            onClick={() => removeChecklistItem(index)}
                                            style={styles.removeButton}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                <div style={styles.addChecklistContainer}>
                                    <input
                                        type="text"
                                        placeholder="Add checklist item"
                                        value={newChecklistText}
                                        onChange={(e) => setNewChecklistText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                                        style={styles.input}
                                    />
                                    <button onClick={addChecklistItem} style={styles.addChecklistButton}>
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={styles.modalFooter}>
                            <button onClick={closeModal} style={styles.cancelButton}>
                                Cancel
                            </button>
                            <button onClick={saveTask} style={styles.saveButton}>
                                {editingTask ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Description Editor Modal */}
            {showDescModal && (
                <div style={styles.modalOverlay} onClick={() => setShowDescModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>Edit Description</h2>
                            <button onClick={() => setShowDescModal(false)} style={styles.closeButton}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={styles.modalBody}>
                            <textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                style={styles.textareaLarge}
                                rows={15}
                                autoFocus
                                placeholder="Enter task description..."
                            />
                        </div>

                        <div style={styles.modalFooter}>
                            <button
                                onClick={() => setShowDescModal(false)}
                                style={styles.cancelButton}
                            >
                                Cancel
                            </button>
                            <button onClick={saveDescription} style={styles.saveButton}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        paddingBottom: '80px',
    },
    authCard: {
        maxWidth: '400px',
        margin: '100px auto 0',
        padding: '32px',
        backgroundColor: '#161b22',
        borderRadius: '12px',
        border: '1px solid #30363d',
    },
    authTitle: {
        fontSize: '32px',
        marginBottom: '8px',
        textAlign: 'center',
    },
    authSubtitle: {
        fontSize: '14px',
        color: '#8b949e',
        textAlign: 'center',
        marginBottom: '24px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        borderBottom: '1px solid #30363d',
        position: 'sticky',
        top: 0,
        backgroundColor: '#0d1117',
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    },
    headerTitle: {
        fontSize: '24px',
        margin: 0,
    },
    headerButtons: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    settingsButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        backgroundColor: '#21262d',
        color: '#c9d1d9',
        border: '1px solid #30363d',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    notifButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        backgroundColor: '#58a6ff',
        color: '#0d1117',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
    },
    addButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        backgroundColor: '#238636',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
    },
    signOutButton: {
        padding: '8px 16px',
        backgroundColor: '#21262d',
        color: '#c9d1d9',
        border: '1px solid #30363d',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    searchContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: '#161b22',
        margin: '16px',
        borderRadius: '6px',
        border: '1px solid #30363d',
    },
    searchInput: {
        flex: 1,
        backgroundColor: 'transparent',
        border: 'none',
        color: '#c9d1d9',
        fontSize: '14px',
        outline: 'none',
    },
    tabs: {
        display: 'flex',
        gap: '8px',
        padding: '0 16px',
        marginBottom: '16px',
        overflowX: 'auto',
    },
    tab: {
        padding: '8px 16px',
        backgroundColor: '#21262d',
        color: '#8b949e',
        border: '1px solid #30363d',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        whiteSpace: 'nowrap',
    },
    tabActive: {
        padding: '8px 16px',
        backgroundColor: '#58a6ff',
        color: '#0d1117',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
    },
    content: {
        padding: '0 16px',
    },
    pinnedSection: {
        marginBottom: '24px',
    },
    sectionTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#8b949e',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    pinnedGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '12px',
    },
    pinnedCard: {
        padding: '12px',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    pinnedTitle: {
        fontSize: '14px',
        fontWeight: 500,
        marginBottom: '8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
    },
    pinnedDate: {
        fontSize: '12px',
        color: '#8b949e',
    },
    expandedPinnedSection: {
        marginTop: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    expandedPinnedCard: {
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    expandedPinnedHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        cursor: 'pointer',
        backgroundColor: '#1c2128',
    },
    taskList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    taskCard: {
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
    },
    taskOverdue: {
        border: '2px solid #f85149',
    },
    taskDragging: {
        opacity: 0.8,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    },
    taskHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        cursor: 'pointer',
        userSelect: 'none',
    },
    dragHandle: {
        cursor: 'grab',
        padding: '4px',
    },
    taskTitle: {
        flex: 1,
        fontSize: '16px',
        fontWeight: 500,
    },
    dueDateBadge: {
        fontSize: '12px',
        padding: '4px 8px',
        backgroundColor: '#21262d',
        borderRadius: '4px',
        color: '#8b949e',
        whiteSpace: 'nowrap',
    },
    taskExpanded: {
        padding: '0 16px 16px 16px',
        borderTop: '1px solid #30363d',
    },
    descriptionSection: {
        marginTop: '12px',
        marginBottom: '12px',
    },
    description: {
        fontSize: '14px',
        color: '#8b949e',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        marginBottom: '8px',
    },
    editDescButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        fontSize: '12px',
        backgroundColor: '#21262d',
        color: '#8b949e',
        border: '1px solid #30363d',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    checklistSection: {
        marginTop: '12px',
        marginBottom: '12px',
    },
    checklistItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 0',
    },
    checkbox: {
        width: '18px',
        height: '18px',
        cursor: 'pointer',
    },
    checklistText: {
        fontSize: '14px',
        flex: 1,
    },
    checklistChecked: {
        textDecoration: 'line-through',
        color: '#8b949e',
    },
    fullDateSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '12px',
        fontSize: '13px',
        color: '#8b949e',
    },
    fullDate: {
        fontSize: '13px',
    },
    recurringBadge: {
        display: 'inline-block',
        fontSize: '12px',
        padding: '4px 8px',
        backgroundColor: '#1f6feb',
        color: 'white',
        borderRadius: '4px',
        marginTop: '8px',
    },
    actionButtons: {
        display: 'flex',
        gap: '8px',
        marginTop: '16px',
        flexWrap: 'wrap',
    },
    actionButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        fontSize: '13px',
        backgroundColor: '#21262d',
        color: '#c9d1d9',
        border: '1px solid #30363d',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    actionButtonDanger: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        fontSize: '13px',
        backgroundColor: '#21262d',
        color: '#f85149',
        border: '1px solid #30363d',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
    },
    emptyText: {
        fontSize: '16px',
        color: '#8b949e',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
    },
    modal: {
        backgroundColor: '#161b22',
        borderRadius: '12px',
        border: '1px solid #30363d',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid #30363d',
    },
    modalTitle: {
        fontSize: '20px',
        margin: 0,
    },
    closeButton: {
        background: 'none',
        border: 'none',
        color: '#8b949e',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
    },
    modalBody: {
        padding: '20px',
        overflowY: 'auto',
        flex: 1,
    },
    modalFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        padding: '20px',
        borderTop: '1px solid #30363d',
    },
    input: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '6px',
        color: '#c9d1d9',
        fontSize: '14px',
        marginBottom: '12px',
    },
    textarea: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '6px',
        color: '#c9d1d9',
        fontSize: '14px',
        fontFamily: 'inherit',
        resize: 'vertical',
        marginBottom: '12px',
    },
    textareaLarge: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '6px',
        color: '#c9d1d9',
        fontSize: '14px',
        fontFamily: 'inherit',
        resize: 'vertical',
        minHeight: '300px',
    },
    formGroup: {
        marginBottom: '12px',
    },
    label: {
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        marginBottom: '6px',
        color: '#8b949e',
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '14px',
        marginBottom: '16px',
        cursor: 'pointer',
    },
    recurringSection: {
        marginTop: '20px',
        padding: '16px',
        backgroundColor: '#0d1117',
        borderRadius: '6px',
        border: '1px solid #30363d',
    },
    checklistEditSection: {
        marginTop: '20px',
    },
    sectionSubtitle: {
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '12px',
        color: '#c9d1d9',
    },
    checklistEditItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        backgroundColor: '#0d1117',
        borderRadius: '6px',
        marginBottom: '8px',
    },
    removeButton: {
        background: 'none',
        border: 'none',
        color: '#f85149',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
    },
    addChecklistContainer: {
        display: 'flex',
        gap: '8px',
        marginTop: '12px',
    },
    addChecklistButton: {
        padding: '12px',
        backgroundColor: '#238636',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#238636',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        marginBottom: '12px',
    },
    linkButton: {
        width: '100%',
        padding: '12px',
        backgroundColor: 'transparent',
        color: '#58a6ff',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
    },
    error: {
        color: '#f85149',
        fontSize: '13px',
        marginBottom: '12px',
    },
    helpText: {
        fontSize: '13px',
        color: '#8b949e',
        lineHeight: '1.5',
        marginTop: '8px',
    },
    cancelButton: {
        padding: '10px 20px',
        backgroundColor: '#21262d',
        color: '#c9d1d9',
        border: '1px solid #30363d',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    saveButton: {
        padding: '10px 20px',
        backgroundColor: '#238636',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
    },
};