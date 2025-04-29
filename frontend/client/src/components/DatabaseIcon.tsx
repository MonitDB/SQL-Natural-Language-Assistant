import { DatabaseType } from "@/lib/types";
import { Database } from "lucide-react";

type DatabaseIconProps = {
  type: DatabaseType;
  className?: string;
};

export default function DatabaseIcon({ type, className = "" }: DatabaseIconProps) {
  switch (type) {
    case "oracle":
      return (
        <svg
          className={className}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 5c0 1.657-4.03 3-9 3S3 6.657 3 5s4.03-3 9-3 9 1.343 9 3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "postgres":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3C9.26 3 7.5 4.7 7.5 6.5C7.5 8.3 9 9 12 9C15 9 16.5 8.3 16.5 6.5C16.5 4.7 14.74 3 12 3Z" />
          <path d="M7.5 6.5V12.5C7.5 14.3 9 15 12 15C15 15 16.5 14.3 16.5 12.5V6.5" />
          <path d="M7.5 12.5V18.5C7.5 20.3 9 21 12 21C15 21 16.5 20.3 16.5 18.5V12.5" />
          <path d="M12 9C9 9 7.5 9.8 7.5 11.5C7.5 13.2 9 14 12 14C15 14 16.5 13.2 16.5 11.5C16.5 9.8 15 9 12 9Z" />
          <path d="M12 14C9 14 7.5 14.8 7.5 16.5C7.5 18.2 9 19 12 19C15 19 16.5 18.2 16.5 16.5C16.5 14.8 15 14 12 14Z" />
        </svg>
      );
    case "mysql":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 9C12 7.34315 10.6569 6 9 6C7.34315 6 6 7.34315 6 9C6 10.6569 7.34315 12 9 12C10.6569 12 12 10.6569 12 9Z" />
          <path d="M3 15C3 14.0807 3.18106 13.1705 3.53284 12.3212L3.53284 12.3212C4.34524 10.42 6.14828 9 9 9" />
          <path d="M15 9C15 7.34315 16.3431 6 18 6C19.6569 6 21 7.34315 21 9C21 10.6569 19.6569 12 18 12C16.3431 12 15 10.6569 15 9Z" />
          <path d="M21 15C21 14.0807 20.8189 13.1705 20.4672 12.3212L20.4672 12.3212C19.6548 10.42 17.8517 9 15 9" />
          <path d="M9 18H15" />
          <path d="M12 12V18" />
        </svg>
      );
    case "mssql":
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 4C5 2.89543 5.89543 2 7 2H17C18.1046 2 19 2.89543 19 4V6C19 7.10457 18.1046 8 17 8H7C5.89543 8 5 7.10457 5 6V4Z" />
          <path d="M5 18C5 16.8954 5.89543 16 7 16H17C18.1046 16 19 16.8954 19 18V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V18Z" />
          <path d="M5 11C5 9.89543 5.89543 9 7 9H17C18.1046 9 19 9.89543 19 11V13C19 14.1046 18.1046 15 17 15H7C5.89543 15 5 14.1046 5 13V11Z" />
        </svg>
      );
    default:
      return <Database className={className} />;
  }
}
