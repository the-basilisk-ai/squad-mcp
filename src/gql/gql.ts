/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "mutation UpdateWorkspace($where: WorkspaceWhere!, $update: WorkspaceUpdateInput!) {\n  updateWorkspaces(where: $where, update: $update) {\n    workspaces {\n      id\n      name\n      description\n      missionStatement\n      logoUrl\n      slug\n    }\n  }\n}": typeof types.UpdateWorkspaceDocument,
    "query WorkspaceDirectory {\n  organisations {\n    id\n    name\n    slug\n    propelAuthOrgId\n  }\n  workspaces(limit: 100) {\n    id\n    name\n    slug\n    organisationId\n    isDefault\n  }\n}": typeof types.WorkspaceDirectoryDocument,
    "query WorkspaceOverview($workspaceId: String!, $days: Int) {\n  workspaces(where: {id: {eq: $workspaceId}}, limit: 1) {\n    id\n    name\n    description\n    missionStatement\n    slug\n    organisationId\n    onboardingStatus\n  }\n  goalList(limit: 5) {\n    id\n    displayId\n    title\n    importance\n  }\n  signalActivitySummary(days: $days) {\n    source\n    count\n  }\n  chainHealth {\n    signalCount\n    activeSignalCount\n    staleSignalCount\n    insightCount\n    sourceCount\n    signalHealthPercent\n  }\n  openActions: actions(statuses: [suggested, in_progress], limit: 50) {\n    id\n  }\n  pendingBriefs: onePagerList(\n    filters: {onePagerStatus: [building, draft, in_review]}\n    limit: 50\n  ) {\n    id\n  }\n}": typeof types.WorkspaceOverviewDocument,
};
const documents: Documents = {
    "mutation UpdateWorkspace($where: WorkspaceWhere!, $update: WorkspaceUpdateInput!) {\n  updateWorkspaces(where: $where, update: $update) {\n    workspaces {\n      id\n      name\n      description\n      missionStatement\n      logoUrl\n      slug\n    }\n  }\n}": types.UpdateWorkspaceDocument,
    "query WorkspaceDirectory {\n  organisations {\n    id\n    name\n    slug\n    propelAuthOrgId\n  }\n  workspaces(limit: 100) {\n    id\n    name\n    slug\n    organisationId\n    isDefault\n  }\n}": types.WorkspaceDirectoryDocument,
    "query WorkspaceOverview($workspaceId: String!, $days: Int) {\n  workspaces(where: {id: {eq: $workspaceId}}, limit: 1) {\n    id\n    name\n    description\n    missionStatement\n    slug\n    organisationId\n    onboardingStatus\n  }\n  goalList(limit: 5) {\n    id\n    displayId\n    title\n    importance\n  }\n  signalActivitySummary(days: $days) {\n    source\n    count\n  }\n  chainHealth {\n    signalCount\n    activeSignalCount\n    staleSignalCount\n    insightCount\n    sourceCount\n    signalHealthPercent\n  }\n  openActions: actions(statuses: [suggested, in_progress], limit: 50) {\n    id\n  }\n  pendingBriefs: onePagerList(\n    filters: {onePagerStatus: [building, draft, in_review]}\n    limit: 50\n  ) {\n    id\n  }\n}": types.WorkspaceOverviewDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateWorkspace($where: WorkspaceWhere!, $update: WorkspaceUpdateInput!) {\n  updateWorkspaces(where: $where, update: $update) {\n    workspaces {\n      id\n      name\n      description\n      missionStatement\n      logoUrl\n      slug\n    }\n  }\n}"): (typeof documents)["mutation UpdateWorkspace($where: WorkspaceWhere!, $update: WorkspaceUpdateInput!) {\n  updateWorkspaces(where: $where, update: $update) {\n    workspaces {\n      id\n      name\n      description\n      missionStatement\n      logoUrl\n      slug\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query WorkspaceDirectory {\n  organisations {\n    id\n    name\n    slug\n    propelAuthOrgId\n  }\n  workspaces(limit: 100) {\n    id\n    name\n    slug\n    organisationId\n    isDefault\n  }\n}"): (typeof documents)["query WorkspaceDirectory {\n  organisations {\n    id\n    name\n    slug\n    propelAuthOrgId\n  }\n  workspaces(limit: 100) {\n    id\n    name\n    slug\n    organisationId\n    isDefault\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query WorkspaceOverview($workspaceId: String!, $days: Int) {\n  workspaces(where: {id: {eq: $workspaceId}}, limit: 1) {\n    id\n    name\n    description\n    missionStatement\n    slug\n    organisationId\n    onboardingStatus\n  }\n  goalList(limit: 5) {\n    id\n    displayId\n    title\n    importance\n  }\n  signalActivitySummary(days: $days) {\n    source\n    count\n  }\n  chainHealth {\n    signalCount\n    activeSignalCount\n    staleSignalCount\n    insightCount\n    sourceCount\n    signalHealthPercent\n  }\n  openActions: actions(statuses: [suggested, in_progress], limit: 50) {\n    id\n  }\n  pendingBriefs: onePagerList(\n    filters: {onePagerStatus: [building, draft, in_review]}\n    limit: 50\n  ) {\n    id\n  }\n}"): (typeof documents)["query WorkspaceOverview($workspaceId: String!, $days: Int) {\n  workspaces(where: {id: {eq: $workspaceId}}, limit: 1) {\n    id\n    name\n    description\n    missionStatement\n    slug\n    organisationId\n    onboardingStatus\n  }\n  goalList(limit: 5) {\n    id\n    displayId\n    title\n    importance\n  }\n  signalActivitySummary(days: $days) {\n    source\n    count\n  }\n  chainHealth {\n    signalCount\n    activeSignalCount\n    staleSignalCount\n    insightCount\n    sourceCount\n    signalHealthPercent\n  }\n  openActions: actions(statuses: [suggested, in_progress], limit: 50) {\n    id\n  }\n  pendingBriefs: onePagerList(\n    filters: {onePagerStatus: [building, draft, in_review]}\n    limit: 50\n  ) {\n    id\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;