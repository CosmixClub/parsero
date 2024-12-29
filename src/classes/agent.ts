import { z } from "zod";

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { ActionProcedure, Procedure } from "./procedure";
import { State } from "./state";

export class Agent<Input extends z.AnyZodObject, Output extends z.AnyZodObject> {
	private readonly _langgraphStateBuilder: () => Record<string, any>;
	private readonly _langgraphState: Record<string, any>;

	constructor(
		private readonly props: {
			state: State<Input, Output>;
			procedures: Procedure<State<Input, Output>["values"]>[];
			llm: BaseChatModel;
		},
	) {
		this._langgraphStateBuilder = () => {
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
						reducer: (x, y) => x.concat(y),
						default: () => [],
					});
				} else {
					object[key] = Annotation();
				}
			}

			return object;
		};
		this._langgraphState = Annotation.Root(this._langgraphStateBuilder());
	}

	private readonly _langgraphGraphBuilder = () => {
		const graph = new StateGraph(this._langgraphState);

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
		// ! Por enquanto há suporte apenas para execução sequencial
		let lastProcedureName: string | null = null;
		for (const procedure of this.props.procedures) {
			if (!lastProcedureName) {
				graph.addEdge(START, procedure.name as any);
				lastProcedureName = procedure.name;
				continue;
			}

			graph.addEdge(lastProcedureName as any, procedure.name as any);
			lastProcedureName = procedure.name;
		}
		graph.addEdge(lastProcedureName as any, END);

		const compiled = graph.compile();
		return compiled;
	};

	private validateProcedureNames() {
		const procedureNames = this.props.procedures.map(p => p.name);
		const duplicateNames = procedureNames.filter((name, index) => procedureNames.indexOf(name) !== index);
		if (duplicateNames.length > 0) throw new Error("Os nomes dos procedimentos devem ser distintos.");
	}

	private validateProcedureChain() {
		const hasCheckProcedure = this.props.procedures.some(p => p.type === "check");
		const allActionProceduresDeclareNext = this.props.procedures
			.filter(p => p.type === "action")
			.every(p => p.nextProcedure);

		if (hasCheckProcedure && !allActionProceduresDeclareNext) {
			throw new Error(
				"Quando houver um procedimento do tipo 'check', todos os procedimentos do tipo 'action' devem declarar o próximo procedimento.",
			);
		}
	}

	get graph() {
		return this._langgraphGraphBuilder();
	}

	async run(input: z.infer<Input>): Promise<z.infer<Output>> {
		const inputParsed = this.props.state.parseInput(input);
		if (!inputParsed.success) throw new Error("O input recebido não segue o schema.");
		this.props.state.setInput(inputParsed.data);

		this.validateProcedureNames();
		this.validateProcedureChain();

		// Cria um Map de procedures para se aproveitar da eficiência e popula o grafo
		const procedureMap = new Map<string, Procedure<State<Input, Output>["values"]>>();
		for (const proc of this.props.procedures) procedureMap.set(proc.name, proc);

		let currentProcedure: Procedure<State<Input, Output>["values"]> | null = this.props.procedures[0];

		while (currentProcedure) {
			if (currentProcedure.type === "action") {
				const values = await currentProcedure.run(this.props.state.values, this.props.llm);
				this.props.state.setInput(values.input);
				this.props.state.setOutput(values.output);

				if (currentProcedure.nextProcedure === END) break;

				// Caso a procedure de ação tenha nextProcedure definido pula para ele
				if (currentProcedure.nextProcedure) {
					const next = procedureMap.get(currentProcedure.nextProcedure);
					currentProcedure = next ?? null;
					continue;
				}

				// Caso a procedure de ação não tenha nextProcedure definido,
				// podemos simplesmente partir para a próxima procedure na lista
				const currentIndex = this.props.procedures.findIndex(p => p.name === currentProcedure?.name);
				const nextProc = this.props.procedures[currentIndex + 1];
				currentProcedure = nextProc ?? null;
			} else if (currentProcedure.type === "check") {
				// Procedures do tipo check devem retornar o nome do procedimento seguinte
				// Pegamos o nome e vamos até ele se existir. Se não existir, break
				const nextProcedure = await currentProcedure.run(this.props.state.values, this.props.llm);
				if (!nextProcedure || nextProcedure === END) break;
				const next = procedureMap.get(nextProcedure);
				currentProcedure = next ?? null;
			}
		}

		const outputParsed = this.props.state.parseOutput(this.props.state.values.output);
		if (!outputParsed.success) throw new Error("O output gerado não segue o schema.");
		return outputParsed.data;
	}
}
