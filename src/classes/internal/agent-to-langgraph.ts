/* eslint-disable @typescript-eslint/no-explicit-any -- Esse arquivo precisa de vários any */
import { z } from "zod";

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { CheckProcedure, Procedure } from "../procedure";
import { State } from "../state";

export class AgentToLanggraph<Input extends z.AnyZodObject, Output extends z.AnyZodObject> {
	private readonly stateBuilder: () => Record<string, any>;
	private readonly state: Record<string, any>;

	constructor(
		private readonly props: {
			llm: BaseChatModel;
			procedures: Procedure<State<Input, Output>["values"]>[];
			state: State<Input, Output>;
		},
	) {
		this.stateBuilder = () => {
			const inputKeys: [string, boolean][] = Object.keys(this.props.state.values.input).map(key => [
				`input_${key}`,
				Array.isArray(this.props.state.values.input[key]),
			]);
			const outputKeys: [string, boolean][] = Object.keys(this.props.state.values.output).map(key => [
				`output_${key}`,
				Array.isArray(this.props.state.values.output[key]),
			]);

			const object: Record<string, any> = {};

			for (const [key, isArray] of [...inputKeys, ...outputKeys]) {
				if (isArray) {
					object[key] = Annotation({
						default: () => [],
						reducer: (x, y) => x.concat(y),
					});
				} else {
					object[key] = Annotation();
				}
			}

			return object;
		};
		this.state = Annotation.Root(this.stateBuilder());
	}

	private describeProcedures() {
		const edges: Array<[string, CheckProcedure<State<Input, Output>["values"]>["run"] | string]> = [];

		if (this.props.procedures.length > 0) edges.push([START, this.props.procedures[0].name]);

		const procedureMap = new Map<string, Procedure<State<Input, Output>["values"]>>();
		for (const proc of this.props.procedures) procedureMap.set(proc.name, proc);

		for (let i = 0; i < this.props.procedures.length; i++) {
			const proc = this.props.procedures[i];
			if (proc.type !== "action") continue;

			if (proc.nextProcedure === END) edges.push([proc.name, END]);
			else if (proc.nextProcedure) {
				const next = procedureMap.get(proc.nextProcedure);
				// Se o próximo é "check" então o valor vai ser a função geradora do nome do próximo node
				if (next && next.type === "check") {
					edges.push([proc.name, next.run]);
				} else if (next && next.type === "action") {
					edges.push([proc.name, next.name]);
				} else {
					edges.push([proc.name, END]);
				}
			} else {
				const nextProc = this.props.procedures[i + 1];
				if (nextProc) edges.push([proc.name, nextProc.name]);
				else edges.push([proc.name, END]);
			}
		}

		return edges;
	}

	/**
	 * Gera o grafo de execucao LangGraph a partir das procedures e do estado do Agente.
	 * @returns Um grafo LangGraph compilado.
	 */
	build() {
		const graph = new StateGraph(this.state);

		// Define os nodes do grafo
		for (const procedure of this.props.procedures) {
			if (procedure.type === "action") {
				graph.addNode(procedure.name, async langgraphState => {
					const agentState = State.langgraphToValues(langgraphState);
					const values = await procedure.run(
						{
							...this.props.state.values,
							...agentState,
						},
						this.props.llm,
					);
					const newLanggraphState = State.valuesToLanggraph(values);
					return newLanggraphState;
				});
			}
		}

		// Define as edges do grafo
		const edges = this.describeProcedures();
		for (const [from, to] of edges) {
			if (typeof to === "string") {
				graph.addEdge(from as any, to as any);
				continue;
			}

			graph.addConditionalEdges(from as any, async langgraphState => {
				const agentState = State.langgraphToValues(langgraphState);
				const next = await to(
					{
						...this.props.state.values,
						...agentState,
					},
					this.props.llm,
				);
				return next || END;
			});
		}

		const compiled = graph.compile();
		return compiled;
	}
}
