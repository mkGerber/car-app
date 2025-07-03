import { MD3LightTheme, MD3DarkTheme, MD3Colors } from 'react-native-paper';

const primaryColor = '#d4af37';
const blue = '#181c3a';
const yellow = '#FFD600';

// Extend MD3Colors interface to include our custom colors
interface CustomColors extends MD3Colors {
  chatBackground: string;
  chatSurface: string;
  chatHeader: string;
  chatInput: string;
  chatBubbleMe: string;
  chatBubbleOther: string;
  chatTextMe: string;
  chatTextOther: string;
  chatTime: string;
  chatName: string;
}

export const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: yellow,
    accent: yellow,
    background: '#f5f6fa',
    surface: '#ffffff',
    surfaceVariant: '#e6e9f5',
    onPrimary: blue,
    onSurface: blue,
    onBackground: blue,
    outline: '#b0b3b8',
    error: '#ff5252',
    disabled: '#bdbdbd',
    placeholder: '#9e9e9e',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    // Chat specific colors
    chatBackground: '#f5f6fa',
    chatSurface: '#ffffff',
    chatHeader: '#ffffff',
    chatInput: '#f0f2f5',
    chatBubbleMe: yellow,
    chatBubbleOther: '#e4e6eb',
    chatTextMe: blue,
    chatTextOther: '#050505',
    chatTime: '#65676b',
    chatName: '#65676b',
  } as CustomColors,
  roundness: 8,
};

export const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#e6c200',
    accent: '#e6c200',
    background: '#181a20',
    surface: '#23262f',
    surfaceVariant: '#2d303a',
    onPrimary: '#181a20',
    onSurface: '#f4f4f7',
    onBackground: '#f4f4f7',
    outline: '#3a3d4d',
    error: '#ff5370',
    disabled: '#393a40',
    placeholder: '#6c6f7e',
    backdrop: 'rgba(20, 21, 26, 0.7)',
    // Chat specific colors
    chatBackground: '#181a20',
    chatSurface: '#23262f',
    chatHeader: '#23262f',
    chatInput: '#23262f',
    chatBubbleMe: '#e6c200',
    chatBubbleOther: '#2d303a',
    chatTextMe: '#181a20',
    chatTextOther: '#f4f4f7',
    chatTime: '#b0b3b8',
    chatName: '#b0b3b8',
  } as CustomColors,
  roundness: 10,
};

export const appDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: yellow,
    accent: yellow,
    background: blue,
    surface: '#242526',
    surfaceVariant: '#3a3b3c',
    onPrimary: blue,
    onSurface: '#ffffff',
    onBackground: '#ffffff',
    outline: '#b0b3b8',
    error: '#ff5252',
    placeholder: '#b0b3b8',
  } as CustomColors,
};

export const appLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: yellow,
    accent: yellow,
    background: '#f5f6fa',
    surface: '#ffffff',
    surfaceVariant: '#e6e9f5',
    onPrimary: blue,
    onSurface: blue,
    onBackground: blue,
    outline: '#b0b3b8',
    error: '#ff5252',
    placeholder: '#9e9e9e',
  } as CustomColors,
};

export const appTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: yellow,
    accent: yellow,
    background: blue,
    surface: '#242526',
    surfaceVariant: '#3a3b3c',
    onPrimary: blue,
    onSurface: '#ffffff',
    onBackground: '#ffffff',
    outline: '#b0b3b8',
    error: '#ff5252',
    placeholder: '#b0b3b8',
    // Add any other overrides as needed
  } as CustomColors,
}; 