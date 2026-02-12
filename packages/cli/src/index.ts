import { defineCommand, runMain } from "citty";

const main = defineCommand({
	meta: {
		name: "sb",
		version: "0.1.0",
		description: "Swarmboard CLI \u2014 agent swarm coordination",
	},
	subCommands: {
		board: () => import("./commands/board").then((m) => m.default),
		list: () => import("./commands/list").then((m) => m.default),
		show: () => import("./commands/show").then((m) => m.default),
		add: () => import("./commands/add").then((m) => m.default),
		edit: () => import("./commands/edit").then((m) => m.default),
		claim: () => import("./commands/claim").then((m) => m.default),
		unclaim: () => import("./commands/unclaim").then((m) => m.default),
		done: () => import("./commands/done").then((m) => m.default),
		comment: () => import("./commands/comment").then((m) => m.default),
		agents: () => import("./commands/agents").then((m) => m.default),
		init: () => import("./commands/init").then((m) => m.default),
		export: () => import("./commands/export").then((m) => m.default),
		log: () => import("./commands/log").then((m) => m.default),
	},
});

runMain(main);
