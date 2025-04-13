import dotenv from "dotenv";
// import { writeFileSync } from "node:fs";
import { z } from "zod";

import { StringOutputParser } from "@langchain/core/output_parsers";
import { END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import { Agent, State } from ".";

dotenv.config();

const agent = new Agent({
	llm: new ChatOpenAI({
		apiKey: process.env.OPENAI_API_KEY,
		cache: true,
		maxTokens: 500,
		model: "gpt-4o-mini",
		streaming: true,
		temperature: 0.1,
	}),
	options: {
		verbose: true,
	},
	procedures: [
		{
			name: "whatNumberIs",
			nextProcedure: "router",
			async run(state, llm) {
				const chain = llm.withStructuredOutput(
					z.object({
						class: z.enum(["odd", "even"]).describe("Se o número é par ou ímpar"),
					}),
				);
				const output = await chain.invoke(
					`Determine se o número a seguir é par ou ímpar: ${state.input.number}`,
				);
				state.output.class = output.class;
				return state;
			},
			type: "action",
		},
		{
			name: "router",
			async run(state) {
				const numberClass = state.output.class;
				if (numberClass === "odd") return "isOdd";
				return "isEven";
			},
			type: "check",
		},
		{
			name: "isOdd",
			nextProcedure: END,
			async run(state, llm) {
				const chain = llm.pipe(new StringOutputParser());
				const output = await chain.invoke(
					`Gere uma explicação do motivo de '${state.input.number}' ser ímpar.`,
				);
				state.output.explanation = output;
				return state;
			},
			type: "action",
		},
		{
			name: "isEven",
			nextProcedure: END,
			async run(state, llm) {
				const chain = llm.pipe(new StringOutputParser());
				const output = await chain.invoke(`Gere uma explicação do motivo de '${state.input.number}' ser par.`);
				state.output.explanation = output;
				return state;
			},
			type: "action",
		},
	],
	state: new State({
		inputSchema: z.object({
			number: z.number(),
		}),
		outputSchema: z.object({
			class: z.enum(["odd", "even"]),
			explanation: z.string(),
		}),
	}),
});

(async () => {
	const output = await agent.run({ number: 11 });
	console.log(output.explanation);
})();

// (async () => {
// 	const representation = await agent.graph.getGraphAsync();
// 	const image = await representation.drawMermaidPng();
// 	const arrayBuffer = await image.arrayBuffer();
// 	const buffer = new Uint8Array(arrayBuffer);
// 	writeFileSync("graph.png", buffer);
// })();
