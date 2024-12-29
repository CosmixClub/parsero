// import { writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

import { StringOutputParser } from "@langchain/core/output_parsers";
import { END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import { Agent, State } from ".";

dotenv.config();

const agent = new Agent({
	state: new State({
		inputSchema: z.object({
			number: z.number(),
		}),
		outputSchema: z.object({
			class: z.enum(["odd", "even"]),
			explanation: z.string(),
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
			name: "whatNumberIs",
			type: "action",
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
		},
		{
			name: "router",
			type: "check",
			async run(state) {
				const numberClass = state.output.class;
				if (numberClass === "odd") return "isOdd";
				return "isEven";
			},
		},
		{
			name: "isOdd",
			type: "action",
			nextProcedure: END,
			async run(state, llm) {
				const chain = llm.pipe(new StringOutputParser());
				const output = await chain.invoke(
					`Gere uma explicação do motivo de '${state.input.number}' ser ímpar.`,
				);
				state.output.explanation = output;
				return state;
			},
		},
		{
			name: "isEven",
			type: "action",
			nextProcedure: END,
			async run(state, llm) {
				const chain = llm.pipe(new StringOutputParser());
				const output = await chain.invoke(`Gere uma explicação do motivo de '${state.input.number}' ser par.`);
				state.output.explanation = output;
				return state;
			},
		},
	],
});

(async () => {
	const output = await agent.run({ number: 11 });
	console.log(output);
})();

// (async () => {
// 	const representation = await agent.graph.getGraphAsync();
// 	const image = await representation.drawMermaidPng();
// 	const arrayBuffer = await image.arrayBuffer();
// 	const buffer = new Uint8Array(arrayBuffer);
// 	writeFileSync("graph.png", buffer);
// })();
