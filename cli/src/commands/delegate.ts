import { Command } from 'commander';
import { BackgroundAgentService } from '../services/backgroundAgent';
import { logger } from '../utils/logger';

export function createDelegateCommand(): Command {
  const delegate = new Command('delegate')
    .description('Delegate tasks to the background agent for async processing');

  delegate
    .command('task <description>')
    .description('Delegate a task to the background agent')
    .option('-p, --priority <level>', 'Task priority (low, normal, high)', 'normal')
    .option('-t, --timeout <seconds>', 'Task timeout in seconds', '3600')
    .action(async (description: string, options) => {
      try {
        const agent = BackgroundAgentService.getInstance();
        const taskId = await agent.queueTask({
          description,
          priority: options.priority,
          timeout: parseInt(options.timeout, 10),
        });
        logger.info(`Task delegated successfully. Task ID: ${taskId}`);
      } catch (error) {
        logger.error('Failed to delegate task:', error);
        process.exit(1);
      }
    });

  delegate
    .command('status [taskId]')
    .description('Check status of delegated tasks')
    .action(async (taskId?: string) => {
      try {
        const agent = BackgroundAgentService.getInstance();
        if (taskId) {
          const status = await agent.getTaskStatus(taskId);
          console.log(JSON.stringify(status, null, 2));
        } else {
          const tasks = await agent.listTasks();
          console.log(JSON.stringify(tasks, null, 2));
        }
      } catch (error) {
        logger.error('Failed to get task status:', error);
        process.exit(1);
      }
    });

  delegate
    .command('cancel <taskId>')
    .description('Cancel a delegated task')
    .action(async (taskId: string) => {
      try {
        const agent = BackgroundAgentService.getInstance();
        await agent.cancelTask(taskId);
        logger.info(`Task ${taskId} cancelled successfully.`);
      } catch (error) {
        logger.error('Failed to cancel task:', error);
        process.exit(1);
      }
    });

  return delegate;
}
