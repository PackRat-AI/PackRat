import type { ReactNode } from "react";

interface FeatureCardProps {
	icon: ReactNode;
	title: string;
	description: string;
}

export default function FeatureCard({
	icon,
	title,
	description,
}: FeatureCardProps) {
	return (
		<div className="rounded-xl bg-white p-6 shadow-md transition-all hover:shadow-lg hover:-translate-y-1">
			<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#3e6c50]/10">
				{icon}
			</div>
			<h3 className="mb-2 text-xl font-bold text-[#2a2a29]">{title}</h3>
			<p className="text-[#5a5a58]">{description}</p>
		</div>
	);
}
