import { ParseroError } from ".";

/**
 * Interface para opções específicas dos erros de validação de estado.
 * Estende o tipo ErrorOptions nativo e adiciona suporte para detalhes de erros do Zod.
 */
export interface StateValidationErrorOptions extends ErrorOptions {
	/**
	 * Detalhes dos erros de validação do Zod
	 */
	issues?: Array<{ message: string; path: (number | string)[] }>;
}

/**
 * Erro lançado quando ocorrem problemas de validação no estado do agente.
 */
export class StateValidationError extends ParseroError {
	/**
	 * Detalhes dos erros de validação do Zod, se fornecidos.
	 */
	readonly issues?: Array<{ message: string; path: (number | string)[] }>;

	/**
	 * Cria uma nova instância de StateValidationError
	 *
	 * @param message Mensagem do erro
	 * @param options Opções do erro, incluindo possíveis detalhes de validação do Zod
	 */
	constructor(message: string, options?: StateValidationErrorOptions) {
		super(message, options);

		// Armazena os detalhes de validação se fornecidos
		if (options?.issues) {
			this.issues = options.issues;
		}
	}
}
