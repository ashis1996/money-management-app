// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  /**
   * Token version. Embedded in every access token issued after the
   * tokenVersion feature landed; older tokens omit it and are treated as
   * `tv: 0`. JwtStrategy compares this to the user's current
   * `User.tokenVersion`; a mismatch means the user has logged out
   * everywhere (or rotated credentials) since the token was issued, and
   * the request is rejected with 401.
   */
  tv?: number;
  iat?: number;
  exp?: number;
}
