import { KVMap } from "langsmith/schemas";
import { traceable } from "langsmith/traceable";
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
 * Tipo base que define o que um modelo de linguagem (LLM) deve ser.
 * Pode ser um BaseChatModel ou um objeto com chaves sendo os nomes dos modelos
 * e os valores sendo instâncias de BaseChatModel.
 */
export type LLMTypeBase = BaseChatModel | Record<string, BaseChatModel>;

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
 * @template LLMType - Tipo específico do modelo de linguagem (inferido automaticamente)
 */
export class Agent<
	Input extends z.AnyZodObject,
	Output extends z.AnyZodObject,
	LLMType extends LLMTypeBase = BaseChatModel,
> {
	constructor(
		private readonly props: {
			/**
			 * Modelo de linguagem que será utilizado pelas procedures. Pode ser um `ChatModel` do LangChain
			 * ou um objeto mapeando nomes para modelos.
			 *
			 * @see {@link https://js.langchain.com/docs/concepts/chat_models} Saiba mais sobre `ChatModel` do LangChain.
			 *
			 * @example
			 * // Modelo único
			 * new ChatOpenAI()
			 *
			 * // Mapa de modelos
			 * {
			 *   "default": new ChatOpenAI(),
			 *   "summarize": new ChatGoogleGenerativeAI()
			 * }
			 */
			llm: LLMType;

			/**
			 * Opções adicionais
			 */
			options?: {
				/**
				 * Número máximo de iterações para evitar loops infinitos. Padrão: 100 iterações (use `Infinity` para desabilitar o limite)
				 */
				maxIterations?: number;

				/**
				 * Metadados adicionais para o agente. Pode ser usado para rastreamento
				 * ou para fornecer informações extras sobre a cadeia de procedimentos.
				 */
				metadata?: KVMap;

				/**
				 * Nome do agente. Útil para depuração e rastreamento.
				 */
				name?: string;

				/**
				 * Se `true`, habilita logs de execução
				 */
				verbose?: boolean;
			};

			/**
			 * Lista de {@link Procedure} que serão executadas pelo agente
			 */
			procedures: Procedure<State<Input, Output>["values"], LLMType>[];

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
		const procedureMap = new Map<string, Procedure<State<Input, Output>["values"], LLMTypeBase>>();
		for (const proc of this.props.procedures) procedureMap.set(proc.name, proc);

		let currentProcedure: null | Procedure<State<Input, Output>["values"], LLMTypeBase> = this.props.procedures[0];
		let iteration = 0;

		const agent = traceable(
			async function agent(meta: Agent<Input, Output, LLMTypeBase>) {
				while (currentProcedure) {
					if (iteration++ >= (meta.props.options?.maxIterations || 100)) {
						throw new ProcedureChainError(
							`O agente atingiu o limite máximo de ${meta.props.options?.maxIterations || 100} iterações. Possível loop detectado no grafo.`,
						);
					}

					if (meta.props.options?.verbose) {
						console.log(
							`[${meta.props?.options?.name || "Agente"}] Iteração ${iteration}: ${currentProcedure.name}`,
						);
					}

					if (currentProcedure.type === "action") {
						const values = (await traceable(
							async () => await currentProcedure?.run(meta.props.state.values, meta.props.llm),
							{
								metadata: currentProcedure?.tracing?.metadata,
								name: currentProcedure?.tracing?.label || currentProcedure.name,
								run_type: currentProcedure?.tracing?.runType || "tool",
							},
						)()) as { input: z.infer<Input>; output: z.infer<Output> };

						meta.props.state.setInput(values.input);
						meta.props.state.setOutput(values.output);

						if (currentProcedure.nextProcedure === END) break;

						// Caso a procedure de ação tenha nextProcedure definido pula para ele
						if (currentProcedure.nextProcedure) {
							const next = procedureMap.get(currentProcedure.nextProcedure);
							currentProcedure = next ?? null;
							continue;
						}

						// Caso a procedure de ação não tenha nextProcedure definido,
						// podemos simplesmente partir para a próxima procedure na lista
						const currentIndex = meta.props.procedures.findIndex(p => p.name === currentProcedure?.name);
						const nextProc = meta.props.procedures[currentIndex + 1];
						currentProcedure = nextProc ?? null;
					} else if (currentProcedure.type === "check") {
						// Procedures do tipo check devem retornar o nome do procedimento seguinte
						// Pegamos o nome e vamos até ele se existir. Se não existir, break
						const nextProcedure = (await traceable(
							async () => await currentProcedure?.run(meta.props.state.values, meta.props.llm),
							{
								metadata: currentProcedure?.tracing?.metadata,
								name: currentProcedure?.tracing?.label || currentProcedure.name,
								run_type: currentProcedure?.tracing?.runType || "tool",
							},
						)()) as null | string | undefined;

						if (!nextProcedure || nextProcedure === END) break;
						const next = procedureMap.get(nextProcedure);
						currentProcedure = next ?? null;
					}
				}
			},
			{
				metadata: {
					...(this.props.options?.metadata || {}),
					__meta_library: process.env.npm_package_name || "@cosmixclub/parsero",
					__meta_version: process.env.npm_package_version || "0.0.0",
				},
				name: this.props?.options?.name || "Agente",
				run_type: "chain",
			},
		);
		await agent(this);

		const outputParsed = this.props.state.parseOutput(this.props.state.values.output);
		if (!outputParsed.success) throw new StateValidationError("O output gerado não segue o schema.");
		return outputParsed.data;
	}
}
