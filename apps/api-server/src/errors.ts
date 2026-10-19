export class BoundaryError extends Error {
  constructor(public status: number, public code: string, message: string, public legacyStatus?: number, public legacyReason?: string) { super(message); }
}
