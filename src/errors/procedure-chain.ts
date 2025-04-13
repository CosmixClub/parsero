import { ParseroError } from ".";

export class ProcedureChainError extends ParseroError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
	}
}
