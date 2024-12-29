import { ParseroError } from ".";

export class ProcedureChainError extends ParseroError {
	constructor(message: string) {
		super(message);
	}
}
