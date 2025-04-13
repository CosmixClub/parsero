import { z } from "zod";

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { END } from "@langchain/langgraph";

import { ProcedureChainError } from "../errors/procedure-chain";
import { ProcedureNameError } from "../errors/procedure-name";
import { StateValidationError } from "../errors/state-validation";
import { AgentToLanggraph } from "./internal/agent-to-langgraph";
import { Procedure } from "./procedure";
import { State } from "./state";

/**
 * Representa um agente de IA que processa uma sequência de {@link Procedure|Procedures}.
 *
 * A classe `Agent` é responsável por receber um estado, um conjunto de `Procedure`
 * e um modelo de linguagem (LLM), para então executar passos (Procedures) de forma
 * sequencial ou customizada (usando `nextProcedure` e/ou `CheckProcedure`). Existem dois tipos principais de `Procedure`:
 *
 * - **ActionProcedure**: Recebe e **altera** o estado do agente, realizando mutações
 *   e computações necessárias.
 * - **CheckProcedure**: Recebe o estado do agente, **não o altera**, e retorna um
 *   **nome** de próxima procedure que será executada.
 *
 * @template Input - Schema Zod para o estado de entrada
 * @template Output - Schema Zod para o estado de saída
 */
export class Agent<Input extends z.AnyZodObject, Output extends z.AnyZodObject> {
	constructor(
		private readonly props: {
			/**
			 * Modelo de linguagem que será utilizado pelas procedures. Deve ser um `ChatModel` do LangChain.
			 *
			 * @see {@link https://js.langchain.com/docs/concepts/chat_models} Saiba mais sobre `ChatModel` do LangChain.
			 *
			 * @example
			 * new ChatOpenAI()
			 * new ChatGoogleGenerativeAI()
			 *
			 */
			llm: BaseChatModel;

			/**
			 * Opções adicionais
			 */
			options?: {
				/**
				 * Número máximo de iterações para evitar loops infinitos. Padrão: 100 iterações (use `Infinity` para desabilitar o limite)
				 */
				maxIterations?: number;

				/**
				 * Se `true`, habilita logs de execução
				 */
				verbose?: boolean;
			};

			/**
			 * Lista de {@link Procedure} que serão executadas pelo agente
			 */
			procedures: Procedure<State<Input, Output>["values"]>[];

			/**
			 * Instância de {@link State} que contém os schemas de entrada/saída e o estado do agente
			 */
			state: State<Input, Output>;
		},
	) {}

	/**
	 * Verifica se todos os nomes de procedures são únicos, lançando um erro caso haja duplicados.
	 *
	 * @throws {ProcedureNameError} - Se forem detectados nomes duplicados.
	 * @private
	 */
	private validateProcedureNames() {
		const procedureNames = this.props.procedures.map(p => p.name);
		const duplicateNames = procedureNames.filter((name, index) => procedureNames.indexOf(name) !== index);
		if (duplicateNames.length > 0) {
			throw new ProcedureNameError("Os nomes dos procedimentos devem ser distintos.", duplicateNames);
		}
	}

	/**
	 * Verifica a consistência da cadeia de procedures:
	 * 1. Se existe ao menos uma procedure do tipo `check`.
	 * 2. Se todas as procedures do tipo `action` que fazem parte de uma cadeia
	 *    com `check` declaram o `nextProcedure`.
	 *
	 * @throws {ProcedureChainError} - Se for detectada inconsistência na declaração de procedures.
	 * @private
	 */
	private validateProcedureChain() {
		const hasCheckProcedure = this.props.procedures.some(p => p.type === "check");
		const allActionProceduresDeclareNext = this.props.procedures
			.filter(p => p.type === "action")
			.every(p => p.nextProcedure);

		if (hasCheckProcedure && !allActionProceduresDeclareNext) {
			throw new ProcedureChainError(
				"Quando houver um procedimento do tipo 'check', todos os procedimentos do tipo 'action' devem declarar o próximo procedimento.",
			);
		}
	}

	/**
	 * Retorna o grafo do agente usando o LangGraph. Útil para casos de uso mais complexos
	 * que a biblioteca não forneça suporte nativo.
	 *
	 * @see {@link https://langchain-ai.github.io/langgraphjs/} Saiba mais sobre o LangGraph na documentação oficial.
	 *
	 * @returns `StateGraph` compilado do LangGraph baseado nas procedures e no estado do agente.
	 */
	get graph() {
		const langgraph = new AgentToLanggraph({
			llm: this.props.llm,
			procedures: this.props.procedures,
			state: this.props.state,
		});
		return langgraph.build();
	}

	/**
	 * Executa o agente, processando as {@link Procedure|Procedures} até chegar em um fim.
	 *
	 * 1. Faz o parse do input inicial de acordo com o schema de entrada.
	 * 2. Valida a lista e a cadeia de procedures.
	 * 3. Executa cada procedure (action ou check) em loop até atingir um `END` ou o fim da lista.
	 * 4. Faz o parse do output final de acordo com o schema de saída.
	 *
	 * @param input - Dados de entrada que seguem o schema definido em `State`.
	 * @returns Dados de saída que seguem o schema definido em `State`.
	 * @throws {StateValidationError} - Caso o input ou o output não siga o schema.
	 * @throws {ProcedureChainError} - Caso a cadeia de procedures ultrapassar o número máximo de iterações.
	 */
	async run(input: z.infer<Input>): Promise<z.infer<Output>> {
		const inputParsed = this.props.state.parseInput(input);
		if (!inputParsed.success) throw new StateValidationError("O input recebido não segue o schema.");
		this.props.state.setInput(inputParsed.data);

		this.validateProcedureNames();
		this.validateProcedureChain();

		// Cria um Map de procedures para se aproveitar da eficiência e popula o grafo
		const procedureMap = new Map<string, Procedure<State<Input, Output>["values"]>>();
		for (const proc of this.props.procedures) procedureMap.set(proc.name, proc);

		let currentProcedure: null | Procedure<State<Input, Output>["values"]> = this.props.procedures[0];
		let iteration = 0;

		while (currentProcedure) {
			if (iteration++ >= (this.props.options?.maxIterations || 100)) {
				throw new ProcedureChainError(
					`O agente atingiu o limite máximo de ${this.props.options?.maxIterations || 100} iterações. Possível loop detectado no grafo.`,
				);
			}

			if (this.props.options?.verbose) console.log(`[Agente] Iteração ${iteration}: ${currentProcedure.name}`);

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
		if (!outputParsed.success) throw new StateValidationError("O output gerado não segue o schema.");
		return outputParsed.data;
	}
}
