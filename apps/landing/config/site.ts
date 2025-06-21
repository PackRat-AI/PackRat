import type {
	NavItem,
	Feature,
	Step,
	Testimonial,
	FaqItem,
	SocialLink,
	Integration,
} from "@/types/site";

export const siteConfig = {
	name: "PackRat",
	description:
		"Your ultimate outdoor adventure companion. Plan, pack, and explore with confidence.",
	url: "https://getpackrat.com",
	ogImage: "/og-image.jpg",
	author: "PackRat Team",
	twitterHandle: "@getpackrat",
	keywords: [
		"outdoor",
		"adventure",
		"hiking",
		"camping",
		"backpacking",
		"trail maps",
		"packing list",
		"hiking app",
		"outdoor planning",
	],

	// Color scheme
	colors: {
		primary: "#0F766E", // Teal
		primaryLight: "#14B8A6", // Light teal
		primaryDark: "#0D9488", // Dark teal
		secondary: "#F97316", // Orange
		secondaryLight: "#FB923C", // Light orange
		secondaryDark: "#EA580C", // Dark orange
		tertiary: "#8B5CF6", // Purple
		tertiaryLight: "#A78BFA", // Light purple
		dark: "#1E293B", // Slate 800
		darkAlt: "#0F172A", // Slate 900
		light: "#F8FAFC", // Slate 50
		lightAlt: "#F1F5F9", // Slate 100
		textPrimary: "#0F172A", // Slate 900
		textSecondary: "#475569", // Slate 600
		textTertiary: "#94A3B8", // Slate 400
		gradientPrimary: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
		gradientSecondary: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
		gradientTertiary: "linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)",
		gradientDark: "linear-gradient(135deg, #1E293B 0%, #334155 100%)",
		gradientMesh:
			"radial-gradient(at 67% 33%, hsla(162, 77%, 40%, 0.15) 0px, transparent 50%), radial-gradient(at 33% 67%, hsla(23, 100%, 50%, 0.15) 0px, transparent 50%), radial-gradient(at 80% 80%, hsla(242, 100%, 70%, 0.15) 0px, transparent 50%), radial-gradient(at 0% 0%, hsla(343, 100%, 76%, 0.15) 0px, transparent 50%)",
	},

	// Navigation
	mainNav: [
		{
			title: "Features",
			href: "#features",
		},
		{
			title: "How It Works",
			href: "#how-it-works",
		},
		{
			title: "Integrations",
			href: "#integrations",
		},
		{
			title: "Testimonials",
			href: "#testimonials",
		},
		{
			title: "FAQ",
			href: "#faq",
		},
	] as NavItem[],

	// CTAs
	cta: {
		primary: {
			text: "Download Now",
			href: "#download",
		},
		secondary: {
			text: "Learn More",
			href: "#features",
		},
	},

	// Hero section
	hero: {
		badge: "Your outdoor adventure companion",
		title: "Pack smarter. Adventure further.",
		subtitle:
			"Never forget essential gear again. PackRat helps you plan, organize, and track your outdoor adventures with ease.",
		image: "/hero-app-preview.png",
		stats: [
			{
				value: "10K+",
				label: "Active Users",
			},
			{
				value: "4.8",
				label: "App Store Rating",
			},
			{
				value: "500+",
				label: "Trails Mapped",
			},
		],
	},

	// Features section
	features: [
		{
			id: "packing-lists",
			title: "Smart Packing Lists",
			description:
				"Create and customize packing lists based on trip type, duration, and weather conditions.",
			icon: "CheckSquare",
			color: "#0F766E",
			image: "/feature-packing-list.png",
		},
		{
			id: "trail-maps",
			title: "Trail Maps & Navigation",
			description:
				"Access offline trail maps and navigation to stay on track even without cell service.",
			icon: "Map",
			color: "#F97316",
			image: "/feature-trail-maps.png",
		},
		{
			id: "trip-planning",
			title: "Trip Planning",
			description:
				"Plan routes, set waypoints, and estimate hiking times with our advanced planning tools.",
			icon: "Compass",
			color: "#8B5CF6",
			image: "/feature-trip-planning.png",
		},
		{
			id: "recommendations",
			title: "Trail Recommendations",
			description:
				"Discover new trails and adventures based on your preferences and experience level.",
			icon: "Mountain",
			color: "#EC4899",
			image: "/feature-recommendations.png",
		},
		{
			id: "weather",
			title: "Weather Integration",
			description:
				"Get real-time weather forecasts for your planned routes to prepare accordingly.",
			icon: "Cloud",
			color: "#3B82F6",
			image: "/feature-weather.png",
		},
		{
			id: "offline",
			title: "Offline Access",
			description:
				"Access all your trip information offline when you're out in the wilderness.",
			icon: "Download",
			color: "#10B981",
			image: "/feature-offline.png",
		},
	] as Feature[],

	// How it works section
	howItWorks: {
		title: "How PackRat Works",
		subtitle:
			"Getting started is simple. Download the app and be ready for your next adventure in minutes.",
		steps: [
			{
				number: 1,
				title: "Download the App",
				description:
					"Get PackRat from the App Store or Google Play Store and create your account.",
				image: "/step-download.png",
			},
			{
				number: 2,
				title: "Plan Your Trip",
				description:
					"Create a new trip, select your destination, and set your adventure dates.",
				image: "/step-plan.png",
			},
			{
				number: 3,
				title: "Pack & Explore",
				description:
					"Use your customized packing list and hit the trails with confidence.",
				image: "/step-explore.png",
			},
		] as Step[],
	},

	// Integrations section
	integrations: {
		title: "Seamless Integrations",
		subtitle:
			"PackRat connects with your favorite outdoor and weather services for a complete experience.",
		items: [
			{
				id: "weather",
				name: "Weather Services",
				description: "Real-time weather data from multiple providers",
				icon: "Cloud",
				color: "#3B82F6",
			},
			{
				id: "maps",
				name: "Trail Databases",
				description: "Access thousands of trails and routes",
				icon: "Map",
				color: "#F97316",
			},
			{
				id: "health",
				name: "Health Apps",
				description: "Sync with Apple Health and Google Fit",
				icon: "Heart",
				color: "#EC4899",
			},
			{
				id: "calendar",
				name: "Calendar",
				description: "Sync trips with your calendar",
				icon: "Calendar",
				color: "#8B5CF6",
			},
			{
				id: "sharing",
				name: "Social Sharing",
				description: "Share trips and routes with friends",
				icon: "Share2",
				color: "#10B981",
			},
			{
				id: "emergency",
				name: "Emergency Services",
				description: "Quick access to emergency contacts",
				icon: "AlertTriangle",
				color: "#EF4444",
			},
		] as Integration[],
	},

	// Testimonials section
	testimonials: {
		title: "What Adventurers Are Saying",
		subtitle:
			"Join thousands of outdoor enthusiasts who trust PackRat for their adventures.",
		items: [
			{
				id: 1,
				name: "Mike Thompson",
				role: "Backpacker",
				content:
					"PackRat has completely changed how I prepare for hikes. I used to always forget something important, but not anymore! The weather integration is particularly useful for planning multi-day trips.",
				initials: "MT",
				avatar: "/avatar-mike.jpg",
				rating: 5,
			},
			{
				id: 2,
				name: "Sarah Linden",
				role: "Trail Runner",
				content:
					"The offline maps feature saved me when I lost cell service on a remote trail. This app is a must-have for any outdoor enthusiast. I love how I can track my routes and share them with friends.",
				initials: "SL",
				avatar: "/avatar-sarah.jpg",
				rating: 5,
			},
			{
				id: 3,
				name: "James Rodriguez",
				role: "Weekend Camper",
				content:
					"As someone who camps occasionally, the smart packing lists are perfect. They suggest exactly what I need without overwhelming me. The interface is intuitive and the recommendations are spot-on.",
				initials: "JR",
				avatar: "/avatar-james.jpg",
				rating: 4,
			},
			{
				id: 4,
				name: "Emily Chen",
				role: "Hiking Guide",
				content:
					"I use PackRat to plan trips for my guided hiking groups. The ability to share packing lists and routes with clients beforehand has made my job so much easier. Highly recommended for professionals!",
				initials: "EC",
				avatar: "/avatar-emily.jpg",
				rating: 5,
			},
		] as Testimonial[],
	},

	// Download section
	download: {
		title: "Ready for your next adventure?",
		subtitle:
			"Download PackRat today and start planning your outdoor journeys with confidence.",
		appStoreLink: "#app-store",
		googlePlayLink: "#google-play",
		image: "/download-app-preview.png",
		features: [
			"Free basic version",
			"Premium features from $4.99/month",
			"7-day free trial",
			"Cancel anytime",
		],
	},

	// FAQ section
	faqs: [
		{
			question: "Is PackRat free to use?",
			answer:
				"PackRat offers a free version with basic features. Premium features are available with a subscription for $4.99/month or $39.99/year.",
		},
		{
			question: "Does PackRat work offline?",
			answer:
				"Yes! Once you've downloaded your trip information, you can access your packing lists, maps, and routes without an internet connection.",
		},
		{
			question: "Which devices is PackRat available on?",
			answer:
				"PackRat is available for iOS and Android devices. A web version is coming soon!",
		},
		{
			question: "How accurate are the trail maps?",
			answer:
				"Our maps are regularly updated and include data from trusted sources like USGS, OpenStreetMap, and user contributions. However, we always recommend carrying a physical map as backup.",
		},
		{
			question: "Can I share my trips with friends?",
			answer:
				"Yes! PackRat makes it easy to share your planned routes, packing lists, and trip details with friends and family.",
		},
		{
			question: "How does the weather integration work?",
			answer:
				"PackRat connects to multiple weather services to provide accurate forecasts for your specific trail and time period. The app will alert you to any significant weather changes before and during your trip.",
		},
	] as FaqItem[],

	// Footer links
	footerLinks: {
		product: [
			{ title: "Features", href: "#features" },
			{ title: "Integrations", href: "#integrations" },
			{ title: "Updates", href: "#" },
		],
		company: [
			{ title: "About", href: "#" },
			{ title: "Blog", href: "#" },
			{ title: "Careers", href: "#" },
			{ title: "Contact", href: "#" },
		],
		legal: [
			{ title: "Terms", href: "#" },
			{ title: "Privacy", href: "/privacy-policy" },
			{ title: "Cookies", href: "#" },
			{ title: "Licenses", href: "#" },
		],
	},

	// Social links
	social: [
		{
			name: "Twitter",
			href: "#",
			icon: "Twitter",
		},
		{
			name: "Instagram",
			href: "#",
			icon: "Instagram",
		},
		{
			name: "Facebook",
			href: "#",
			icon: "Facebook",
		},
	] as SocialLink[],
};
