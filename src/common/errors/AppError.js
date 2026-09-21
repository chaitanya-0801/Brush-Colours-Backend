export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED', details = undefined) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message, code = 'INVALID_REQUEST', details) => new AppError(400, message, code, details)
export const unauthorized = (message = 'Please sign in to continue.') => new AppError(401, message, 'AUTH_REQUIRED')
export const forbidden = (message = 'You are not allowed to perform this action.') => new AppError(403, message, 'FORBIDDEN')
export const notFound = (message, code = 'NOT_FOUND') => new AppError(404, message, code)
export const conflict = (message, code = 'CONFLICT') => new AppError(409, message, code)
