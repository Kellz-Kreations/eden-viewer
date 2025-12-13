import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface DelegatedTask {
  id: string;
  description: string;
  priority: 'low' | 'normal' | 'high';
  timeout: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface QueueTaskOptions {
  description: string;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
}

export class BackgroundAgentService extends EventEmitter {
  private static instance: BackgroundAgentService;
  private tasks: Map<string, DelegatedTask> = new Map();
  private queue: string[] = [];
  private isProcessing = false;

  private constructor() {
    super();
  }

  static getInstance(): BackgroundAgentService {
    if (!BackgroundAgentService.instance) {
      BackgroundAgentService.instance = new BackgroundAgentService();
    }
    return BackgroundAgentService.instance;
  }

  async queueTask(options: QueueTaskOptions): Promise<string> {
    const task: DelegatedTask = {
      id: randomUUID(),
      description: options.description,
      priority: options.priority || 'normal',
      timeout: options.timeout || 3600,
      status: 'queued',
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);
    this.addToQueue(task.id, task.priority);
    
    logger.debug(`Task ${task.id} queued with priority ${task.priority}`);
    this.emit('taskQueued', task);
    
    this.processQueue();
    return task.id;
  }

  private addToQueue(taskId: string, priority: 'low' | 'normal' | 'high'): void {
    if (priority === 'high') {
      this.queue.unshift(taskId);
    } else if (priority === 'low') {
      this.queue.push(taskId);
    } else {
      const insertIndex = this.queue.findIndex((id) => {
        const t = this.tasks.get(id);
        return t?.priority === 'low';
      });
      if (insertIndex === -1) {
        this.queue.push(taskId);
      } else {
        this.queue.splice(insertIndex, 0, taskId);
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const taskId = this.queue.shift();
      if (!taskId) continue;

      const task = this.tasks.get(taskId);
      if (!task || task.status === 'cancelled') continue;

      await this.executeTask(task);
    }

    this.isProcessing = false;
  }

  private async executeTask(task: DelegatedTask): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();
    this.emit('taskStarted', task);

    try {
      logger.info(`Executing task: ${task.description}`);
      // Background agent processes the task description
      // This is where the actual work would be delegated
      await this.delegateToAgent(task);
      
      task.status = 'completed';
      task.completedAt = new Date();
      this.emit('taskCompleted', task);
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error instanceof Error ? error.message : String(error);
      this.emit('taskFailed', task);
      logger.error(`Task ${task.id} failed:`, task.error);
    }
  }

  private async delegateToAgent(task: DelegatedTask): Promise<void> {
    // Simulate background processing
    // In production, this would connect to an actual background agent
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Task timeout exceeded'));
      }, task.timeout * 1000);

      // Simulated async work
      setTimeout(() => {
        clearTimeout(timeoutId);
        task.result = { message: 'Task completed by background agent' };
        resolve();
      }, 100);
    });
  }

  async getTaskStatus(taskId: string): Promise<DelegatedTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async listTasks(): Promise<DelegatedTask[]> {
    return Array.from(this.tasks.values());
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw new Error(`Cannot cancel task in ${task.status} state`);
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    this.emit('taskCancelled', task);
    
    // Remove from queue if still queued
    const queueIndex = this.queue.indexOf(taskId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    return true;
  }
}
