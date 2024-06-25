import { handleEmergency, handleInfo } from "./logs.handler";

class TaskQueue {
  private tasks: (() => Promise<void>)[] = [];
  private isRunning = false;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    handleInfo(this.name, "created queue!");
  }

  async enqueue(task: () => Promise<void>): Promise<void> {
    this.tasks.push(task);
    handleInfo(this.name, "enqueue task");
  }

  async processQueue(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    while (this.tasks.length > 0) {
      const task = this.tasks[0];

      try {
        await task();
      } catch (e) {
        handleEmergency(this.name, "processQueue", {}, e);
        throw e;
      } finally {
        this.tasks.shift();
        handleInfo(this.name, "Task done.");
      }
    }
    this.isRunning = false;
  }
}

export default TaskQueue;
