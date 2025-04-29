import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import { z } from "zod";

const databaseTypeSchema = z.enum(["oracle", "postgres", "mysql", "mssql"]);

const connectionSchema = z.object({
  username: z.string(),
  password: z.string(),
  connectionString: z.string(),
  type: databaseTypeSchema,
  port: z.number().optional(),
  database: z.string().optional(),
  schema: z.string().optional(),
});

const queryRequestSchema = connectionSchema.extend({
  prompt: z.string(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.post("/api/test-connection", async (req, res) => {
    try {
      const validatedData = connectionSchema.parse(req.body);
      
      try {
        // Connect to external API
        const apiResponse = await axios.post(
          `${import.meta.env.VITE_API_HOST_URL}/ask/test-connection`,
          validatedData
        );
        
        return res.json(apiResponse.data);
      } catch (error: any) {
        console.error('API connection error:', error.message);
        return res.status(error.response?.status || 400).json({ 
          success: false, 
          message: error.response?.data?.message || error.message || "Connection failed" 
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request" 
      });
    }
  });

  app.post("/api/ask", async (req, res) => {
    try {
      const validatedData = queryRequestSchema.parse(req.body);
      
      try {
        // Connect to external API
        console.log(`Sending query to external API: "${validatedData.prompt}"`);
        
        const apiResponse = await axios.post(
          `${import.meta.env.VITE_API_HOST_URL}/ask`,
          validatedData
        );
        
        // Log the successful query
        await storage.logQuery({
          username: validatedData.username,
          databaseType: validatedData.type,
          connectionString: validatedData.connectionString,
          prompt: validatedData.prompt,
          executedQueries: apiResponse.data.executedQueries || [],
          result: apiResponse.data.result || null,
          error: null,
        });
        
        return res.json(apiResponse.data);
      } catch (error: any) {
        console.error('API query error:', error.message);
        
        // Log the error
        await storage.logQuery({
          username: validatedData.username,
          databaseType: validatedData.type,
          connectionString: validatedData.connectionString,
          prompt: validatedData.prompt,
          executedQueries: [],
          result: null,
          error: error.response?.data?.message || error.message,
        });
        
        return res.status(error.response?.status || 500).json({ 
          success: false, 
          message: error.response?.data?.message || error.message || "Query execution failed" 
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request" 
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}

// Helper function to generate mock results based on prompt
function generateMockResult(prompt: string, dbType: string) {
  const promptLower = prompt.toLowerCase();
  
  // Common suggested prompts
  const suggestedPrompts = [
    "Show salaries for IT department",
    "Compare with other departments",
    "Show IT projects"
  ];
  
  // Employee example
  if (promptLower.includes("employee") || promptLower.includes("it department")) {
    return {
      result: "There are 3 employees in the IT department. John Smith is the manager of the IT department, supervising 2 employees: Jane Doe (Software Developer) and Michael Johnson (System Administrator). John Smith reports directly to the CTO, Sarah Wilson.",
      executedQueries: [
        `SELECT
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    j.job_title AS position,
    m.first_name || ' ' || m.last_name AS manager_name
FROM
    hr.employees e
JOIN
    hr.jobs j ON e.job_id = j.job_id
JOIN
    hr.departments d ON e.department_id = d.department_id
LEFT JOIN
    hr.employees m ON e.manager_id = m.employee_id
WHERE
    d.department_name = 'IT'
ORDER BY
    e.employee_id;`
      ],
      rawResults: [
        {
          employee_id: 101,
          employee_name: "John Smith",
          position: "IT Manager",
          manager_name: "Sarah Wilson"
        },
        {
          employee_id: 102,
          employee_name: "Jane Doe",
          position: "Software Developer",
          manager_name: "John Smith"
        },
        {
          employee_id: 103,
          employee_name: "Michael Johnson",
          position: "System Administrator",
          manager_name: "John Smith"
        }
      ],
      suggestedPrompts
    };
  }
  
  // Salary example
  if (promptLower.includes("salary") || promptLower.includes("highest")) {
    return {
      result: "The average salary across all departments is $8,300. The Finance department has the highest average salary at $9,500, followed by Executive at $9,000 and IT at $8,600. The lowest average salary is in the Customer Service department at $6,500.",
      executedQueries: [
        `SELECT
    d.department_name,
    ROUND(AVG(e.salary), 2) as avg_salary
FROM
    hr.employees e
JOIN
    hr.departments d ON e.department_id = d.department_id
GROUP BY
    d.department_name
ORDER BY
    avg_salary DESC;`
      ],
      rawResults: [
        {
          department_name: "Finance",
          avg_salary: 9500
        },
        {
          department_name: "Executive",
          avg_salary: 9000
        },
        {
          department_name: "IT",
          avg_salary: 8600
        },
        {
          department_name: "Marketing",
          avg_salary: 7300
        },
        {
          department_name: "Customer Service",
          avg_salary: 6500
        }
      ],
      suggestedPrompts: [
        "Show the highest paid employee",
        "Compare salary by job title",
        "Show salary ranges by department"
      ]
    };
  }
  
  // Regions example
  if (promptLower.includes("region") || promptLower.includes("countries")) {
    return {
      result: "There are 4 regions defined in the HR.REGIONS table: Europe, Americas, Asia, and Middle East and Africa. Europe contains 8 countries, Americas contains 5 countries, Asia contains 10 countries, and Middle East and Africa contains 6 countries.",
      executedQueries: [
        `SELECT
    r.region_name,
    COUNT(c.country_id) as country_count
FROM
    hr.regions r
LEFT JOIN
    hr.countries c ON r.region_id = c.region_id
GROUP BY
    r.region_name
ORDER BY
    r.region_name;`
      ],
      rawResults: [
        {
          region_name: "Americas",
          country_count: 5
        },
        {
          region_name: "Asia",
          country_count: 10
        },
        {
          region_name: "Europe",
          country_count: 8
        },
        {
          region_name: "Middle East and Africa",
          country_count: 6
        }
      ],
      suggestedPrompts: [
        "List the countries in Europe",
        "How many employees are in each region?",
        "Show locations by region"
      ]
    };
  }
  
  // Default response
  return {
    result: "Your query was processed successfully. The database shows relevant information matching your criteria.",
    executedQueries: [
      `-- Query generated based on: "${prompt}"
SELECT
    *
FROM
    ${dbType === "oracle" ? "hr.table_name" : "table_name"}
WHERE
    some_condition = true
LIMIT 10;`
    ],
    rawResults: [
      {
        id: 1,
        name: "Sample Data 1",
        category: "Category A",
        value: 100
      },
      {
        id: 2,
        name: "Sample Data 2",
        category: "Category B",
        value: 200
      },
      {
        id: 3,
        name: "Sample Data 3",
        category: "Category A",
        value: 150
      }
    ],
    suggestedPrompts: [
      "Show more detailed information",
      "Filter by specific criteria",
      "Compare with historical data"
    ]
  };
}
