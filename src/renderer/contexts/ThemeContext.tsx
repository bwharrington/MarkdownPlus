import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const createAppTheme = (mode: ThemeMode): Theme => {
    return createTheme({
        palette: {
            mode,
            primary: {
                main: mode === 'dark' ? '#61dafb' : '#1976d2',
            },
            background: {
                default: mode === 'dark' ? '#1e1e1e' : '#f5f7fa',
                paper: mode === 'dark' ? '#252526' : '#fcfdfe',
            },
        },
        typography: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
        },
    });
};

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [mode, setMode] = useState<ThemeMode>('dark');
    const [theme, setTheme] = useState<Theme>(createAppTheme('dark'));

    // Load theme preference from localStorage
    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode') as ThemeMode | null;
        if (savedMode === 'light' || savedMode === 'dark') {
            setMode(savedMode);
            setTheme(createAppTheme(savedMode));
        }
    }, []);

    const toggleTheme = () => {
        setMode((prevMode) => {
            const newMode = prevMode === 'dark' ? 'light' : 'dark';
            localStorage.setItem('themeMode', newMode);
            setTheme(createAppTheme(newMode));
            return newMode;
        });
    };

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme }}>
            <MuiThemeProvider theme={theme}>
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
