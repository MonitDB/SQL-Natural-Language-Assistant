export const EXAMPLE_QUERIES = [
  "What regions are defined in the HR.REGIONS table?",
  "List the countries in Europe",
  "Show me employees in the IT department and their managers",
  "What is the average salary by department, and which department has the highest average salary?",
  "How many employees are there in each department?",
  "Which employee has the highest salary?"
];

export const DATABASE_DEFAULTS = {
  oracle: {
    port: 1521,
    placeholder: "host:port/service_name"
  },
  postgres: {
    port: 5432,
    placeholder: "hostname"
  },
  mysql: {
    port: 3306,
    placeholder: "hostname"
  },
  mssql: {
    port: 1433,
    placeholder: "server_name"
  }
};
