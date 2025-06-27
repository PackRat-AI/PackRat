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
>
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

PackRat is built using the following technologies:

- React Native: a JavaScript library for building user interfaces.
- Expo: a set of tools and services for building and deploying React Native applications.
- MongoDB: a document-oriented database program.
- Express.js: a web application framework for Node.js.
- Node.js: an open-source, cross-platform, back-end JavaScript runtime environment.
- Redux: a predictable state container for JavaScript apps.
- Mapbox: a location data platform for mobile and web applications.

## 🗂 Folder layout

The main folders are:

- `apps`
  - `expo` (native)
  - `next` (web) -- ssr not yet implemented
  - `vite` (web)
  - `tauri` (desktop) -- not yet implemented

- `packages` shared packages across apps
  - `ui` includes your custom UI kit that will be optimized by Tamagui
  - `app` you'll be importing most files from `app/`
    - `features` (don't use a `screens` folder. organize by feature.) [pending]
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

## UI Kit

Note we're following the [design systems guide](https://tamagui.dev/docs/guides/design-systems) and creating our own package for components.

See `packages/ui` named `@packrat/ui` for how this works.

## 🆕 Add new dependencies

### Pure JS dependencies

If you're installing a JavaScript-only dependency that will be used across platforms, install it in `packages/app`:

```sh
cd packages/app
yarn add date-fns
cd ../..
yarn
```

### Native dependencies

If you're installing a library with any native code, you must install it in `expo`:

```sh
cd apps/expo
yarn add react-native-reanimated
cd ..
yarn
```

## Update new dependencies

### Pure JS dependencies

```sh
yarn upgrade-interactive
```

You can also install the native library inside of `packages/app` if you want to get autoimport for that package inside of the `app` folder. However, you need to be careful and install the _exact_ same version in both packages. If the versions mismatch at all, you'll potentially get terrible bugs. This is a classic monorepo issue. I use `lerna-update-wizard` to help with this (you don't need to use Lerna to use that lib).

You may potentially want to have the native module transpiled for the next app. If you get error messages with `Cannot use import statement outside a module`, you may need to use `transpilePackages` in your `next.config.js` and add the module to the array there.

## Local installation 📲

PackRat consists of two main components: a client and a server. Follow the steps below to install and run both components.

### Dependencies

- [Node.js](https://nodejs.org/en/)
- [Yarn](https://classic.yarnpkg.com/en/docs/install)
- [Expo CLI](https://docs.expo.io/workflow/expo-cli/)
- [React Native CLI](https://reactnative.dev/docs/environment-setup)

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

3. Set up the environment variables for the client and server.
   - If you have access to the development env values, use those. Otherwise, replace the values with your own.
   - See the `.env.example` file in the root directory for the required environment variables. You can duplicate this file and rename it to `.env.local` to set up your environment variables.
   - Note, for the replacement steps, these replaced values should now be strings with the mapbox secret key for download token, in the following format:
```
"sk..."
```

#### Automated Setup (Unix) 🛠️

1. Run the setup script from the `PackRat` directory.
```
yarn setup
```

#### Manual Setup 📝
- Note, if automated set up works the following manual config is taken care of already.

1. Navigate to the `PackRat` directory if you are not already there.

2. Copy the `.env.example` file and rename it to `.env.local`.
   - Open the file and replace the values with your own or use the development env values.
   - Note, there is a postinstall script that will copy the .env.local file to the client directories, adding the necessary environment variables with prefixes.

```
cp .env.example .env.local
```

3.  Navigate to the `server` directory.

```
cd server
```

4.  Duplicate the `.wrangler.toml.example` file and rename it to `wrangler.toml`. Open the file and replace the values with your own.
        - If you have access to the development wrangler file, skip this step. Otherwise, replace the values with your own.

```
cp .wrangler.toml.example wrangler.toml
```

5.  Navigate back to the `PackRat` directory.

```
cd ..
```

### Yarn Setup

Recommended to open two terminal windows.

#### Root

1.  From the main`PackRat` directory.

```
yarn install
```


#### Server

1. Navigate to the `server` directory.

```
cd server
```

2. Start the server.

```
yarn start
```

#### Client

- Note, we have a few options for running the client.
  - For native we support both iOS and Android. You can run the app on either platform. Additionally, we support MacOS, Linux, and Windows for the desktop app with Tauri.
  - For web, we are using Next.js for server-side rendering. (This is not yet implemented.) We also have a Vite build that provides a faster development experience.

1. Navigate to the `expo` directory.

```
cd apps/expo
```
- Here you will be able to run the app on an iOS or Android simulator (or on your own device). See the [Expo documentation](https://docs.expo.io/get-started/installation/) for more information on how to set up your development environment.
- If it is your first time running the app, you may need to build the app using the following command.

```
yarn run ios
```
```
yarn run android
```

2. Navigate to the `next` directory.

```
cd apps/next
```

3. Navigate to the `vite` directory.

```
cd apps/vite
```

4. Start the Expo/Next/Vite server.

```
yarn start
```
Note that the client and server are designed to run concurrently in development mode.



### Debugging 🐛

#### Debugging Yarn Environment Setup - Windows

**Check yarn and node version:**
```
yarn -v
```
```
node -v
```

**If node version < 18.0.0:**
- Update to latest: https://nodejs.org/en/download

**If yarn version >= 4.0.0:**
- Skip this process

**If you don't have yarn installed:**
- Run command prompt as an administrator
- Run `(corepack comes along with node js 18+)`
  ```
  corepack enable
  ```
- Run
  ```
  yarn set version stable
  ```
- Run
  ```
  yarn install
  ```
- Check yarn version(`yarn -v`): *version >= 4.0.2*
- Restart your code editor if opened

**If yarn version < 4.0.0:**
- Make sure you're using Node 18+
- Go to your windows root path  (`C:\Users\HP)`
- Delete any `.yarnrc.yml` file and `.yarn` folder
- Delete `yarn` folder from `C:\Program Files (x86)`
- Run command prompt as an administrator
- Run `(corepack comes along with node js 18+)`
  ```
  corepack enable
  ```
- Go into the project directory `cd \PackRat`
- Run
  ```
  yarn set version stable
  ```
- Run
  ```
  yarn install
  ```
- Restart your code editor if opened
- If you any encounter errors, try restarting your system.

#### Debugging Client Environment Setup 🐛
##### Expo
- If you encounter any issues with the Expo client, try running the following commands:
- ```
  npx expo-doctor
  ```
- ```
  npx expo install --fix
  ```
- ```
  npx expo prebuild --clean
  ```
- ```
  npx expo run:ios --no-build-cache
- ```
  npx expo start --clear
  ```

##### Debugging Dependencies
- If you encounter issues with dependencies, try running the following commands from root directory:
- ```
  yarn regen
  ```
- ```
  yarn clean
  ```

Additionally, if the error is occurring in nextjs that you check the transpilePackages in next.config.js and check if the problematic package is there.

##### Debugging Cloudflare Wrangler and D1
- Some helpful tips for debugging Cloudflare Wrangler and D1:
- If you encounter issues with Wrangler or D1, make sure you can see the sqlite database in the .wrangler directory.
- You can open the database with a sqlite browser to see if the data is being stored correctly.

## Docker Installation 🐳 [Experimental]

PackRat can also be installed using Docker. After setting up the development environment, follow the steps below to install and run the app using Docker.

### Dependencies

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation

1. Run the following command to start the app

```
docker-compose build
docker-compose up
```

2. Navigate to `http://localhost:8081/` to view the app. The server will be running on `http://localhost:3000/`.
3. If you encounter errors with edits to files not automatically applying, try running the following commands:

```
docker-compose down
docker-compose build
docker-compose up
```

3. To stop the app, run the following command:

```
docker-compose down
```

4. If you encounter issues with docker-compose, you can build the images manually by running the following commands from the root folder:

```
docker build -t packrat-client client/Dockerfile
docker build -t packrat-server server/Dockerfile
```

5. To run the images, run the following commands:

```
docker run -p 8081:8081 packrat-client
docker run -p 3000:3000 packrat-server
```

## How backend API's are setup
Please refer to README.md inside server folder.

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
- [Expo Developers](https://twitter.com/expo) - Office hours
- [Shopify Developers](https://twitter.com/ShopifyDevs)

## License 📝

PackRat is licensed under the terms of the [GNU General Public License v3.0](LICENSE). See `LICENSE` for more information.