export type WeightUnit = "g" | "kg" | "oz" | "lb";

export interface PackItem {
	id: string;
	name: string;
	description?: string;
	weight: number;
	weightUnit: WeightUnit;
	quantity: number;
	category?: string;
	consumable: boolean;
	worn: boolean;
	notes?: string;
	image?: string | null;
	packId: string;
	catalogItemId?: string;
	userId?: string;
	deleted: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface PackItemInput {
	name: string;
	description?: string;
	weight: number;
	weightUnit: WeightUnit;
	quantity: number;
	category?: string;
	consumable: boolean;
	worn: boolean;
	notes?: string;
	image?: string | null;
	catalogItemId?: string;
}

export type PackCategory =
	| "hiking"
	| "backpacking"
	| "camping"
	| "climbing"
	| "winter"
	| "desert"
	| "water sports"
	| "skiing"
	| "custom";

export type Weight = {
	value: number;
	unit: string;
};

export interface PackItemCategory {
	items: number;
	name: string;
	weight: Weight;
	percentage: number;
}

export interface Pack {
	id: string;
	name: string;
	description?: string;
	category: PackCategory;
	userId?: string;
	isPublic: boolean;
	image?: string;
	tags?: string[];
	items: PackItem[];
	baseWeight: number;
	totalWeight: number;
	deleted: boolean;
	localCreatedAt: string;
	localUpdatedAt: string;
	createdAt?: string;
	updatedAt?: string;
}

export type PackInStore = Omit<Pack, "items" | "baseWeight" | "totalWeight">;

export type PackInput = Omit<
	PackInStore,
	| "id"
	| "userId"
	| "deleted"
	| "createdAt"
	| "updatedAt"
	| "localCreatedAt"
	| "localUpdatedAt"
>;

export interface PackWeightHistoryEntry {
	id: string;
	packId: string;
	weight: number;
	localCreatedAt: string;
}
