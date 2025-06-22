# 🚗 Car Enthusiast Social Platform

## Overview

A dedicated mobile platform for car enthusiasts that combines social networking with practical tools. Users can showcase their vehicles, track modifications, post updates, and discover local car events. The app serves as a digital garage, build journal, and event locator — all in one place.

## Tech Stack

- Frontend: React Native with TypeScript, Expo, and Expo Router
- Backend/Database: Supabase
- UI Framework: React Native Paper
- AI Processing: DeepSeek

## 🔄 App Flow

### Authentication

- **Login/Registration**
  - Email/password or Google sign-in
  - New user profile setup

### Main Navigation

- **Home Screen (Feed)**
  - Default landing page after login
  - Posts from followed users and trending content
  - Interactive features: likes, comments, profile exploration

### Bottom Navigation

1. **Feed**: Community social posts
2. **Events**: Local car meets, shows, and track days
3. **Garage**: User's vehicle collection
4. **Profile**: Personal information and social stats

### Key Screens

- **Garage → Car Detail**

  - Full vehicle profile
  - Photos and build timeline
  - Detailed specifications

- **Garage → Add/Edit Car**

  - Vehicle information input
  - Photo upload
  - Status tagging (project, daily, etc.)

- **Post Creation**

  - Car selection
  - Media upload
  - Caption writing
  - Public feed submission

- **Events Page**
  - List/map view of local events
  - Detailed event information
  - Future RSVP functionality

## 🧩 Core Features

### 1. User Profiles & Garage

- **Profile Components**

  - Username and bio
  - Profile picture
  - Vehicle showcase
  - Post history

- **Garage Features**
  - Multiple vehicle support
  - Detailed specifications
  - Photo galleries
  - Status tracking

### 2. Build Tracker

- Timeline-based progress tracking
- Update logging with photos
- Chronological build history
- Modification documentation

### 3. Social Feed

- **Post Components**

  - Photo/video content
  - Captions
  - Car associations
  - Engagement features

- **Navigation**
  - User profiles
  - Vehicle profiles
  - Interactive elements

### 4. Event Finder

- **Discovery Features**
  - Location-based search
  - Date filtering
  - Event categorization
  - Map integration

## 🛠 Future Enhancements

- Modification/expense tracking
- License plate connection feature
- User-hosted events
- Car club creation
- Marketplace integration
- In-app messaging
- Push notifications
- Milestone tracking

## 🎯 Target Audience

- Car enthusiasts
- College car clubs
- Track enthusiasts
- Show car owners
- Automotive communities

## 💡 Monetization Strategy

- Premium user tier
- Sponsored events
- Local business promotion
- Marketplace transaction fees

## 📱 Summary

This platform addresses a growing need in the automotive community by providing a purpose-built digital space that combines social interaction with practical tools. It supports both casual enthusiasts and dedicated gearheads through its hybrid model of social features and functional capabilities.

## 📊 Database Schema

### Users Table

```sql
users (
  id: uuid PRIMARY KEY,
  email: text UNIQUE NOT NULL,
  username: text UNIQUE NOT NULL,
  full_name: text,
  avatar_url: text,
  bio: text,
  created_at: timestamp with time zone DEFAULT now(),
  updated_at: timestamp with time zone DEFAULT now()
)
```

### Vehicles Table

```sql
vehicles (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES users(id),
  make: text NOT NULL,
  model: text NOT NULL,
  year: integer NOT NULL,
  trim: text,
  status: text CHECK (status IN ('project', 'daily', 'show', 'track')),
  description: text,
  main_image_url: text,
  created_at: timestamp with time zone DEFAULT now(),
  updated_at: timestamp with time zone DEFAULT now()
)
```

### Vehicle_Photos Table

```sql
vehicle_photos (
  id: uuid PRIMARY KEY,
  vehicle_id: uuid REFERENCES vehicles(id),
  photo_url: text NOT NULL,
  caption: text,
  created_at: timestamp with time zone DEFAULT now()
)
```

### Build_Updates Table

```sql
build_updates (
  id: uuid PRIMARY KEY,
  vehicle_id: uuid REFERENCES vehicles(id),
  title: text NOT NULL,
  description: text,
  cost: decimal,
  date: timestamp with time zone DEFAULT now(),
  created_at: timestamp with time zone DEFAULT now()
)
```

### Posts Table

```sql
posts (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES users(id),
  vehicle_id: uuid REFERENCES vehicles(id),
  content: text,
  created_at: timestamp with time zone DEFAULT now(),
  updated_at: timestamp with time zone DEFAULT now()
)
```

### Post_Media Table

```sql
post_media (
  id: uuid PRIMARY KEY,
  post_id: uuid REFERENCES posts(id),
  media_url: text NOT NULL,
  media_type: text CHECK (media_type IN ('image', 'video')),
  created_at: timestamp with time zone DEFAULT now()
)
```

### Comments Table

```sql
comments (
  id: uuid PRIMARY KEY,
  post_id: uuid REFERENCES posts(id),
  user_id: uuid REFERENCES users(id),
  content: text NOT NULL,
  created_at: timestamp with time zone DEFAULT now(),
  updated_at: timestamp with time zone DEFAULT now()
)
```

### Events Table

```sql
events (
  id: uuid PRIMARY KEY,
  creator_id: uuid REFERENCES users(id),
  title: text NOT NULL,
  description: text,
  location: text NOT NULL,
  latitude: decimal,
  longitude: decimal,
  start_date: timestamp with time zone NOT NULL,
  end_date: timestamp with time zone NOT NULL,
  created_at: timestamp with time zone DEFAULT now(),
  updated_at: timestamp with time zone DEFAULT now()
)
```

### Event_Attendees Table

```sql
event_attendees (
  id: uuid PRIMARY KEY,
  event_id: uuid REFERENCES events(id),
  user_id: uuid REFERENCES users(id),
  status: text CHECK (status IN ('attending', 'maybe', 'not_attending')),
  created_at: timestamp with time zone DEFAULT now()
)
```

### Followers Table

```sql
followers (
  id: uuid PRIMARY KEY,
  follower_id: uuid REFERENCES users(id),
  following_id: uuid REFERENCES users(id),
  created_at: timestamp with time zone DEFAULT now(),
  UNIQUE(follower_id, following_id)
)
```

## 📁 Folder Structure

```
car-enthusiast-app/
├── app/                      # Expo Router app directory
│   ├── (auth)/              # Authentication routes
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/              # Main tab navigation
│   │   ├── feed/            # Feed tab
│   │   ├── events/          # Events tab
│   │   ├── garage/          # Garage tab
│   │   └── profile/         # Profile tab
│   └── _layout.tsx          # Root layout
├── src/
│   ├── components/          # Reusable components
│   │   ├── common/          # Shared components
│   │   ├── feed/           # Feed-specific components
│   │   ├── garage/         # Garage-specific components
│   │   └── events/         # Event-specific components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API and external services
│   │   ├── supabase/      # Supabase client and queries
│   │   └── ai/            # AI processing services
│   ├── utils/             # Helper functions
│   ├── constants/         # App constants
│   ├── types/            # TypeScript type definitions
│   └── context/          # React Context providers
├── assets/               # Static assets
│   ├── images/
│   ├── fonts/
│   └── icons/
├── docs/                # Documentation
├── tests/              # Test files
├── .env.example        # Environment variables example
├── app.json           # Expo config
├── babel.config.js    # Babel config
├── tsconfig.json     # TypeScript config
└── package.json      # Dependencies and scripts
```

This structure follows React Native and Expo best practices, with a clear separation of concerns and modular organization. The app directory uses Expo Router for file-based routing, while the src directory contains all the business logic and components.
