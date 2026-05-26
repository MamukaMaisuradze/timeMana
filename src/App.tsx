import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Trash2, 
  Sparkles, 
  TrendingUp, 
  Timer, 
  BookOpen, 
  Zap, 
  Activity, 
  Calendar, 
  Moon, 
  Sun, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Check, 
  Award,
  ChevronRight,
  User,
  Lightbulb,
  Search,
  X,
  ArrowUpDown,
  Download,
  Pencil,
  Flame,
  AlertTriangle,
  LogIn,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { Task, TimeLog, AIOptimizedPlan, CategoryType, CustomCategory } from './types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

// Initial Mock Tasks to make the app look complete and professional instantly
const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'დიზაინ სისტემის აუდიტი',
    category: 'work',
    priority: 'high',
    estimatedPomodoros: 3,
    completedPomodoros: 2,
    completed: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    notes: 'აუცილებელია ვებ და მობილური კომპონენტების ფერთა კონტრასტების შემოწმება.',
  },
  {
    id: 'task-2',
    title: 'მათემატიკის მომზადება',
    category: 'study',
    priority: 'high',
    estimatedPomodoros: 4,
    completedPomodoros: 4,
    completed: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    notes: 'მე-3 და მე-4 თავების სავარჯიშოების ამოხსნა.',
  },
  {
    id: 'task-3',
    title: 'კარდიო ვარჯიში და იოგა',
    category: 'health',
    priority: 'medium',
    estimatedPomodoros: 1,
    completedPomodoros: 1,
    completed: true,
    createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    notes: '20-წუთიანი გაწელვების და სუნთქვითი ვარჯიშების სესია.',
  },
  {
    id: 'task-4',
    title: 'კვირის ბიუჯეტის დაგეგმვა',
    category: 'personal',
    priority: 'low',
    estimatedPomodoros: 2,
    completedPomodoros: 0,
    completed: false,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    notes: 'შემოსავლებისა და გასავლის გაწერა მიმდინარე კვირისთვის.',
  },
];

const INITIAL_LOGS: TimeLog[] = [
  { id: 'log-1', category: 'study', durationMinutes: 100, timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: 'log-2', category: 'health', durationMinutes: 25, timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: 'log-3', category: 'work', durationMinutes: 50, timestamp: new Date().toISOString() },
];

const COLOR_MAP: Record<string, { badge: string; dot: string; label: string }> = {
  indigo: { badge: 'text-indigo-600 bg-indigo-50 border-indigo-100', dot: 'bg-indigo-500', label: 'ინდიგო' },
  amber: { badge: 'text-amber-600 bg-amber-50 border-amber-100', dot: 'bg-amber-500', label: 'ქარვა' },
  emerald: { badge: 'text-emerald-600 bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500', label: 'ზურმუხტი' },
  purple: { badge: 'text-purple-600 bg-purple-50 border-purple-100', dot: 'bg-purple-500', label: 'იასამანი' },
  sky: { badge: 'text-sky-600 bg-sky-50 border-sky-100', dot: 'bg-sky-500', label: 'ცისფერი' },
  rose: { badge: 'text-rose-600 bg-rose-50 border-rose-100', dot: 'bg-rose-500', label: 'ვარდისფერი' },
  teal: { badge: 'text-teal-600 bg-teal-50 border-teal-100', dot: 'bg-teal-500', label: 'ფირუზი' },
  orange: { badge: 'text-orange-600 bg-orange-50 border-orange-100', dot: 'bg-orange-500', label: 'ნარინჯისფერი' },
  pink: { badge: 'text-pink-600 bg-pink-50 border-pink-100', dot: 'bg-pink-500', label: 'მოვარდისფრო' },
  slate: { badge: 'text-slate-600 bg-slate-50 border-slate-100', dot: 'bg-slate-500', label: 'ნაცრისფერი' },
};

export default function App() {
  // Navigation: 'tasks' | 'timer' | 'analytics' | 'ai'
  const [activeTab, setActiveTab] = useState<'tasks' | 'timer' | 'analytics' | 'ai'>('tasks');

  // Local theme state ('light' | 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('timeflow_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Apply theme class to document
  useEffect(() => {
    localStorage.setItem('timeflow_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Firebase Auth states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // State
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('timeflow_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });
  const [logs, setLogs] = useState<TimeLog[]>(() => {
    const saved = localStorage.getItem('timeflow_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('timeflow_user') || 'ანა';
  });
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(username);

  // Task creation state
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryType>('work');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newEstimated, setNewEstimated] = useState(2);
  const [showAddModal, setShowAddModal] = useState(false);
  const [taskFilter, setTaskFilter] = useState<CategoryType | 'all'>('all');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [sortByPriority, setSortByPriority] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  // Task editing state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState<CategoryType>('work');
  const [editPriority, setEditPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editEstimated, setEditEstimated] = useState(2);

  // Custom task categories
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => {
    const saved = localStorage.getItem('timeflow_custom_categories');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('indigo');
  const [catError, setCatError] = useState<string | null>(null);

  // Timer State
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(tasks[0]?.id || undefined);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // AI Optimization input state
  const [energyLevel, setEnergyLevel] = useState<'high' | 'medium' | 'low'>('medium');
  const [wakeupTime, setWakeupTime] = useState('08:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [extraContext, setExtraContext] = useState('');
  const [aiPlan, setAiPlan] = useState<AIOptimizedPlan | null>(() => {
    const saved = localStorage.getItem('timeflow_ai_plan');
    return saved ? JSON.parse(saved) : null;
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Interval Refs
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio elements (synthesized via Web Audio API so no missing local asset issues arise)
  const playBeep = (freq: number, duration: number) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  // Backup of local guest states to migrate on login
  const localTasksRef = useRef<Task[]>([]);
  const localLogsRef = useRef<TimeLog[]>([]);
  const localCatsRef = useRef<CustomCategory[]>([]);
  const localAiPlanRef = useRef<AIOptimizedPlan | null>(null);

  useEffect(() => {
    if (!user) {
      localTasksRef.current = tasks;
    }
  }, [tasks, user]);

  useEffect(() => {
    if (!user) {
      localLogsRef.current = logs;
    }
  }, [logs, user]);

  useEffect(() => {
    if (!user) {
      localCatsRef.current = customCategories;
    }
  }, [customCategories, user]);

  useEffect(() => {
    if (!user) {
      localAiPlanRef.current = aiPlan;
    }
  }, [aiPlan, user]);

  // Firebase Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setUsername(firebaseUser.displayName || firebaseUser.email || 'მომხმარებელი');
      } else {
        const savedUser = localStorage.getItem('timeflow_user') || 'ანა';
        setUsername(savedUser);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Firebase Realtime Firestore Sync
  useEffect(() => {
    if (!user) return;

    // Sync Tasks
    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const unsubTasks = onSnapshot(tasksRef, (snapshot) => {
      const dbTasks: Task[] = [];
      snapshot.forEach((doc) => {
        dbTasks.push(doc.data() as Task);
      });
      dbTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Seed Firestore with local tasks if Firestore is empty and local tasks exist
      if (dbTasks.length === 0 && localTasksRef.current.length > 0) {
        localTasksRef.current.forEach(task => {
          setDoc(doc(db, 'users', user.uid, 'tasks', task.id), task).catch(e => {
            handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/tasks/${task.id}`);
          });
        });
      } else {
        setTasks(dbTasks);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`);
    });

    // Sync Focus Logs
    const logsRef = collection(db, 'users', user.uid, 'logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const dbLogs: TimeLog[] = [];
      snapshot.forEach((doc) => {
        dbLogs.push(doc.data() as TimeLog);
      });
      dbLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (dbLogs.length === 0 && localLogsRef.current.length > 0) {
        localLogsRef.current.forEach(log => {
          setDoc(doc(db, 'users', user.uid, 'logs', log.id), log).catch(e => {
            handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/logs/${log.id}`);
          });
        });
      } else {
        setLogs(dbLogs);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/logs`);
    });

    // Sync Custom Categories
    const catsRef = collection(db, 'users', user.uid, 'custom_categories');
    const unsubCats = onSnapshot(catsRef, (snapshot) => {
      const dbCats: CustomCategory[] = [];
      snapshot.forEach((doc) => {
        dbCats.push(doc.data() as CustomCategory);
      });

      if (dbCats.length === 0 && localCatsRef.current.length > 0) {
        localCatsRef.current.forEach(cat => {
          setDoc(doc(db, 'users', user.uid, 'custom_categories', cat.id), cat).catch(e => {
            handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/custom_categories/${cat.id}`);
          });
        });
      } else {
        setCustomCategories(dbCats);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/custom_categories`);
    });

    // Sync AI Plan
    const aiPlanDocRef = doc(db, 'users', user.uid, 'ai_plan', 'plan');
    const unsubAiPlan = onSnapshot(aiPlanDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setAiPlan(docSnapshot.data() as AIOptimizedPlan);
      } else if (localAiPlanRef.current) {
        setDoc(aiPlanDocRef, localAiPlanRef.current).catch(e => {
          handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/ai_plan/plan`);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/ai_plan/plan`);
    });

    return () => {
      unsubTasks();
      unsubLogs();
      unsubCats();
      unsubAiPlan();
    };
  }, [user]);

  // Sync to local storage (Only when guest/offline)
  useEffect(() => {
    if (!user) {
      localStorage.setItem('timeflow_tasks', JSON.stringify(tasks));
    }
  }, [tasks, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('timeflow_logs', JSON.stringify(logs));
    }
  }, [logs, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('timeflow_user', username);
    }
  }, [username, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem('timeflow_custom_categories', JSON.stringify(customCategories));
    }
  }, [customCategories, user]);

  useEffect(() => {
    if (!user) {
      if (aiPlan) {
        localStorage.setItem('timeflow_ai_plan', JSON.stringify(aiPlan));
      } else {
        localStorage.removeItem('timeflow_ai_plan');
      }
    }
  }, [aiPlan, user]);

  // Auto-Archive Tasks if they have been completed for >= 24 hours
  useEffect(() => {
    let changed = false;
    const now = Date.now();
    const updatedTasks = tasks.map(t => {
      if (t.completed && !t.archived) {
        const completedTime = t.completedAt ? new Date(t.completedAt).getTime() : new Date(t.createdAt).getTime();
        if (now - completedTime >= 86400000) {
          changed = true;
          return { ...t, archived: true };
        }
      }
      return t;
    });

    if (changed) {
      setTasks(updatedTasks);
    }
  }, [tasks]);

  // Timer Tick
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning, timerMode]);

  // Handle mode transitions
  const handleTimerComplete = async () => {
    setTimerRunning(false);
    playBeep(timerMode === 'work' ? 880 : 660, 0.8);

    if (timerMode === 'work') {
      // Log active duration
      const loggedMinutes = 25;
      const associatedTask = tasks.find(t => t.id === selectedTaskId);
      
      const newLog: TimeLog = {
        id: 'log-' + Date.now(),
        taskId: selectedTaskId,
        taskTitle: associatedTask?.title,
        category: associatedTask?.category || 'work',
        durationMinutes: loggedMinutes,
        timestamp: new Date().toISOString()
      };

      if (user) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'logs', newLog.id), newLog);
          if (selectedTaskId) {
            const t = tasks.find(item => item.id === selectedTaskId);
            if (t) {
              const updatedCompleted = t.completedPomodoros + 1;
              const isCompletedNow = updatedCompleted >= t.estimatedPomodoros;
              const updated = {
                ...t,
                completedPomodoros: updatedCompleted,
                completed: t.completed || isCompletedNow,
                completedAt: (t.completed || isCompletedNow) ? (t.completedAt || new Date().toISOString()) : undefined
              };
              await setDoc(doc(db, 'users', user.uid, 'tasks', selectedTaskId), updated);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/logs/${newLog.id}`);
        }
      } else {
        setLogs(prev => [newLog, ...prev]);

        // Increment completed pomodoros for that task
        if (selectedTaskId) {
          setTasks(prev => prev.map(t => {
            if (t.id === selectedTaskId) {
              const updatedCompleted = t.completedPomodoros + 1;
              const isCompletedNow = updatedCompleted >= t.estimatedPomodoros;
              return {
                ...t,
                completedPomodoros: updatedCompleted,
                completed: t.completed || isCompletedNow,
                completedAt: (t.completed || isCompletedNow) ? (t.completedAt || new Date().toISOString()) : undefined
              };
            }
            return t;
          }));
        }
      }

      // Switch to break
      setTimerMode('break');
      setTimeLeft(5 * 60); // 5 minutes standard break
    } else {
      // Switch back to work
      setTimerMode('work');
      setTimeLeft(25 * 60);
    }
  };

  // Operations
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: Task = {
      id: 'task-' + Date.now(),
      title: newTitle.trim(),
      category: newCategory,
      priority: newPriority,
      estimatedPomodoros: Number(newEstimated),
      completedPomodoros: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      notes: newNotes.trim() || undefined,
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'tasks', newTask.id), newTask);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/tasks/${newTask.id}`);
      }
    } else {
      setTasks(prev => [newTask, ...prev]);
    }
    
    if (!selectedTaskId) setSelectedTaskId(newTask.id);

    // Reset input states
    setNewTitle('');
    setNewNotes('');
    setNewCategory('work');
    setNewPriority('medium');
    setNewEstimated(2);
    setShowAddModal(false);
    playBeep(523.25, 0.15); // visual success click
  };

  const handleStartEdit = (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setEditTitle(task.title);
    setEditNotes(task.notes || '');
    setEditCategory(task.category);
    setEditPriority(task.priority);
    setEditEstimated(task.estimatedPomodoros);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    const updatedTask: Task = {
      ...editingTask,
      title: editTitle.trim(),
      notes: editNotes.trim() || undefined,
      category: editCategory,
      priority: editPriority,
      estimatedPomodoros: Number(editEstimated),
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id), updatedTask);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/tasks/${editingTask.id}`);
      }
    } else {
      setTasks(prev => prev.map(t => {
        if (t.id === editingTask.id) {
          return updatedTask;
        }
        return t;
      }));
    }

    setEditingTask(null);
    playBeep(523.25, 0.15); // visual success click
  };

  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/tasks/${id}`);
      }
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }

    if (selectedTaskId === id) {
      setSelectedTaskId(undefined);
    }
  };

  const handleRestoreTask = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (user) {
      const existingTask = tasks.find(t => t.id === id);
      if (existingTask) {
        const repr: Task = {
          ...existingTask,
          archived: false,
          completed: false,
          completedAt: undefined
        };
        try {
          await setDoc(doc(db, 'users', user.uid, 'tasks', id), repr);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/tasks/${id}`);
        }
      }
    } else {
      setTasks(prev => prev.map(t => {
        if (t.id === id) {
          return { 
            ...t, 
            archived: false, 
            completed: false, 
            completedAt: undefined 
          };
        }
        return t;
      }));
    }
    playBeep(440, 0.1);
  };

  const getFocusStreak = (logsList: TimeLog[]): number => {
    if (!logsList || logsList.length === 0) return 0;

    const getLocalDateString = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getLocalDateString(new Date());
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterdayDate);

    // Parse all log timestamps to local YYYY-MM-DD
    const loggedDates = new Set<string>();
    logsList.forEach(log => {
      if (log.timestamp) {
        const d = new Date(log.timestamp);
        if (!isNaN(d.getTime())) {
          loggedDates.add(getLocalDateString(d));
        }
      }
    });

    // If no log today and no log yesterday, streak is 0
    if (!loggedDates.has(todayStr) && !loggedDates.has(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    const current = loggedDates.has(todayStr) ? new Date() : yesterdayDate;

    while (true) {
      const currentStr = getLocalDateString(current);
      if (loggedDates.has(currentStr)) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const toggleTaskCompletion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (user) {
      const existingTask = tasks.find(t => t.id === id);
      if (existingTask) {
        const nextState = !existingTask.completed;
        if (nextState) {
          playBeep(659.25, 0.12);
        }
        const repr: Task = {
          ...existingTask,
          completed: nextState,
          completedAt: nextState ? new Date().toISOString() : undefined,
          archived: nextState ? existingTask.archived : false,
          completedPomodoros: nextState ? Math.max(existingTask.estimatedPomodoros, existingTask.completedPomodoros) : existingTask.completedPomodoros
        };
        try {
          await setDoc(doc(db, 'users', user.uid, 'tasks', id), repr);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/tasks/${id}`);
        }
      }
    } else {
      setTasks(prev => prev.map(t => {
        if (t.id === id) {
          const nextState = !t.completed;
          if (nextState) {
            playBeep(659.25, 0.12);
          }
          return { 
            ...t, 
            completed: nextState,
            completedAt: nextState ? new Date().toISOString() : undefined,
            archived: nextState ? t.archived : false, // Reset archived state if they uncomplete a task
            completedPomodoros: nextState ? Math.max(t.estimatedPomodoros, t.completedPomodoros) : t.completedPomodoros
          };
        }
        return t;
      }));
    }
  };

  const startStopTimer = () => {
    setTimerRunning(!timerRunning);
    playBeep(440, 0.1);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimeLeft(timerMode === 'work' ? 25 * 60 : 5 * 60);
    playBeep(330, 0.1);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    if (!newCatName.trim()) {
      setCatError('მიუთითეთ კატეგორიის სახელი');
      return;
    }
    
    const normalizedNewName = newCatName.trim().toLowerCase();
    const isPredefinedConflict = ['სამსახური', 'სწავლა', 'ჯანმრთელობა', 'პირადი', 'დასვენება'].some(
      n => n.toLowerCase() === normalizedNewName
    ) || ['work', 'study', 'health', 'personal', 'rest'].some(
      id => id === normalizedNewName
    );
    const isCustomConflict = customCategories.some(
      c => c.name.trim().toLowerCase() === normalizedNewName
    );
    
    if (isPredefinedConflict || isCustomConflict) {
      setCatError('სახელი უკვე გამოყენებულია');
      return;
    }

    const newCategory: CustomCategory = {
      id: `custom-${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'custom_categories', newCategory.id), newCategory);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/custom_categories/${newCategory.id}`);
      }
    } else {
      setCustomCategories(prev => [...prev, newCategory]);
    }

    setNewCatName('');
    playBeep(440, 0.1);
  };

  const handleDeleteCategory = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'custom_categories', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/custom_categories/${id}`);
      }
    } else {
      setCustomCategories(prev => prev.filter(c => c.id !== id));
    }
    
    if (taskFilter === id) {
      setTaskFilter('all');
    }
    if (newCategory === id) {
      setNewCategory('work');
    }
    
    playBeep(220, 0.15);
  };

  const handleDownloadBackup = () => {
    const backupData = {
      username,
      tasks,
      logs,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    playBeep(523.25, 0.15);
  };

  // Fetch AI schedule optimization with error treatment and user context injection
  const handleOptimizeWithAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/optimize-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: tasks.filter(t => !t.completed),
          energyLevel,
          wakeupTime,
          sleepTime,
          extraContext
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.messageGeorgian || data.message || 'ოპტიმიზაციის მოთხოვნა ჩავარდა');
      }

      setAiPlan(data);
      if (user) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'ai_plan', 'plan'), data);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/ai_plan/plan`);
        }
      }
      playBeep(587.33, 0.4); // Successful tune
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'დაკავშირების შეცდომა. გთხოვთ, შეამოწმოთ სერვერი ან API გასაღები.');
    } finally {
      setAiLoading(false);
    }
  };

  // Quick statistics
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  
  const totalFocusMinutes = logs.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  const totalCompletedCycles = Math.round(totalFocusMinutes / 25);

  // Focus minutes for each day of the current week (Monday-Sunday)
  const getWeeklyChartData = (logsList: TimeLog[]) => {
    const daysOfWeekGe = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    return weekDays.map((date, index) => {
      const dateString = date.toDateString();
      const dailySum = logsList.reduce((acc, log) => {
        const logDate = new Date(log.timestamp);
        if (logDate.toDateString() === dateString) {
          return acc + log.durationMinutes;
        }
        return acc;
      }, 0);

      return {
        day: daysOfWeekGe[index],
        minutes: dailySum,
        dateFormatted: `${date.getMonth() + 1}/${date.getDate()}`
      };
    });
  };

  const weeklyChartData = getWeeklyChartData(logs);

  const getCategoryColorColor = (cat: CategoryType) => {
    const custom = customCategories.find(c => c.id === cat);
    if (custom) {
      const col = custom.color.toLowerCase();
      return COLOR_MAP[col]?.badge || COLOR_MAP.slate.badge;
    }
    switch (cat) {
      case 'work': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case 'study': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'health': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'personal': return 'text-purple-600 bg-purple-50 border-purple-100';
      case 'rest': return 'text-sky-600 bg-sky-50 border-sky-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const getCategoryDotColor = (cat: CategoryType) => {
    const custom = customCategories.find(c => c.id === cat);
    if (custom) {
      const col = custom.color.toLowerCase();
      return COLOR_MAP[col]?.dot || COLOR_MAP.slate.dot;
    }
    switch (cat) {
      case 'work': return 'bg-indigo-500';
      case 'study': return 'bg-amber-500';
      case 'health': return 'bg-emerald-500';
      case 'personal': return 'bg-purple-500';
      case 'rest': return 'bg-sky-500';
      default: return 'bg-slate-500';
    }
  };

  const getCategoryLabel = (cat: CategoryType) => {
    const custom = customCategories.find(c => c.id === cat);
    if (custom) return custom.name;
    switch (cat) {
      case 'work': return 'სამსახური';
      case 'study': return 'სწავლა';
      case 'health': return 'ჯანმრთელობა';
      case 'personal': return 'პირადი';
      case 'rest': return 'დასვენება';
      default: return cat;
    }
  };

  // Group log durations for simple SVG category tracking chart
  const categoryDurations = logs.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.durationMinutes;
    return acc;
  }, {} as Record<CategoryType, number>);

  const sortedCategories = (Object.keys(categoryDurations) as CategoryType[]).sort(
    (a, b) => categoryDurations[b] - categoryDurations[a]
  );

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="app-container" className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center font-sans py-8 px-4 transition-colors duration-300">
      {/* 
        This is the Desktop Geometric Mockup Frame with structural balance layout 
        It integrates a live functional smartphone and custom-coded annotation block on the side.
      */}
      <div className="w-full max-w-[1020px] bg-slate-100 dark:bg-slate-950 flex flex-col md:flex-row items-center justify-center gap-12 font-sans overflow-visible transition-colors duration-300">
        
        {/* Device View Wrapper */}
        <div id="mobile-mockup" className="w-[360px] h-[720px] bg-white dark:bg-slate-900 rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] border-[8px] border-slate-900 dark:border-slate-800 relative overflow-hidden flex flex-col shrink-0 transition-colors duration-300">
          
          {/* Internal Status Bar */}
          <div className="px-8 pt-5 pb-1 flex justify-between items-center bg-white dark:bg-slate-900 z-20 transition-colors duration-300">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-display">17:05</span>
            <div className="flex space-x-1.5 items-center">
              <div className="w-4 h-4 rounded-full bg-slate-900 dark:bg-slate-800 flex items-center justify-center text-[8px] text-white dark:text-slate-200 font-black">⚙</div>
              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              </div>
            </div>
          </div>
 
          {/* Core Scroll Window Container */}
          <div className="flex-1 overflow-y-auto px-6 pt-3 pb-24 relative select-none bg-white dark:bg-slate-900 transition-colors duration-300" style={{ contentVisibility: 'auto' }}>
            
            {/* Dynamic Header */}
            <div className="mb-6">
              <div className="flex justify-between items-start">
                <div>
                  {editingName ? (
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={tempName} 
                        onChange={(e) => setTempName(e.target.value)}
                        className="text-xl font-black text-slate-900 dark:text-slate-100 border-b-2 border-indigo-600 dark:border-indigo-400 bg-transparent outline-none w-32 tracking-tight"
                        maxLength={12}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setUsername(tempName);
                            setEditingName(false);
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          setUsername(tempName);
                          setEditingName(false);
                        }} 
                        className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <h1 
                        className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight cursor-pointer hover:underline flex items-center gap-1"
                        onClick={() => {
                          setTempName(username);
                          setEditingName(true);
                        }}
                        title="სახელის შეცვლა"
                      >
                        გამარჯობა, {username}
                      </h1>
                    </div>
                  )}
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    დღეს {tasks.filter(t => !t.completed).length} აქტიური დავალება გაქვთ
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTheme(prev => prev === 'light' ? 'dark' : 'light');
                      playBeep(440, 0.1);
                    }}
                    className="p-2 text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-amber-400 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                    title={theme === 'dark' ? 'დღის რეჟიმი' : 'ღამის რეჟიმი'}
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  </button>

                  {loadingAuth ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 px-3 py-1.5 rounded-xl">
                      <RefreshCw size={12} className="animate-spin text-indigo-500" />
                      მოწმდება...
                    </div>
                  ) : user ? (
                    <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 p-1.5 pl-3 rounded-2xl transition-all duration-300">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">{username}</p>
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mt-0.5">სინქრონიზებული</p>
                      </div>
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={username} 
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-xl object-cover ring-2 ring-indigo-100 dark:ring-indigo-950" 
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
                          {username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            await signOut(auth);
                            playBeep(330, 0.2);
                          } catch (e) {
                            console.error("Sign out fail:", e);
                          }
                        }}
                        className="p-1 px-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition cursor-pointer"
                        title="გასვლა"
                      >
                        <LogOut size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        const provider = new GoogleAuthProvider();
                        try {
                          await signInWithPopup(auth, provider);
                          playBeep(523.25, 0.2);
                        } catch (e: any) {
                          console.error("Google sign in fail:", e);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-black rounded-xl shadow-sm hover:shadow transition-all duration-200 cursor-pointer"
                    >
                      <LogIn size={13} />
                      შესვლა
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* PROGRESS GEOMETRIC WIDGET */}
            <div className="mb-6">
              <div className="bg-slate-900 rounded-[28px] p-5 text-white relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">თქვენი პროგრესი</p>
                  <h2 className="text-3xl font-light mb-3">
                    {progressPercentage}% <span className="text-xs opacity-60 font-sans">დასრულდა</span>
                  </h2>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-400 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  
                  {/* Quick cycle stats */}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400">მიზანი:</span> <strong className="text-white">{completedTasksCount} / {totalTasksCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">ფოკუსი:</span> <strong className="text-white">{totalCompletedCycles} სესია</strong>
                    </div>
                  </div>
                </div>
                {/* Background Art Deco Geometric Shapes for theme fidelity */}
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500 rounded-full opacity-20 transition-transform hover:scale-110"></div>
                <div className="absolute right-6 -bottom-6 w-16 h-16 border-4 border-indigo-400 rounded-full opacity-10"></div>
              </div>
            </div>

            {/* TAB VIEWS */}

            {/* 1. TASKS TAB VIEW */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">დავალებების გეგმა</h3>
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/80 transition"
                  >
                    <Plus size={14} /> ახალი
                  </button>
                </div>

                {/* Summary / Stats Bar */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100/85 dark:border-slate-800/60 rounded-2xl p-3 shadow-inner">
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/25 rounded-xl text-rose-500 shrink-0">
                      <AlertTriangle size={15} />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider leading-none">მაღალი პრიორიტეტი</p>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1 leading-none font-sans">
                        {tasks.filter(t => t.priority === 'high' && !t.completed).length} დარჩენილი
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100/85 dark:border-slate-800/60 rounded-2xl p-3 shadow-inner">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/25 rounded-xl text-amber-500 shrink-0">
                      <Flame size={15} className="animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider leading-none">ფოკუსის სერია</p>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-1 leading-none font-sans">
                        {getFocusStreak(logs)} დღე
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Categories filtering tab bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex gap-1 overflow-x-auto pb-1 -mx-2 px-2 no-scrollbar">
                    {['all', 'work', 'study', 'health', 'personal', 'rest', ...customCategories.map(c => c.id)].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setTaskFilter(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                          taskFilter === cat 
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cat === 'all' ? 'ყველა' : getCategoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => {
                      setCatError(null);
                      setShowCategoryManager(true);
                    }}
                    className="p-1 px-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    title="კატეგორიების მართვა"
                  >
                    <Plus size={10} className="text-indigo-600" />
                    <span>მართვა</span>
                  </button>
                </div>

                {/* Search & Sort Row */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      placeholder="ძებნა სათაურით..."
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/60 focus:border-indigo-500 rounded-xl py-2.5 pl-9 pr-8 text-xs outline-none transition font-sans text-slate-800 dark:text-slate-150 placeholder:text-slate-400 shadow-inner"
                    />
                    {taskSearchQuery && (
                      <button
                        onClick={() => setTaskSearchQuery('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setSortByPriority(!sortByPriority)}
                    className={`px-3.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold cursor-pointer transition whitespace-nowrap ${
                      sortByPriority 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="სორტირება პრიორიტეტით (მაღალი -> დაბალი)"
                  >
                    <ArrowUpDown size={13} className={sortByPriority ? 'text-white' : 'text-slate-400 dark:text-slate-500'} />
                    <span>სორტირება</span>
                  </button>
                </div>

                {/* Tasks List */}
                <div className="space-y-2.5">
                  {tasks.filter(t => {
                    if (t.archived) return false;
                    const matchesCategory = taskFilter === 'all' || t.category === taskFilter;
                    const matchesSearch = t.title.toLowerCase().includes(taskSearchQuery.trim().toLowerCase());
                    return matchesCategory && matchesSearch;
                  }).length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <Calendar className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={28} />
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {taskSearchQuery ? 'დავალებები ვერ მოიძებნა' : 'ამ კატეგორიაში დავალებები ჯერ არ არის'}
                      </p>
                    </div>
                  ) : (
                    tasks
                      .filter(t => {
                        if (t.archived) return false;
                        const matchesCategory = taskFilter === 'all' || t.category === taskFilter;
                        const matchesSearch = t.title.toLowerCase().includes(taskSearchQuery.trim().toLowerCase());
                        return matchesCategory && matchesSearch;
                      })
                      .sort((a, b) => {
                        if (sortByPriority) {
                          const priorityOrder = { high: 3, medium: 2, low: 1 };
                          const pA = priorityOrder[a.priority] || 0;
                          const pB = priorityOrder[b.priority] || 0;
                          if (pB !== pA) {
                            return pB - pA;
                          }
                        }
                        if (a.completed !== b.completed) {
                          return a.completed ? 1 : -1;
                        }
                        return 0;
                      })
                      .map((task) => {
                        const isMainActiveTimerTask = selectedTaskId === task.id;
                        return (
                          <div 
                            key={task.id}
                            className={`flex items-center p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                              isMainActiveTimerTask 
                                ? 'bg-indigo-50/20 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 shadow-sm' 
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/80 shadow-sm'
                            }`}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            {/* Complete Circle button */}
                            <button 
                              onClick={(e) => toggleTaskCompletion(task.id, e)}
                              className="mr-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            >
                              {task.completed ? (
                                <CheckCircle2 className="text-indigo-600 dark:text-indigo-400" size={20} />
                              ) : (
                                <Circle size={20} />
                              )}
                            </button>

                            {/* Task Content details */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm font-bold truncate ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                {task.title}
                              </h4>
                              
                              {task.notes && (
                                <p className={`text-[11px] font-normal leading-normal mt-0.5 text-slate-500 dark:text-slate-400 font-sans line-clamp-2 ${task.completed ? 'line-through text-slate-400 opacity-60' : ''}`}>
                                  {task.notes}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryColorColor(task.category)}`}>
                                  {getCategoryLabel(task.category)}
                                </span>
                                {task.priority === 'high' && (
                                  <span className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/60 font-bold px-1.5 py-0.5 rounded-md">
                                    მაღალი
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Pomodoros counter & delete */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center text-slate-500 dark:text-slate-400 text-xs">
                                <span className="font-mono text-xs font-bold mr-1 text-slate-700 dark:text-slate-300">
                                  {task.completedPomodoros}/{task.estimatedPomodoros}
                                </span>
                                <Timer size={12} className="opacity-70 text-indigo-500 dark:text-indigo-400" />
                              </div>

                              <button 
                                onClick={(e) => handleStartEdit(task, e)}
                                className="p-1 text-slate-300 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-amber-400 transition"
                                title="რედაქტირება"
                              >
                                <Pencil size={13} />
                              </button>

                              <button 
                                onClick={(e) => handleDeleteTask(task.id, e)}
                                className="p-1 text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition"
                                title="წაშლა"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                      );
                    })
                  )}
                </div>

                {/* Archived Tasks Accordion */}
                {tasks.some(t => t.archived) && (
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setShowArchive(!showArchive)}
                      className="flex items-center justify-between w-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    >
                      <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                        არქივი ({tasks.filter(t => t.archived).length})
                      </span>
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        {showArchive ? 'დამალვა' : 'ჩვენება'}
                      </span>
                    </button>

                    {showArchive && (
                      <div className="mt-3.5 space-y-2 max-h-48 overflow-y-auto pr-1 animate-fade-in">
                        {tasks
                          .filter(t => t.archived)
                          .map(task => (
                            <div key={task.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-100/70 dark:border-slate-800/60 rounded-2xl">
                              <div className="flex items-center gap-2">
                                <span className="line-through text-slate-400 dark:text-slate-500 text-xs font-medium">{task.title}</span>
                              </div>
                              <button
                                onClick={(e) => handleRestoreTask(task.id, e)}
                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
                              >
                                აღდგენა
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. TIMER TAB VIEW */}
            {activeTab === 'timer' && (
              <div className="space-y-6 flex flex-col items-center">
                {/* Circular Geometric Progress Timer */}
                <div className="relative w-52 h-52 flex items-center justify-center my-2">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    {/* Ring Path bg */}
                    <circle 
                      cx="104" 
                      cy="104" 
                      r="90" 
                      className="stroke-slate-100 dark:stroke-slate-800/80 fill-none"
                      strokeWidth="10" 
                    />
                    {/* Active Ring progress */}
                    <circle 
                      cx="104" 
                      cy="104" 
                      r="90" 
                      className={`fill-none transition-all duration-300 ${
                        timerMode === 'work' ? 'stroke-indigo-600' : 'stroke-rose-450'
                      }`}
                      strokeWidth="10" 
                      strokeDasharray={2 * Math.PI * 90}
                      strokeDashoffset={2 * Math.PI * 90 * (1 - timeLeft / (timerMode === 'work' ? 25 * 60 : 5 * 60))}
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Inside metrics */}
                  <div className="text-center z-10">
                    <span className="text-4xl font-black font-display text-slate-900 dark:text-slate-100 tracking-tight">
                      {formatTime(timeLeft)}
                    </span>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mt-1">
                      {timerMode === 'work' ? 'სამუშაო რეჟიმი' : 'განტვირთვა'}
                    </p>
                  </div>

                  {/* Background geometric flare dots */}
                  <div className="absolute right-4 top-4 w-4 h-4 bg-yellow-400 rounded-full opacity-60 animate-ring"></div>
                </div>

                {/* Active Tracking Status task selector */}
                <div className="w-full bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/80 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">მიმდინარე სამუშაო</p>
                  {selectedTaskId && tasks.find(t => t.id === selectedTaskId) ? (
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {tasks.find(t => t.id === selectedTaskId)?.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        კატეგორია: {getCategoryLabel(tasks.find(t => t.id === selectedTaskId)!.category)}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <select 
                        value={selectedTaskId || ''} 
                        onChange={(e) => setSelectedTaskId(e.target.value || undefined)}
                        className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-1 outline-none text-slate-705 text-slate-700 dark:text-slate-300 mx-auto animate-fade-in"
                      >
                        <option value="">-- აირჩიეთ დავალება --</option>
                        {tasks.filter(t => !t.completed).map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        აირჩიეთ შესასრულებელი დავალება პროგრესის დასათვლელად
                      </p>
                    </div>
                  )}
                </div>

                {/* Timer Control Keys */}
                <div className="flex gap-4 items-center">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    title={soundEnabled ? "ხმის გათიშვა" : "ხმის ჩართვა"}
                  >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>

                  <button
                    onClick={startStopTimer}
                    className={`h-14 w-14 rounded-full flex items-center justify-center text-white shadow-xl transition cursor-pointer hover:scale-105 active:scale-95 ${
                      timerRunning 
                        ? 'bg-slate-900 dark:bg-slate-100 dark:text-slate-950 shadow-slate-200 dark:shadow-none' 
                        : 'bg-indigo-600 dark:bg-indigo-500 shadow-indigo-100 dark:shadow-none'
                    }`}
                  >
                    {timerRunning ? <Pause size={24} className="text-white dark:text-slate-950" /> : <Play size={24} className="ml-1 text-white dark:text-slate-950" />}
                  </button>

                  <button
                    onClick={resetTimer}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="ხელახლა დაწყება"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* 3. ANALYTICS TAB VIEW */}
            {activeTab === 'analytics' && (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">
                    მიღწევები & ბალანსი
                  </h3>
                  <button
                    onClick={handleDownloadBackup}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-[11px] font-bold cursor-pointer"
                    title="მონაცემების ჩამოტვირთვა რეზერვისთვის (JSON)"
                  >
                    <Download size={12} className="text-indigo-600 dark:text-indigo-455" />
                    <span>ექსპორტი (JSON)</span>
                  </button>
                </div>

                {/* Scorecards grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3.5 shadow-sm text-center">
                    <Award className="mx-auto text-yellow-500 mb-1" size={24} />
                    <span className="text-2xl font-black font-display text-slate-900 dark:text-slate-100">
                      {totalCompletedCycles}
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase mt-0.5">სესიები</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3.5 shadow-sm text-center">
                    <TrendingUp className="mx-auto text-emerald-500 mb-1" size={24} />
                    <span className="text-2xl font-black font-display text-slate-900 dark:text-slate-100">
                      {getFocusStreak(logs)} დღე
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase mt-0.5">კონცენტრაცია</p>
                  </div>
                </div>

                {/* WEEKLY RECHARTS ACTIVITY BAR CHART */}
                <div className="bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center justify-between">
                    <span>კვირის აქტივობა</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">წუთები დღეების მიხედვით</span>
                  </h4>
                  <div className="w-full h-44 focus:outline-none">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="day" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <Tooltip 
                          cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 dark:bg-slate-950 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-lg border border-slate-850">
                                  <p>{payload[0].payload.dateFormatted}</p>
                                  <p className="text-indigo-300 dark:text-indigo-400">{payload[0].value} წუთი</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar 
                          dataKey="minutes" 
                          fill="#6366f1" 
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CUSTOM SVG GEOMETRIC CHARTS */}
                <div className="bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center justify-between">
                    <span>კატეგორიების განაწილება</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">საერთო დრო</span>
                  </h4>
                  
                  {sortedCategories.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400 dark:text-slate-500">უფრო მეტი ფოკუს სესიაა საჭირო გრაფიკისთვის</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedCategories.map(cat => {
                        const mins = categoryDurations[cat] || 0;
                        const valArray = Object.values(categoryDurations) as number[];
                        const totalMins = Math.max(...valArray, 1);
                        const widthPct = Math.round((mins / totalMins) * 100);

                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-700 dark:text-slate-200 font-medium font-sans">
                                {getCategoryLabel(cat)}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 font-bold font-sans">
                                {mins} წთ
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${getCategoryDotColor(cat)}`} 
                                style={{ width: `${widthPct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* History list Logs */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    აქტივობების ჟურნალი
                  </h4>

                  <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl text-xs border border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${getCategoryDotColor(log.category)}`}></span>
                          <span className="text-slate-800 dark:text-slate-100 font-semibold font-sans">
                            {log.taskTitle || `${getCategoryLabel(log.category)}-ის სესია`}
                          </span>
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 font-bold font-mono">
                          +{log.durationMinutes}წთ
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. AI SCHEDULER TAB VIEW */}
            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={18} />
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    AI დღის ოპტიმიზატორი
                  </h3>
                </div>

                {/* Parameters inputs */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-3.5 shadow-sm text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 font-sans">
                      მიმდინარე ენერგია
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['low', 'medium', 'high'] as const).map(lev => (
                        <button
                          key={lev}
                          type="button"
                          onClick={() => setEnergyLevel(lev)}
                          className={`py-1.5 px-1 rounded-lg font-bold border transition cursor-pointer ${
                            energyLevel === lev
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                          }`}
                        >
                          {lev === 'low' ? 'დაბალი' : lev === 'medium' ? 'საშუალო' : 'მაღალი'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 font-sans">
                        გაღვიძება
                      </label>
                      <input 
                        type="text" 
                        value={wakeupTime} 
                        onChange={(e) => setWakeupTime(e.target.value)}
                        placeholder="08:00"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-center font-bold text-slate-800 dark:text-slate-100 font-display focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 font-sans">
                        დაძინება
                      </label>
                      <input 
                        type="text" 
                        value={sleepTime} 
                        onChange={(e) => setSleepTime(e.target.value)}
                        placeholder="23:00"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-center font-bold text-slate-800 dark:text-slate-100 font-display focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 font-sans">
                      მიზანი ან შენიშვნა (სურვილისამებრ)
                    </label>
                    <textarea
                      placeholder="მაგ. დღეს მაქვს მნიშვნელოვანი ტესტი..."
                      value={extraContext}
                      onChange={(e) => setExtraContext(e.target.value)}
                      className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 resize-none outline-none focus:border-indigo-500 text-xs text-slate-705 text-slate-700 dark:text-slate-300 font-sans"
                    ></textarea>
                  </div>

                  <button
                    onClick={handleOptimizeWithAI}
                    disabled={aiLoading}
                    className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-black dark:hover:bg-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                  >
                    {aiLoading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-white dark:border-t-slate-950 animate-spin"></span>
                        გეგმავს...
                      </span>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-white dark:text-slate-950 animate-pulse" />
                        ოპტიმიზაცია AI-ით
                      </>
                    )}
                  </button>
                </div>

                {/* AI Error Display */}
                {aiError && (
                  <div className="p-3 bg-red-50 dark:bg-rose-950/20 border border-red-100 dark:border-rose-900/40 rounded-xl text-xs text-red-600 dark:text-red-400">
                    {aiError}
                  </div>
                )}

                {/* AI Plan Render Results */}
                {aiPlan && !aiLoading && (
                  <div className="space-y-4 pt-1 animate-fade-in">
                    
                    {/* Summary card */}
                    <div className="bg-indigo-600 dark:bg-indigo-700 rounded-2xl p-4 text-white shadow relative overflow-hidden">
                      <div className="relative z-10">
                        <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-1.5 font-sans">
                          ექსპერტის რეკომენდაცია
                        </h4>
                        <p className="text-xs leading-relaxed font-sans text-indigo-50">
                          {aiPlan.summary}
                        </p>
                      </div>
                      <div className="absolute right-0 bottom-0 w-24 h-24 bg-white/5 rounded-full transform translate-x-1/2 translate-y-1/2"></div>
                    </div>

                    {/* Timeline Plan Schedule */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">
                        დაგეგმილი საათები
                      </h4>

                      <div className="border-l-2 border-indigo-100 dark:border-indigo-900/60 pl-4 space-y-4.5 my-1">
                        {aiPlan.schedule && aiPlan.schedule.map((slot, index) => (
                          <div key={index} className="relative">
                            {/* Dot indicator */}
                            <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${
                              slot.isFocusSession ? 'bg-indigo-600 scale-125' : 'bg-slate-400 dark:bg-slate-600'
                            }`}></div>

                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/45 px-1.5 py-0.5 rounded font-display select-none">
                              {slot.time}
                            </span>
                            <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 font-sans">
                              {slot.activity}
                            </h5>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                              {slot.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Professional productivity tips */}
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
                        <Lightbulb size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-sans">რჩევები პროდუქტიულობისთვის</h4>
                      </div>
                      <ul className="space-y-1.5 pl-4 list-disc text-xs text-amber-950 dark:text-amber-300 font-sans">
                        {aiPlan.tips && aiPlan.tips.map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Reset AI design choice */}
                    <button 
                      onClick={() => setAiPlan(null)}
                      className="text-center w-full text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
                    >
                      გეგმის წაშლა და თავიდან დაწყება
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Bottom Device Navigation Bar matching Geometric Balance frame style */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900 px-6 pt-3.5 pb-7 flex justify-between items-center z-20">
            <button 
              onClick={() => setActiveTab('tasks')}
              className={`p-2 rounded-xl transition cursor-pointer flex flex-col items-center gap-0.5 ${
                activeTab === 'tasks' 
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Calendar size={18} />
              <span className="text-[9px] font-bold font-sans">გეგმა</span>
            </button>

            <button 
              onClick={() => setActiveTab('timer')}
              className={`p-2 rounded-xl transition cursor-pointer flex flex-col items-center gap-0.5 ${
                activeTab === 'timer' 
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Timer size={18} />
              <span className="text-[9px] font-bold font-sans">ტაიმერი</span>
            </button>

            {/* Float Add Button */}
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-11 h-11 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none hover:scale-105 active:scale-95 transition cursor-pointer -translate-y-2 select-none"
            >
              <Plus size={22} />
            </button>

            <button 
              onClick={() => setActiveTab('analytics')}
              className={`p-2 rounded-xl transition cursor-pointer flex flex-col items-center gap-0.5 ${
                activeTab === 'analytics' 
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Activity size={18} />
              <span className="text-[9px] font-bold font-sans">ანალიზი</span>
            </button>

            <button 
              onClick={() => setActiveTab('ai')}
              className={`p-2 rounded-xl transition cursor-pointer flex flex-col items-center gap-0.5 ${
                activeTab === 'ai' 
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <Sparkles size={18} />
              <span className="text-[9px] font-bold font-sans">AI რჩევა</span>
            </button>
          </div>

          {/* Real Smartphone Bottom bar Home indicator */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-200 dark:bg-slate-800 rounded-full z-20"></div>
        </div>


        {/* DECORATIVE & AUXILIARY RIGHT PANEL (Matching Geometric Balance Desktop layout annotations) */}
        <div id="side-annotations" className="w-80 md:flex flex-col gap-6 select-none leading-relaxed text-slate-600 dark:text-slate-400">
          <div>
            <span className="text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest font-display">პროექტი</span>
            <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-none mt-1">TimeFlow Pro</h3>
            <div className="w-12 h-1 bg-indigo-600 mt-3 rounded"></div>
          </div>
          
          <div className="space-y-4 bg-white dark:bg-slate-900/45 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-sans">
              <Zap size={14} className="text-amber-500" />
              გეომეტრიული ანოტაციები
            </h4>
            
            <div className="space-y-3.5">
              <div className="flex items-start">
                <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold mr-3 mt-0.5 shrink-0 font-sans">01</div>
                <p className="text-xs font-sans">
                  <strong>სამეცნიერო მიდგომა</strong>: აერთიანებს პომოდოროს (Pomodoro) კონცენტრაციას და ენერგიის ციკლებს.
                </p>
              </div>

              <div className="flex items-start">
                <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold mr-3 mt-0.5 shrink-0 font-sans">02</div>
                <p className="text-xs font-sans">
                  <strong>Gemini AI ინტეგრაცია</strong>: სერვერული მოდული წამებში აანალიზებს თქვენს ენერგიას და ოპტიმალურად ანაწილებს საათებს.
                </p>
              </div>

              <div className="flex items-start">
                <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold mr-3 mt-0.5 shrink-0 font-sans">03</div>
                <p className="text-xs font-sans">
                  <strong>მკვეთრი ტიპოგრაფია</strong>: ინტერფეისი შექმნილია მაქსიმალური ფოკუსისა და სიმშვიდის შესანარჩუნებლად.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Realtime Active Metrics */}
          <div className="bg-slate-900 text-slate-200 rounded-3xl p-5 relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <h4 className="text-[10px] font-semibold tracking-widest text-indigo-400 uppercase">სისტემური სტატუსი</h4>
              <div className="flex justify-between items-center text-xs">
                <span>აქტიური სესია:</span>
                <span className="font-mono text-emerald-400 font-bold">● LIVE</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>სულ დავალებები:</span>
                <span className="font-bold">{totalTasksCount}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>შესრულებულია:</span>
                <span className="text-indigo-300 font-bold">{completedTasksCount} ({progressPercentage}%)</span>
              </div>
            </div>
            {/* Background vector accent */}
            <div className="absolute right-0 bottom-0 w-20 h-20 bg-indigo-600 opacity-20 rounded-full transform translate-x-1/2 translate-y-1/2"></div>
          </div>
        </div>

      </div>


      {/* GEOMETRIC ADD TASK DIALOG MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl relative">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-4 tracking-tight font-sans">ახალი დავალების დამატება</h3>
            
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                  დავალების სახელი
                </label>
                <input
                  type="text"
                  required
                  placeholder="მაგ. ანგარიშის მომზადება..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 outline-none transition font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                  აღწერა / შენიშვნა
                </label>
                <textarea
                  placeholder="აქტივობის დეტალები ან მიზანი..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 outline-none transition resize-none font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                    კატეგორია
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CategoryType)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans"
                  >
                    <option value="work">სამსახური</option>
                    <option value="study">სწავლა</option>
                    <option value="health">ჯანმრთელობა</option>
                    <option value="personal">პირადი</option>
                    <option value="rest">დასვენება</option>
                    {customCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                    პრიორიტეტი
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as 'high' | 'medium' | 'low')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans"
                  >
                    <option value="high">მაღალი</option>
                    <option value="medium">საშუალო</option>
                    <option value="low">დაბალი</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 flex justify-between font-sans">
                  <span>დაგეგმილი Intervals (Pomodoro)</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{newEstimated} სესია</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={newEstimated}
                  onChange={(e) => setNewEstimated(Number(e.target.value))}
                  className="w-full accent-indigo-600 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full outline-none my-2"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-indigo-100 dark:shadow-none cursor-pointer"
                >
                  დამატება
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GEOMETRIC EDIT TASK DIALOG MODAL */}
      {editingTask && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl relative">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-4 tracking-tight font-sans">დავალების რედაქტირება</h3>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                  დავალების სახელი
                </label>
                <input
                  type="text"
                  required
                  placeholder="მაგ. ანგარიშის მომზადება..."
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 outline-none transition font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                  აღწერა / შენიშვნა
                </label>
                <textarea
                  placeholder="აქტივობის დეტალები ან მიზანი..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 outline-none transition resize-none font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                    კატეგორია
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans"
                  >
                    <option value="work">სამსახური</option>
                    <option value="study">სწავლა</option>
                    <option value="health">ჯანმრთელობა</option>
                    <option value="personal">პირადი</option>
                    <option value="rest">დასვენება</option>
                    {customCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                    პრიორიტეტი
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as 'high' | 'medium' | 'low')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 outline-none font-sans"
                  >
                    <option value="high">მაღალი</option>
                    <option value="medium">საშუალო</option>
                    <option value="low">დაბალი</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 flex justify-between font-sans">
                  <span>დაგეგმილი Intervals (Pomodoro)</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{editEstimated} სესია</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={editEstimated}
                  onChange={(e) => setEditEstimated(Number(e.target.value))}
                  className="w-full accent-indigo-600 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full outline-none my-2"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 text-slate-707 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-indigo-100 dark:shadow-none cursor-pointer"
                >
                  შენახვა
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MANAGER MODAL */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight font-sans">კატეგორიების მართვა</h3>
              <button 
                onClick={() => {
                  setShowCategoryManager(false);
                  setCatError(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Create Category Form */}
            <form onSubmit={handleAddCategory} className="space-y-4 pt-1 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1 font-sans">
                  ახალი კატეგორიის სახელი
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="მაგ. სპორტი, კოდინგი..."
                    value={newCatName}
                    onChange={(e) => {
                      setNewCatName(e.target.value);
                      if (catError) setCatError(null);
                    }}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 outline-none transition font-sans"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus size={14} />
                    <span>დამატება</span>
                  </button>
                </div>
                {catError && (
                  <p className="mt-1.5 text-[11px] font-bold text-rose-500 font-sans flex items-center gap-1">
                    <span>●</span> {catError}
                  </p>
                )}
              </div>

              {/* Color Selection Palette */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5 font-sans">
                  ფერის თემა: <span className="text-slate-600 dark:text-slate-450 font-bold">{COLOR_MAP[newCatColor]?.label}</span>
                </label>
                <div className="flex flex-wrap gap-2.5 font-sans">
                  {Object.keys(COLOR_MAP).map((col) => {
                    const isSelected = newCatColor === col;
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNewCatColor(col)}
                        className={`w-6 h-6 rounded-full ${COLOR_MAP[col].dot} relative transition-transform duration-100 hover:scale-110 flex items-center justify-center cursor-pointer`}
                        title={COLOR_MAP[col].label}
                      >
                        {isSelected && (
                          <span className="block w-2 h-2 rounded-full bg-white shadow-sm"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>

            {/* Custom Categories List */}
            <div className="mt-4">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-2 font-sans">
                არსებული პირადი კატეგორიები
              </label>
              {customCategories.length === 0 ? (
                <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs italic bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  პირადი კატეგორიები ჯერ არ არის
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                  {customCategories.map((c) => (
                    <div key={c.id} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${COLOR_MAP[c.color]?.dot || 'bg-slate-500'}`}></span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-sans">{c.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        className="p-1 px-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 dark:text-slate-500 transition cursor-pointer"
                        title="წაშლა"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
