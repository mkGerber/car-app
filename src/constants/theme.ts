import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const primaryColor = '#d4af37';

export const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: primaryColor,
    background: '#f5f5f5',
    surface: '#ffffff',
    text: '#212121',
    onSurface: '#212121',
    surfaceVariant: '#eeeeee',
    secondary: '#0a0f2c',
    error: '#d32f2f',
    disabled: '#bdbdbd',
    placeholder: '#757575',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
  roundness: 8,
};

export const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: primaryColor,
    background: '#121212',
    surface: '#1e1e1e',
    text: '#ffffff',
    onSurface: '#ffffff',
    surfaceVariant: '#2c2c2c',
    secondary: '#d4af37',
    error: '#cf6679',
    disabled: '#424242',
    placeholder: '#9e9e9e',
    backdrop: 'rgba(0, 0, 0, 0.6)',
  },
  roundness: 8,
}; 