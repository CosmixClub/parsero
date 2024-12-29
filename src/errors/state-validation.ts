import { ParseroError } from ".";

export class StateValidationError extends ParseroError {
	constructor(message: string) {
		super(message);
	}
}
