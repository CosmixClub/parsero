// import { writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";

import { Agent, State } from ".";

dotenv.config();

const agent = new Agent({
	state: new State({
		inputSchema: z.object({
			name: z.string(),
		}),
		outputSchema: z.object({
			message: z.string(),
		}),
	}),
	llm: new ChatOpenAI({
		model: "gpt-4o-mini",
		temperature: 0.1,
		maxTokens: 500,
		streaming: true,
		cache: true,
		apiKey: process.env.OPENAI_API_KEY,
	}),
	procedures: [
		{
			name: "generate",
			type: "action",
			async run(state, llm) {
				const chain = llm.pipe(new StringOutputParser());
				const output = await chain.invoke(`Gere uma mensagem de feliz aniversário para ${state.input.name}`);
				state.output.message = output;
				return state;
			},
		},
	],
});

(async () => {
	const output = await agent.run({ name: "Joaquim" });
	console.log(output);
})();

// (async () => {
// 	const representation = await agent.graph.getGraphAsync();
// 	const image = await representation.drawMermaidPng();
// 	const arrayBuffer = await image.arrayBuffer();
// 	const buffer = new Uint8Array(arrayBuffer);
// 	writeFileSync("graph.png", buffer);
// })();
