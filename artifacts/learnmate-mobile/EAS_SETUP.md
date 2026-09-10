# EAS Build & Submit Setup

This document describes how to configure EAS Build for App Store and Google Play distribution.

## Prerequisites

1. Install the EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Link to your Expo account: `eas init`

## Required EAS Environment Variables

Set these as EAS environment variables (they will be injected at build time and
never committed to the repository):

```sh
# Your Clerk publishable key (starts with pk_live_ for production)
eas env:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value "pk_live_..." --environment production

# Your deployed API base URL (the Replit deployment URL + /api)
eas env:create --scope project --name EXPO_PUBLIC_API_URL --value "https://your-app.replit.app/api" --environment production
```

Repeat for `preview` and `development` environments using the appropriate values.

## Building

```sh
# Development build (for Expo Dev Client)
eas build --platform all --profile development

# Preview build (internal testing via TestFlight / internal track)
eas build --platform all --profile preview

# Production build
eas build --platform all --profile production
```

## Submitting

```sh
# iOS – requires App Store Connect API key configured in EAS dashboard
eas submit --platform ios --profile production

# Android – requires Google Play service account JSON configured in EAS dashboard
eas submit --platform android --profile production
```

## App Store Connect / Google Play

- **Bundle ID (iOS):** `com.learnmate.ai`
- **Package (Android):** `com.learnmate.ai`
- **App name:** LearnMate AI
- **Category:** Education

Configure your Apple Team ID and App Store Connect App ID in the EAS dashboard
under your project's credentials, not in `eas.json`.
