# 🚗 Car Enthusiast Mobile App

A React Native mobile application for car enthusiasts to showcase their vehicles, track modifications, discover events, and connect with the community.

## Features

- **Social Feed**: Browse and share car-related posts
- **Vehicle Garage**: Manage your car collection with detailed profiles
- **Events**: Discover and RSVP to local car meets and events
- **User Profiles**: Showcase your builds and connect with others
- **Real-time Updates**: Stay connected with the car community

## Tech Stack

- **Frontend**: React Native with Expo
- **Navigation**: Expo Router
- **State Management**: Redux Toolkit
- **UI Framework**: React Native Paper
- **Backend**: Supabase
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL (via Supabase)

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd car-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

## Development

### Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser

### Project Structure

```
car-app/
├── app/                    # Expo Router app directory
│   ├── (auth)/            # Authentication routes
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/            # Main tab navigation
│   │   ├── index.tsx      # Feed screen
│   │   ├── events.tsx     # Events screen
│   │   ├── garage.tsx     # Garage screen
│   │   └── profile.tsx    # Profile screen
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # Reusable components
│   ├── services/         # API and external services
│   │   └── supabase.ts   # Supabase client
│   ├── store/           # Redux store
│   │   ├── index.ts     # Store configuration
│   │   └── slices/      # Redux slices
│   ├── context/         # React Context providers
│   │   └── AuthContext.tsx
│   ├── constants/       # App constants
│   │   └── theme.ts     # Theme configuration
│   ├── utils/          # Helper functions
│   ├── types/          # TypeScript type definitions
│   └── hooks/          # Custom React hooks
├── assets/             # Static assets
├── app.json           # Expo configuration
├── package.json       # Dependencies
└── tsconfig.json     # TypeScript configuration
```

### Key Components

- **Authentication**: Email/password authentication with Supabase
- **Feed**: Social feed with posts, likes, and comments
- **Garage**: Vehicle management with photos and details
- **Events**: Event discovery and RSVP functionality
- **Profile**: User profile management and settings

## Database Schema

The app uses the following Supabase tables:

- `users` - User profiles and authentication
- `vehicles` - Vehicle information and photos
- `posts` - Social feed posts
- `events` - Car meets and events
- `comments` - Post comments
- `followers` - User following relationships

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@carenthusiast.com or create an issue in the repository.
