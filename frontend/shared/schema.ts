import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Database query logs
export const queryLogs = pgTable("query_logs", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  databaseType: text("database_type").notNull(),
  connectionString: text("connection_string").notNull(),
  prompt: text("prompt").notNull(),
  executedQueries: text("executed_queries").array(),
  result: text("result"),
  error: text("error"),
  timestamp: text("timestamp").notNull().default(new Date().toISOString()),
});

export const insertQueryLogSchema = createInsertSchema(queryLogs).omit({
  id: true,
  timestamp: true
});

// User saved connections
export const savedConnections = pgTable("saved_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  databaseType: text("database_type").notNull(),
  connectionString: text("connection_string").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  port: integer("port"),
  database: text("database"),
  schema: text("schema"),
  isDefault: boolean("is_default").default(false),
});

export const insertSavedConnectionSchema = createInsertSchema(savedConnections).omit({
  id: true
});

// User saved queries
export const savedQueries = pgTable("saved_queries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  connectionId: integer("connection_id").notNull(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  executedQueries: text("executed_queries").array(),
  timestamp: text("timestamp").notNull().default(new Date().toISOString()),
});

export const insertSavedQuerySchema = createInsertSchema(savedQueries).omit({
  id: true,
  timestamp: true
});

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});

// Type definitions
export type InsertQueryLog = z.infer<typeof insertQueryLogSchema>;
export type QueryLog = typeof queryLogs.$inferSelect;

export type InsertSavedConnection = z.infer<typeof insertSavedConnectionSchema>;
export type SavedConnection = typeof savedConnections.$inferSelect;

export type InsertSavedQuery = z.infer<typeof insertSavedQuerySchema>;
export type SavedQuery = typeof savedQueries.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
