import { gql } from 'apollo-angular';

/** Public — exchanges credentials for a JWT pair. */
export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      tokenType
      expiresIn
    }
  }
`;

/** The authenticated identity. */
export const ME = gql`
  query Me {
    me {
      id
      email
      name
      avatarUrl
      isSuperAdmin
    }
  }
`;

/** Every tenant the caller can act on, with their role there. */
export const MY_SITES = gql`
  query MySites {
    mySites {
      siteId
      siteSlug
      siteName
      role
    }
  }
`;

/** All content types for the active site (drives the sidebar + list screens). */
export const CONTENT_TYPES = gql`
  query ContentTypes {
    contentTypes {
      id
      slug
      name
      description
      isCore
      fields {
        id
        key
        name
        type
        required
        sortOrder
      }
    }
  }
`;

/** A page of entries of one content type (the list view). */
export const ENTRIES = gql`
  query Entries($type: String!, $status: ContentStatus, $limit: Int, $offset: Int) {
    entries(type: $type, status: $status, limit: $limit, offset: $offset) {
      id
      title
      slug
      status
      locale
      updatedAt
      publishedAt
    }
  }
`;

/** The registered field types (id + label) for the content-type builder. */
export const FIELD_TYPES = gql`
  query FieldTypes {
    fieldTypes {
      id
      label
    }
  }
`;

/** Content types with full field defs + config, for the builder. */
export const CONTENT_TYPES_ADMIN = gql`
  query ContentTypesAdmin {
    contentTypes {
      id
      slug
      name
      description
      isCore
      config
      fields {
        id
        key
        name
        type
        required
        config
        sortOrder
      }
    }
  }
`;

export const CREATE_CONTENT_TYPE = gql`
  mutation CreateContentType($input: CreateContentTypeInput!) {
    createContentType(input: $input) {
      slug
      name
    }
  }
`;

export const UPDATE_CONTENT_TYPE = gql`
  mutation UpdateContentType($slug: String!, $input: UpdateContentTypeInput!) {
    updateContentType(slug: $slug, input: $input) {
      slug
      name
      description
    }
  }
`;

export const DELETE_CONTENT_TYPE = gql`
  mutation DeleteContentType($slug: String!) {
    deleteContentType(slug: $slug)
  }
`;

export const ADD_FIELD = gql`
  mutation AddField($slug: String!, $input: FieldDefinitionInput!) {
    addField(slug: $slug, input: $input) {
      id
      key
    }
  }
`;

export const UPDATE_FIELD = gql`
  mutation UpdateField($slug: String!, $key: String!, $input: UpdateFieldInput!) {
    updateField(slug: $slug, key: $key, input: $input) {
      id
      key
      sortOrder
    }
  }
`;

export const REMOVE_FIELD = gql`
  mutation RemoveField($slug: String!, $key: String!) {
    removeField(slug: $slug, key: $key)
  }
`;

/** A single content type with its field definitions (drives the editor form). */
export const CONTENT_TYPE = gql`
  query ContentType($slug: String!) {
    contentType(slug: $slug) {
      id
      slug
      name
      description
      fields {
        id
        key
        name
        type
        required
        config
        sortOrder
      }
    }
  }
`;

/** One entry by id (for the edit screen). */
export const ENTRY = gql`
  query Entry($id: ID!) {
    entry(id: $id) {
      id
      type
      slug
      title
      status
      locale
      fields
      publishedAt
    }
  }
`;

/** Revision history for an entry (newest first), each a full snapshot. */
export const ENTRY_REVISIONS = gql`
  query EntryRevisions($id: ID!) {
    entryRevisions(id: $id) {
      id
      authorId
      createdAt
      data
    }
  }
`;

export const CREATE_ENTRY = gql`
  mutation CreateEntry($type: String!, $input: CreateEntryInput!) {
    createEntry(type: $type, input: $input) {
      id
      status
    }
  }
`;

export const UPDATE_ENTRY = gql`
  mutation UpdateEntry($id: ID!, $input: UpdateEntryInput!) {
    updateEntry(id: $id, input: $input) {
      id
      status
    }
  }
`;

export const PUBLISH_ENTRY = gql`
  mutation PublishEntry($id: ID!) {
    publishEntry(id: $id) {
      id
      status
      publishedAt
    }
  }
`;

export const UNPUBLISH_ENTRY = gql`
  mutation UnpublishEntry($id: ID!) {
    unpublishEntry(id: $id) {
      id
      status
    }
  }
`;

export const TRASH_ENTRY = gql`
  mutation TrashEntry($id: ID!) {
    trashEntry(id: $id) {
      id
      status
    }
  }
`;

/** Media library listing (newest first, server-paged). */
export const MEDIA = gql`
  query Media($limit: Int, $offset: Int) {
    media(limit: $limit, offset: $offset) {
      id
      filename
      url
      mime
      size
      width
      height
      alt
      title
      variants {
        key
        url
        width
        height
      }
      createdAt
    }
  }
`;

/** A single media item by id (resolve a stored `media` field value → thumbnail). */
export const MEDIA_ITEM = gql`
  query MediaItem($id: ID!) {
    mediaItem(id: $id) {
      id
      filename
      url
      mime
      width
      height
      alt
      variants {
        key
        url
        width
        height
      }
    }
  }
`;

export const UPDATE_MEDIA = gql`
  mutation UpdateMedia($id: ID!, $input: UpdateMediaInput!) {
    updateMedia(id: $id, input: $input) {
      id
      alt
      title
    }
  }
`;

export const DELETE_MEDIA = gql`
  mutation DeleteMedia($id: ID!) {
    deleteMedia(id: $id)
  }
`;

// ---------------------------------------------------------------------------
// Users (user management)
// ---------------------------------------------------------------------------

export const USERS = gql`
  query Users {
    users {
      id
      email
      name
      status
      isSuperAdmin
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      email
      name
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      status
      isSuperAdmin
    }
  }
`;

export const SET_USER_PASSWORD = gql`
  mutation SetUserPassword($id: ID!, $password: String!) {
    setUserPassword(id: $id, password: $password)
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

// ---------------------------------------------------------------------------
// Operational: redirects, audit, webhooks, SEO settings, forms, importer
// ---------------------------------------------------------------------------

export const REDIRECTS = gql`
  query Redirects {
    redirects { id fromPath toPath statusCode enabled hits }
  }
`;
export const CREATE_REDIRECT = gql`
  mutation CreateRedirect($input: CreateRedirectInput!) {
    createRedirect(input: $input) { id }
  }
`;
export const UPDATE_REDIRECT = gql`
  mutation UpdateRedirect($id: ID!, $input: UpdateRedirectInput!) {
    updateRedirect(id: $id, input: $input) { id }
  }
`;
export const DELETE_REDIRECT = gql`
  mutation DeleteRedirect($id: ID!) { deleteRedirect(id: $id) }
`;

export const AUDIT_LOG = gql`
  query AuditLog($action: String, $limit: Int, $offset: Int) {
    auditLog(action: $action, limit: $limit, offset: $offset) {
      id action actorEmail targetType targetId summary createdAt
    }
  }
`;

export const WEBHOOKS = gql`
  query Webhooks {
    webhooks { id url events enabled description secret }
  }
`;
export const WEBHOOK_DELIVERIES = gql`
  query WebhookDeliveries($webhookId: ID!, $limit: Int) {
    webhookDeliveries(webhookId: $webhookId, limit: $limit) {
      id event success statusCode attempt error createdAt
    }
  }
`;
export const CREATE_WEBHOOK = gql`
  mutation CreateWebhook($input: CreateWebhookInput!) {
    createWebhook(input: $input) { id }
  }
`;
export const UPDATE_WEBHOOK = gql`
  mutation UpdateWebhook($id: ID!, $input: UpdateWebhookInput!) {
    updateWebhook(id: $id, input: $input) { id enabled }
  }
`;
export const DELETE_WEBHOOK = gql`
  mutation DeleteWebhook($id: ID!) { deleteWebhook(id: $id) }
`;
export const TEST_WEBHOOK = gql`
  mutation TestWebhook($id: ID!) { testWebhook(id: $id) { id } }
`;

export const SEO_SETTINGS = gql`
  query SeoSettings {
    seoSettings {
      baseUrl titleTemplate defaultDescription robotsDisallow noindexSite
    }
  }
`;
export const UPDATE_SEO_SETTINGS = gql`
  mutation UpdateSeoSettings($input: SeoSettingsInput!) {
    updateSeoSettings(input: $input) {
      baseUrl titleTemplate defaultDescription robotsDisallow noindexSite
    }
  }
`;

export const FORMS = gql`
  query Forms {
    forms { id slug name enabled fields { key type label required } settings }
  }
`;
export const FORM_SUBMISSIONS = gql`
  query FormSubmissions($slug: String!, $limit: Int, $offset: Int) {
    formSubmissions(slug: $slug, limit: $limit, offset: $offset) {
      id data meta createdAt
    }
  }
`;
export const UPDATE_FORM = gql`
  mutation UpdateForm($slug: String!, $input: UpdateFormInput!) {
    updateForm(slug: $slug, input: $input) {
      id slug enabled fields { key type label required }
    }
  }
`;
export const CREATE_FORM = gql`
  mutation CreateForm($input: CreateFormInput!) {
    createForm(input: $input) { id slug name enabled fields { key type label required } }
  }
`;
export const DELETE_FORM = gql`
  mutation DeleteForm($slug: String!) { deleteForm(slug: $slug) }
`;
export const DELETE_FORM_SUBMISSION = gql`
  mutation DeleteFormSubmission($id: ID!) { deleteFormSubmission(id: $id) }
`;

export const IMPORT_WORDPRESS = gql`
  mutation ImportWordpress($xml: String!, $importMedia: Boolean) {
    importWordpress(xml: $xml, importMedia: $importMedia) {
      siteTitle contentTypesEnsured taxonomiesEnsured termsCreated
      entriesImported entriesSkipped mediaImported mediaFailed warnings
    }
  }
`;

// ---------------------------------------------------------------------------
// Plugins & settings
// ---------------------------------------------------------------------------

export const PLUGINS = gql`
  query Plugins {
    plugins {
      name
      version
      displayName
      description
      enabled
      capabilities
      settingsSchema {
        key
        type
        label
        required
        config
        default
      }
      settings
    }
  }
`;

export const ACTIVATE_PLUGIN = gql`
  mutation ActivatePlugin($name: String!) {
    activatePlugin(name: $name) {
      name
      enabled
    }
  }
`;

export const DEACTIVATE_PLUGIN = gql`
  mutation DeactivatePlugin($name: String!) {
    deactivatePlugin(name: $name) {
      name
      enabled
    }
  }
`;

export const UPDATE_PLUGIN_SETTINGS = gql`
  mutation UpdatePluginSettings($name: String!, $settings: JSON!) {
    updatePluginSettings(name: $name, settings: $settings) {
      name
      settings
    }
  }
`;

// ---------------------------------------------------------------------------
// Sites & memberships (site management)
// ---------------------------------------------------------------------------

export const SITES = gql`
  query Sites {
    sites {
      id
      slug
      name
      status
      domains
    }
  }
`;

export const ROLES = gql`
  query Roles {
    roles {
      id
      slug
      name
    }
  }
`;

export const CREATE_SITE = gql`
  mutation CreateSite($input: CreateSiteInput!) {
    createSite(input: $input) {
      id
      slug
      name
    }
  }
`;

export const UPDATE_SITE = gql`
  mutation UpdateSite($id: ID!, $input: UpdateSiteInput!) {
    updateSite(id: $id, input: $input) {
      id
      name
      status
    }
  }
`;

export const DELETE_SITE = gql`
  mutation DeleteSite($id: ID!) {
    deleteSite(id: $id)
  }
`;

export const SITE_MEMBERS = gql`
  query SiteMembers($siteId: ID!) {
    siteMembers(siteId: $siteId) {
      membershipId
      userId
      email
      name
      roleSlug
      roleName
    }
  }
`;

export const ADD_SITE_MEMBER = gql`
  mutation AddSiteMember($siteId: ID!, $email: String!, $roleSlug: String!) {
    addSiteMember(siteId: $siteId, email: $email, roleSlug: $roleSlug) {
      membershipId
    }
  }
`;

export const UPDATE_SITE_MEMBER = gql`
  mutation UpdateSiteMember($membershipId: ID!, $roleSlug: String!) {
    updateSiteMember(membershipId: $membershipId, roleSlug: $roleSlug) {
      membershipId
      roleSlug
    }
  }
`;

export const REMOVE_SITE_MEMBER = gql`
  mutation RemoveSiteMember($membershipId: ID!) {
    removeSiteMember(membershipId: $membershipId)
  }
`;

// ---------------------------------------------------------------------------
// Taxonomies & terms
// ---------------------------------------------------------------------------

export const TAXONOMIES = gql`
  query Taxonomies {
    taxonomies {
      id
      slug
      name
      isCore
    }
  }
`;

export const CREATE_TAXONOMY = gql`
  mutation CreateTaxonomy($input: CreateTaxonomyInput!) {
    createTaxonomy(input: $input) {
      id
      slug
      name
    }
  }
`;

export const DELETE_TAXONOMY = gql`
  mutation DeleteTaxonomy($slug: String!) {
    deleteTaxonomy(slug: $slug)
  }
`;

export const TERMS = gql`
  query Terms($taxonomy: String!) {
    terms(taxonomy: $taxonomy) {
      id
      slug
      name
      description
      parentId
    }
  }
`;

export const CREATE_TERM = gql`
  mutation CreateTerm($taxonomy: String!, $input: CreateTermInput!) {
    createTerm(taxonomy: $taxonomy, input: $input) {
      id
      slug
      name
      parentId
    }
  }
`;

export const DELETE_TERM = gql`
  mutation DeleteTerm($id: ID!) {
    deleteTerm(id: $id)
  }
`;

/** The resolved SEO for an entry (override → site default → derived). */
export const ENTRY_SEO = gql`
  query EntrySeo($id: ID!) {
    entry(id: $id) {
      id
      seo {
        title
        description
        canonical
        ogTitle
        ogDescription
        ogImage
        noindex
        jsonLd
      }
    }
  }
`;

/** Set an entry's per-entry SEO overrides. */
export const SET_ENTRY_SEO = gql`
  mutation SetEntrySeo($entryId: ID!, $input: SeoMetaInput!) {
    setEntrySeo(entryId: $entryId, input: $input) {
      title
      noindex
    }
  }
`;

/** Terms currently assigned to an entry (across all taxonomies). */
export const ENTRY_TERMS = gql`
  query EntryTerms($entryId: ID!) {
    entryTerms(entryId: $entryId) {
      id
      taxonomyId
      name
      slug
    }
  }
`;

/** Replace an entry's full term set (all taxonomies) in one call. */
export const SET_ENTRY_TERMS = gql`
  mutation SetEntryTerms($entryId: ID!, $termIds: [ID!]!) {
    setEntryTerms(entryId: $entryId, termIds: $termIds) {
      id
    }
  }
`;

// ---------------------------------------------------------------------------
// Menus & menu items
// ---------------------------------------------------------------------------

export const MENUS = gql`
  query Menus {
    menus {
      id
      slug
      name
      items {
        id
        parentId
        label
        type
        url
        entryId
        target
        sortOrder
      }
    }
  }
`;

export const CREATE_MENU = gql`
  mutation CreateMenu($input: CreateMenuInput!) {
    createMenu(input: $input) {
      id
      slug
      name
    }
  }
`;

export const DELETE_MENU = gql`
  mutation DeleteMenu($slug: String!) {
    deleteMenu(slug: $slug)
  }
`;

export const ADD_MENU_ITEM = gql`
  mutation AddMenuItem($menu: String!, $input: MenuItemInput!) {
    addMenuItem(menu: $menu, input: $input) {
      id
      label
    }
  }
`;

export const DELETE_MENU_ITEM = gql`
  mutation DeleteMenuItem($id: ID!) {
    deleteMenuItem(id: $id)
  }
`;

export const REORDER_MENU = gql`
  mutation ReorderMenu($menu: String!, $items: [ReorderMenuItemInput!]!) {
    reorderMenu(menu: $menu, items: $items) {
      id
      parentId
      sortOrder
    }
  }
`;

/**
 * Admin full-text search across content (drafts + scheduled included). Returns
 * ranked hits with a highlighted snippet (matches wrapped in `<b>…</b>`).
 */
export const SEARCH_CONTENT = gql`
  query SearchContent($query: String!, $type: String, $limit: Int) {
    searchContent(query: $query, type: $type, limit: $limit) {
      rank
      snippet
      entry {
        id
        type
        title
        slug
        status
        updatedAt
      }
    }
  }
`;
