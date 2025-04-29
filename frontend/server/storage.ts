import { users, type User, type InsertUser } from "@shared/schema";

// Interface for query logging
interface QueryLogData {
  username: string;
  databaseType: string;
  connectionString: string;
  prompt: string;
  executedQueries: string[] | null;
  result: string | null;
  error: string | null;
  timestamp?: string; // Optional timestamp field
}

// Storage interface
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  logQuery(logData: QueryLogData): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private queryLogs: QueryLogData[];
  currentId: number;

  constructor() {
    this.users = new Map();
    this.queryLogs = [];
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date().toISOString() 
    };
    this.users.set(id, user);
    return user;
  }

  async logQuery(logData: QueryLogData): Promise<void> {
    this.queryLogs.push({
      ...logData,
      timestamp: new Date().toISOString()
    });
    console.log(`Logged query from ${logData.username} using ${logData.databaseType}: "${logData.prompt}"`);
  }
}

export const storage = new MemStorage();
