import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Load from localStorage or default to dark
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      const initialTheme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
      // Apply immediately to prevent flash
      const root = document.documentElement;
      if (initialTheme === 'light') {
        root.classList.remove('dark');
      } else {
        root.classList.add('dark');
      }
      return initialTheme;
    }
    return 'dark';
  });

  useEffect(() => {
    // Apply theme to HTML element
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

