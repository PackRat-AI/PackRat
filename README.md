# PackRat 🎒

PackRat is the ultimate adventure planner designed for those who love to explore the great outdoors. Our app helps users plan and organize their trips with ease, whether it's a weekend camping trip, a day hike, or a cross-country road trip.

With PackRat, you can create and manage trips, discover new destinations, and stay informed with up-to-date weather forecasts. Our app integrates with Mapbox to provide you with accurate maps and directions to your destinations, as well as suggestions for popular outdoor activities based on the location and season of your trip.

So pack your bags, grab your friends, and get ready for your next adventure with PackRat!

> [!NOTE]
> This project is currently in alpha. Please report any issues or bugs you encounter. Thank you for your patience and support!

> [!IMPORTANT]
> This project is still in development and may contain bugs or issues. Please use the app with caution and report any problems you encounter. Thank you for your understanding and cooperation.

**Build & CI:**
![Node.js CI](https://github.com/andrew-bierman/PackRat/actions/workflows/node.js.yml/badge.svg)
![Node.js CI for Dev Environment](https://github.com/andrew-bierman/PackRat/actions/workflows/node.js.dev.yml/badge.svg)
![Docker Image CI](https://github.com/andrew-bierman/PackRat/actions/workflows/docker.node.yml/badge.svg)
![android-build-apk](https://github.com/andrew-bierman/PackRat/actions/workflows/build.yml/badge.svg)

**Repository Info:**
![GitHub tag](https://img.shields.io/github/tag/andrew-bierman/PackRat?include_prereleases=&sort=semver&color=blue)
![License](https://img.shields.io/badge/License-GNU-blue)
![issues - PackRat](https://img.shields.io/github/issues/andrew-bierman/PackRat)

<div align="center">

[![View Beta Site](https://img.shields.io/badge/View%20Beta%20Site-%20-brightgreen)](https://packrat.world)

</div>

## Table of Contents

- [PackRat 🎒](#packrat-)
  - [Table of Contents](#table-of-contents)
  - [Overview 🌐](#overview-)
  - [Documentation 📚](#documentation-)
  - [Features 🚀](#features-)
  - [Technologies used 💻](#technologies-used-)
  - [🗂 Folder layout](#-folder-layout)
  - [UI Kit](#ui-kit)
  - [🆕 Add new dependencies](#-add-new-dependencies)
    - [Pure JS dependencies](#pure-js-dependencies)
    - [Native dependencies](#native-dependencies)
  - [Update new dependencies](#update-new-dependencies)
    - [Pure JS dependencies](#pure-js-dependencies-1)
  - [Local installation 📲](#local-installation-)
    - [Dependencies](#dependencies)
    - [Environment Setup](#environment-setup)
      - [Automated Setup (Unix) 🛠️](#automated-setup-unix-️)
      - [Manual Setup 📝](#manual-setup-)
    - [Yarn Setup](#yarn-setup)
      - [Root](#root)
      - [Server](#server)
      - [Client](#client)
    - [Debugging 🐛](#debugging-)
      - [Debugging Yarn Environment Setup - Windows](#debugging-yarn-environment-setup---windows)
      - [Debugging Client Environment Setup 🐛](#debugging-client-environment-setup-)
        - [Expo](#expo)
        - [Debugging Dependencies](#debugging-dependencies)
        - [Debugging Cloudflare Wrangler and D1](#debugging-cloudflare-wrangler-and-d1)
  - [Docker Installation 🐳 \[Experimental\]](#docker-installation--experimental)
    - [Dependencies](#dependencies-1)
    - [Installation](#installation)
  - [How backend API's are setup](#how-backend-apis-are-setup)
  - [Contributing 🤝](#contributing-)
  - [User Stories:](#user-stories)
  - [User Features:](#user-features)
    - [Registration and Authentication:](#registration-and-authentication)
    - [Main Dashboard:](#main-dashboard)
    - [Destination Search:](#destination-search)
    - [Accessing Profile Information:](#accessing-profile-information)
    - [Profile User Overview:](#profile-user-overview)
    - [Favorite Trips and Packs:](#favorite-trips-and-packs)
    - [Profile Management:](#profile-management)
    - [Appearance Theme Customization:](#appearance-theme-customization)
    - [Profile Editing:](#profile-editing)
  - [Pack Features:](#pack-features)
    - [Pack Creation and Access Settings:](#pack-creation-and-access-settings)
    - [Adding Items to Packs:](#adding-items-to-packs)
    - [Pack Scoring System:](#pack-scoring-system)
    - [Navigating to the Dashboard:](#navigating-to-the-dashboard)
  - [Trip Features:](#trip-features)
    - [Trip Creation and Management:](#trip-creation-and-management)
    - [Setting up a Trip:](#setting-up-a-trip)
    - [Accessing Saved Trips:](#accessing-saved-trips)
    - [Viewing Trip Details:](#viewing-trip-details)
  - [Items Feature:](#items-feature)
    - [Dashboard:](#dashboard)
    - [Adding Items:](#adding-items)
  - [Feed Feature:](#feed-feature)
    - [Exploring Backpackers:](#exploring-backpackers)
    - [Pack List Interaction:](#pack-list-interaction)
    - [Item Management:](#item-management)
    - [Returning to Feed Dashboard:](#returning-to-feed-dashboard)
  - [👏 Special Thanks](#-special-thanks)
  - [License 📝](#license-)

## Overview 🌐

With **PackRat**, you can:

- Create and manage trips.
- Discover new destinations.
- Stay informed with up-to-date weather forecasts.
- Access accurate maps and directions with our integration to Mapbox.
- Get suggestions for popular outdoor activities based on your trip's location and season.

So pack your bags, grab your friends, and get ready for your next adventure with **PackRat**!

## Documentation 📚

> [!WARNING]
> While the app is in alpha, please be aware that there may be bugs or issues. We appreciate your patience and support as we work to improve the app. Data may be lost or corrupted during this time, so please use the app with caution. Thank you for your understanding and cooperation.

<div align="center">

[![view - Documentation](https://img.shields.io/badge/view-Documentation-blue?style=for-the-badge)](/docs/ "Go to project documentation")

</div>

## Features 🚀

- Create and manage trips: users can create new trips and manage existing ones by adding details such as dates, locations, and activities.
- Map integration: PackRat integrates with Mapbox to provide users with accurate maps and directions to their destinations.
- Activity suggestions: the app suggests popular outdoor activities based on the location and season of the trip.
- Packing list: users can create and manage packing lists for their trips to ensure they have everything they need.
- Weather forecast: PackRat provides up-to-date weather forecasts for the trip location to help users prepare accordingly.
- User authentication: the app uses user authentication to ensure privacy and data security.

## Technologies used 💻

PackRat is built using the following modern technologies:

- **React Native + Expo**: Cross-platform mobile development with Expo Router
- **Next.js**: Server-side rendering for web applications (landing page and guides)
- **Hono.js**: Fast, lightweight web framework running on Cloudflare Workers
- **PostgreSQL + Drizzle ORM**: Type-safe database operations with Neon serverless database
- **Jotai + TanStack Query**: Modern state management and data fetching
- **AI SDK + OpenAI**: AI-powered features and content generation
- **Bun**: Fast JavaScript runtime and package manager
- **Biome**: Modern linting and formatting toolchain
- **TypeScript**: Full type safety across the entire stack
- **Tailwind CSS + NativeWind**: Utility-first styling for web and mobile
- **Mapbox**: Location data platform for mobile and web applications

## 🗂 Folder layout

The main folders are:

- **`apps/`** - Applications
  - `expo/` - React Native mobile app with Expo Router
  - `landing/` - Next.js landing page website
  - `guides/` - Next.js documentation and guides site

- **`packages/`** - Shared packages across apps
  - `api/` - Hono.js API server running on Cloudflare Workers
    - `provider` (all the providers that wrap the app, and some no-ops for Web.)
    - `api` - intended to be our services, but tRPC eliminated a lot of this need due to custom hooks. [mostly deprecated]
    - `assets` - images and branding
    - `auth` - auth provider and hook, currently set up for expo router auth. Once we have next js config done, will refactor to support next js auth somehow
    - `components` - built components from our primitive ui elements (root/packages/ui), and custom logic hooks (/hooks)
    - `config` - axios config, we have almost no axios needs with trpc. Once fully migrated away this will be removed.
    - `constants` - strings and arrays that don’t change
    - `context` - all react context stuff
    - `hooks` - custom hooks for logic and data fetching with trpc
    - `media` - media query in react native config
    - `public` - web only assets like favicon
    - `atoms` - jotai atoms for global state
    - `theme` - tracks dark and light mode theming logic and tamagui config
    - `utils` - utility functions that can be reused

## 🆕 Add new dependencies

### Mobile app dependencies

For React Native dependencies, install them in the Expo app:

```sh
cd apps/expo
bun add react-native-reanimated
```

### API dependencies

For API/server dependencies:

```sh
cd packages/api
bun add hono
```

### Web app dependencies

For Next.js apps (landing/guides):

```sh
cd apps/landing  # or apps/guides
bun add next
```

## Dependency management

Use ManypKG to check for dependency issues across the monorepo:

```sh
bun check:deps
bun fix:deps
```

## Local installation 📲

PackRat is a modern monorepo with mobile, web, and API applications. Follow the steps below to install and run the applications.

### Dependencies

- [Bun](https://bun.sh) - Primary package manager and runtime
- [Node.js](https://nodejs.org/) - Required for some tooling
- [Expo CLI](https://docs.expo.io/workflow/expo-cli/) - For mobile development
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) - For API deployment
- [GitHub CLI](https://cli.github.com/) - For authenticating with GitHub packages

### GitHub Packages Authentication

PackRat uses private packages from GitHub Package Registry. You need to authenticate to install dependencies:

#### Local Development

1. Install GitHub CLI:

   ```bash
   # macOS
   brew install gh

   # Windows
   winget install --id GitHub.cli

   # Linux - see https://github.com/cli/cli#installation
   ```

2. Authenticate with GitHub CLI:

   ```bash
   gh auth login
   ```

3. Add the `read:packages` scope to your authentication:

   ```bash
   gh auth refresh -h github.com -s read:packages
   ```

4. Dependencies will now install automatically:
   ```bash
   bun install
   ```

#### CI/CD

GitHub Actions automatically provides a `GITHUB_TOKEN` with the necessary permissions. No additional configuration is needed.

For other CI platforms, set the `GITHUB_TOKEN` environment variable with a personal access token that has `read:packages` scope.

### Environment Setup

1. Clone the repository:
   HTTPS:

```bash
git clone https://github.com/andrew-bierman/PackRat.git
```

SSH:

```bash
git clone git@github.com:andrew-bierman/PackRat.git
```

2. Navigate to the `PackRat` directory:

```
cd PackRat
```

3. Set up environment variables:

   This project uses a centralized environment configuration strategy. All environment variables are defined in a single source of truth (e.g., .env, env.ts, or similar) located at the root of the project.

   A .dev.vars file will be automatically generated for development tools.

   Run bun install to regenerate .dev.vars whenever environment variables are changed.

   Only variables prefixed with PUBLIC\_ will be bundled into the Expo app (e.g., PUBLIC_API_URL). These are safe to expose in the client environment.

   ⚠️ Do not include secrets (e.g., private API keys) in PUBLIC\_ variables — they may be exposed in the bundled app.

### Git Hooks Setup

PackRat uses Lefthook for git hooks to ensure code quality. The hooks are automatically installed when you run `bun install`.

- **Pre-push hook**: Runs `bun format` to check code formatting before pushing
- **Configuration**: See `lefthook.yml` in the root directory

If you need to skip hooks temporarily, use:

```bash
git push --no-verify
```

### Installation & Development

#### Install dependencies

From the root directory:

```bash
bun install
```

#### Running the applications

You can run each application independently:

**Mobile App (Expo):**

```bash
# Start Expo development server
bun expo

# Or run directly on device/simulator
bun android  # for Android
bun ios       # for iOS
```

**API Server:**

```bash
# Start API in development mode
bun api
```

**Landing Page:**

```bash
cd apps/landing
bun dev
```

**Guides Site:**

```bash
cd apps/guides
bun dev
```

#### Development workflow

For mobile development, you'll typically run:

```bash
# Terminal 1: Start the API
bun api

# Terminal 2: Start the mobile app
bun expo
```

### Debugging 🐛

#### Common Issues

**Expo/Mobile App Issues:**

```bash
# Doctor check for Expo setup
npx expo-doctor

# Fix dependencies
npx expo install --fix

# Clean build
npx expo prebuild --clean

# Clear cache
npx expo start --clear
```

**Dependency Issues:**

```bash
# Check monorepo dependencies
bun check:deps

# Fix dependency mismatches
bun fix:deps

# Clean and reinstall
bun clean
bun install
```

**API/Cloudflare Issues:**

- Check that your `wrangler.jsonc` is configured correctly in `packages/api/`
- Ensure your Cloudflare environment variables are set
- Use `bun api` to start the development server locally

## API Architecture

The PackRat API is built with:

- **Hono.js** - Fast, lightweight web framework
- **Cloudflare Workers** - Serverless edge computing platform
- **Drizzle ORM** - Type-safe database operations
- **PostgreSQL** - Database hosted on Neon
- **OpenAI integration** - AI-powered features

See `packages/api/` for the complete API implementation.

## Contributing 🤝

> [!TIP]
> We have an active community of contributors and users who are happy to help. Join us on Discord to get involved!

Contributions to PackRat are welcome! To contribute, follow these steps:

1. Clone this repository.
2. Create a new branch.
3. Make your changes and commit them.
4. Push your changes to the remote branch.
5. Open a pull request.
6. Wait for your pull request to be reviewed and merged.
7. Celebrate! 🎉

## User Stories:

<details>
<summary><b>User Stories 📖</b> (Click to expand)</summary>

## User Features:

### Registration and Authentication:

- Users can create an account by accessing the menu and selecting the 'Register' option. Additionally, they have the option to sign up directly from the login page.

### Main Dashboard:

- On the main page, users have several options to choose from:
- Quick actions
- Search for new trails
- Access other menu options
- View their feed, which displays previously created packs.
- Users can search for a destination directly on the main dashboard, which will then redirect them to the maps interface.

### Destination Search:

- Users have the capability to search for a destination directly on the main dashboard.
- Upon initiating a search, users are redirected to the maps interface for further exploration and planning.

### Accessing Profile Information:

- Users can conveniently access their profile information from the menu under the Profile feature.

### Profile User Overview:

- The dashboard provides users with a comprehensive overview of their profile.
- It prominently displays the user's username and account photo for quick identification.

### Favorite Trips and Packs:

- Users have immediate access to their favorite trips and packs directly from the dashboard.
- By selecting the "View details" option, users can delve into more details about their favorite trips and packs.

### Profile Management:

- Users can effortlessly manage their profile information from the dashboard.
- By clicking on the settings button icon, users are directed to the profile settings section where they can make necessary updates seamlessly.

### Appearance Theme Customization:

- Users have the option to personalize their experience by changing the theme.
- They can choose between light mode or dark mode based on their preference.
- Additionally, users have the option to purchase additional themes for further customization. (Note: This feature may require updates.)

### Profile Editing:

- Users can easily edit their profile settings by clicking the "show dialog" option.
- This allows them to update their name and “food preferences”, with a wide range of options to choose from. (Note: This feature may require updates.)

## Pack Features:

### Pack Creation and Access Settings:

- Users are prompted to input a name for their pack when creating it.
- Users have the option to choose the accessibility setting for their pack, deciding whether it will be public or private.

### Adding Items to Packs:

- When users add an item to the pack, they are required to provide:
- The name of the item.
- The weight of the item.
- The quantity of the item.
- The category the item belongs to (food, water, essentials).
- After providing the necessary details, users click "Add Item" to include it in the pack dashboard.

### Pack Scoring System:

- Users can view their pack score, which is generated based on several criteria:
- The total weight of the pack.
- The presence of essential items.
- The degree of redundancy in items.
- The versatility of the items included.

### Navigating to the Dashboard:

- Users can easily return to the dashboard by following these steps:

1. Access the menu.
2. Select the "Home" option.

## Trip Features:

### Trip Creation and Management:

- Users have two methods for creating a trip:
- Directly from the main page dashboard using the quick actions feature.
- By navigating to the 'Trips' option in the menu.

### Setting up a Trip:

- Users initiate trip setup by selecting their backpacking destination.
- Nearby trails and parks are displayed for exploration.
- Users can:
- Choose gear from their saved packs.
- Create a new pack and add items directly on the page.
- Select the target date for their trip using a calendar to specify the duration.
- A map showcasing the trip destination is provided for reference.
- Once all details are confirmed, users:
- Save their trip.
- Input a name and description.
- Choose the trip's accessibility setting (public or private).
- A weather forecast and summary of the destination, trails, dates, and trip duration are displayed for easy reference.

### Accessing Saved Trips:

- Users can easily access their saved trips from the menu by selecting the 'Trips' option.
- Within the 'Trips' section, users can:
- Organize their trips by sorting them from favorites to most recent.
- Utilize a search bar to quickly locate a specific trip by name.

### Viewing Trip Details:

- When users select a trip from the dashboard, they are presented with detailed information including:
- The trip's description.
- Destination.
- Start and end dates.
- Additionally, users can:
- Conveniently view the weather forecast for the selected dates directly on the same page.
- Access the maps interface for further exploration.
- At the bottom of the page, users can find the Trip Score, providing an overall assessment of the trip's suitability and preparedness.

## Items Feature:

### Dashboard:

- Users are able to view their items used in their saved packs.
- They can sort how many items will show up on screen. They can choose from 10, 20, and 50.
- Users have the option to add new items.

### Adding Items:

- User needs to fill out the following fields:
- Item Name
- Weight – they can choose the unit of measurement. Includes lb, kg, oz, and g.
- Quantity
- Category

## Feed Feature:

### Exploring Backpackers:

- Users can browse through a list of other backpackers.
- Navigate the page using the search and sort options.

### Pack List Interaction:

- Upon opening a pack list, users have several options available:
- They can view the profile of the backpacker associated with the pack.
- Users also have the ability to copy the pack list for their own use.
- The pack list includes detailed information such as item name, weight, quantity, and category.

### Item Management:

- Users can interact with items on the pack list by:
- Editing, deleting, or ignoring items as needed.
- The total weight of the pack is dynamically calculated and displayed at the bottom of the page.
- Users can easily add new items to the pack list as well.
- At the bottom of the page, users can view the Pack Score.

### Returning to Feed Dashboard:

- Users can navigate back to the feed dashboard by accessing the menu and selecting the "feed" option.

</details>

## 👏 Special Thanks

- [React Native Developers](https://twitter.com/reactnative)
- [OpenStreetMap Developers](https://www.openstreetmap.org/)
- [RN MapBox Developers](https://github.com/rnmapbox/maps)
- [Cloudflare Developers](https://twitter.com/CloudflareDev)
- [Yusuke Wada](https://twitter.com/yusukebe) - Creator of Hono.js
- [Nate Birdman](https://twitter.com/natebirdman) - Creator of Tamagui
- [Fernando Rojo](https://twitter.com/fernandotherojo) - Creator of Zeego
- [Tanner Linsley](https://twitter.com/tannerlinsley) - Creator of TanStack
- [Timothy Miller](https://twitter.com/ogtimothymiller) - Creator of T4 Stack
- [Expo Developers](https://twitter.com/expo) - Office hours
- [Shopify Developers](https://twitter.com/ShopifyDevs)

## License 📝

PackRat is licensed under the terms of the [GNU General Public License v3.0](LICENSE). See `LICENSE` for more information.
