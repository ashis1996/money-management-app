export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

export type ValueOf<T> = T[keyof T];

export type AsyncFunction<T = void> = () => Promise<T>;

export type Constructor<T = any> = new (...args: any[]) => T;

export interface ITimestamp {
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface IPaginatedResponse<T> {
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
  /** See identical doc in api.types.ts. Mirrors the access-token version. */
  tv?: number;
  iat?: number;
  exp?: number;
}

export interface IResult<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export type Success<T> = {
  success: true;
  data: T;
};

export type Failure<E = Error> = {
  success: false;
  error: E;
};

export type Result<T, E = Error> = Success<T> | Failure<E>;
