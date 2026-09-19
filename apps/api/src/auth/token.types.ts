/** JWT payloads. `type` discriminates access vs refresh so one can't stand in
 * for the other. */
export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
