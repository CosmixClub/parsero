export class ParseroError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);

		// Define o nome correto da classe no stack trace
		this.name = this.constructor.name;

		// Ajusta o protótipo para preservar a instanceof operação
		Object.setPrototypeOf(this, new.target.prototype);

		// Se o V8 estiver disponível, captura o stack trace de forma otimizada
		if (typeof Error.captureStackTrace === "function") {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}
