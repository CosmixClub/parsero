import { KVMap } from "langsmith/schemas";

import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { LLMTypeBase } from "./agent";
import { StateValuesFormat } from "./state";

/**
 * Representa uma procedure do tipo "Action", cujo objetivo é **mudar** o estado do agente.
 *
 * O `ActionProcedure` faz mutações ou computações que alteram o estado de forma persistente.
 * Quando executada, retorna o objeto de estado atualizado.
 *
 * @template StateValues - Formato dos valores de estado usados pelas procedures
 * @template LLMType - Tipo específico do modelo de linguagem passado para o procedimento
 */
export interface ActionProcedure<StateValues extends StateValuesFormat, LLMType extends LLMTypeBase = BaseChatModel>
	extends BaseProcedure {
	/**
	 * Nome da próxima procedure que deve ser executada.
	 *
	 * Se fornecido, o fluxo de execução passa diretamente para `nextProcedure`.
	 * Se não for definido, o Agent tentará executar a próxima procedure listada
	 * na sequência fornecida ao `Agent`.
	 * É opcional quando a lista de procedures não tiver ao menos uma procedure `check`. Quando houver,
	 * é necessário indicar o nome da próxima procedure, podendo também ser `__end__`, ou a constante `END` do LangGraph.
	 */
	nextProcedure?: string;

	/**
	 * Método responsável por executar a ação.
	 * Recebe o estado atual e o modelo de linguagem (LLM), podendo realizar alterações
	 * no estado e retornando-o em seguida.
	 *
	 * @param state - Estado atual do agente
	 * @param llm - Modelo de linguagem que o Agent utiliza para auxiliar na execução
	 * @returns Estado atualizado
	 */
	run(state: StateValues, llm: LLMType): Promise<StateValues>;

	/**
	 * Tipo do procedimento, neste caso é sempre `"action"`
	 */
	type: "action";
}

/**
 * Interface base para todas as procedures, tanto `ActionProcedure` quanto `CheckProcedure`.
 */
export interface BaseProcedure {
	/**
	 * Nome único para identificação da procedure
	 */
	name: string;

	/**
	 * Opções de tracing para a integração com o LangSmith
	 */
	tracing?: {
		/**
		 * Nome do procedimento a ser rastreado. Sobrescreve o nome padrão
		 */
		label?: string;

		/**
		 * Metadados adicionais para o procedimento. Pode ser usado para rastreamento
		 * ou para fornecer informações extras sobre a execução.
		 */
		metadata?: KVMap;

		/**
		 * Tipo da execução procedimento a ser rastreado. Default: `"tool"`
		 */
		runType?: "chain" | "embedding" | "llm" | "parser" | "prompt" | "retriever" | "tool";
	};
}

/**
 * Representa uma procedure do tipo "Check", cujo objetivo é **não alterar** o estado,
 * mas sim decidir qual será a próxima procedure.
 *
 * O `CheckProcedure` recebe o estado atual, faz uma verificação (ou análise) e
 * retorna o **nome da próxima procedure** que deve ser executada pelo {@link Agent}.
 *
 * @template StateValues - Formato dos valores de estado usados pelas procedures
 * @template LLMType - Tipo específico do modelo de linguagem passado para o procedimento
 */
export interface CheckProcedure<StateValues extends StateValuesFormat, LLMType extends LLMTypeBase = BaseChatModel>
	extends BaseProcedure {
	/**
	 * Método responsável por verificar/analisar o estado atual e retornar
	 * o nome da próxima procedure a ser executada.
	 *
	 * @param state - Estado atual do agente
	 * @param llm - Modelo de linguagem que o Agent utiliza para auxiliar na execução
	 * @returns Nome da próxima procedure que o Agent deve executar, ou null/undefined para finalizar a execução
	 */
	run(state: StateValues, llm: LLMType): Promise<null | string | undefined>;

	/**
	 * Tipo do procedimento, neste caso é sempre `"check"`
	 */
	type: "check";
}

/**
 * Tipo unificado que agrupa tanto `ActionProcedure` quanto `CheckProcedure`.
 *
 * O `Agent` irá lidar de maneira diferenciada com cada um:
 * - **Action**: Altera o estado e pode (opcionalmente*) indicar o nome da próxima procedure.
 * - **Check**: Não altera o estado e sempre retorna o nome da próxima procedure.
 *
 * @template StateValues - Formato dos valores de estado usados pelas procedures
 * @template LLMType - Tipo específico do modelo de linguagem
 */
export type Procedure<StateValues extends StateValuesFormat, LLMType extends LLMTypeBase = BaseChatModel> =
	| ActionProcedure<StateValues, LLMType>
	| CheckProcedure<StateValues, LLMType>;
