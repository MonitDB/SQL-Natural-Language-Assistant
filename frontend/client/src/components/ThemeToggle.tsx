import { useTheme } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="rounded-full"
    >
      <Sun className={`h-5 w-5 ${theme === 'dark' ? 'hidden' : ''}`} />
      <Moon className={`h-5 w-5 ${theme === 'light' ? 'hidden' : ''}`} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
