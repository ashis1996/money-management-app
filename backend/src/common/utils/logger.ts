import { Injectable } from '@nestjs/common';

@Injectable()
export class Logger {
  private context: string;

  constructor(context?: string) {
    this.context = context || 'App';
  }

  log(message: string): void {
    console.log(`[${this.getTimeString()}] [${this.context}] [INFO] ${message}`);
  }

  debug(message: string): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${this.getTimeString()}] [${this.context}] [DEBUG] ${message}`);
    }
  }

  warn(message: string): void {
    console.warn(`[${this.getTimeString()}] [${this.context}] [WARN] ${message}`);
  }

  error(message: string, trace?: string): void {
    console.error(`[${this.getTimeString()}] [${this.context}] [ERROR] ${message}`, trace || '');
  }

  verbose(message: string): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${this.getTimeString()}] [${this.context}] [VERBOSE] ${message}`);
    }
  }

  private getTimeString(): string {
    return new Date().toISOString();
  }
}
