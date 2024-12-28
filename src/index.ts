// import { writeFileSync } from "node:fs";
// import { z } from "zod";
import { Agent } from "./classes/agent";
import { State } from "./classes/state";

export { Agent, State };
export { ActionProcedure, CheckProcedure, Procedure } from "./classes/procedure";

// const agent = new Agent({
// 	state: new State({
// 		inputSchema: z.object({
// 			foo: z.string(),
// 		}),
// 		outputSchema: z.object({
// 			bar: z.string(),
// 		}),
// 	}),
// 	llm: undefined!,
// 	procedures: [
// 		{
// 			name: "proc1",
// 			type: "action",
// 			async run(state, llm) {
// 				return state;
// 			},
// 		},
// 		{
// 			name: "proc2",
// 			type: "action",
// 			async run(state, llm) {
// 				return state;
// 			},
// 		},
// 		{
// 			name: "proc3",
// 			type: "action",
// 			async run(state, llm) {
// 				return state;
// 			},
// 		},
// 	],
// });

// (async () => {
// 	const representation = await agent.graph.getGraphAsync();
// 	const image = await representation.drawMermaidPng();
// 	const arrayBuffer = await image.arrayBuffer();
// 	const buffer = new Uint8Array(arrayBuffer);
// 	writeFileSync("graph.png", buffer);
// })();
