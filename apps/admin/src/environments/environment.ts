/** Runtime configuration. In dev the Angular dev-server proxies `/graphql` and
 *  `/media` to the API on :4000 (see proxy.conf.json), so relative URLs work.
 *  For a deployed admin, replace these with the API's absolute origin. */
export const environment = {
  production: false,
  /** Single GraphQL endpoint (admin fields are JWT+capability guarded; the
   *  public `delivery` subtree is open). */
  graphqlUrl: '/graphql',
  /** Front-end host for previewing draft entries; a minted preview token is
   *  appended as `?token=…`. No deployed front-end yet, so this is a placeholder. */
  previewBaseUrl: 'http://localhost:4300/preview',
};
