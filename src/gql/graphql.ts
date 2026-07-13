/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type DateTimeSet = {
  set?: string | null | undefined;
};

export type StringFilter = {
  eq?: string | null | undefined;
};

export type WorkspaceUpdateInput = {
  deletedAt?: DateTimeSet | null | undefined;
  description?: string | null | undefined;
  isDefault?: boolean | null | undefined;
  /** An https:// URL or a `data:image/...;base64,...` data URL. Pass null to clear. */
  logoUrl?: string | null | undefined;
  missionStatement?: string | null | undefined;
  name?: string | null | undefined;
  onboardingStatus?: string | null | undefined;
  settings?: string | null | undefined;
  slug?: string | null | undefined;
};

export type WorkspaceWhere = {
  id?: StringFilter | null | undefined;
  organisationId?: StringFilter | null | undefined;
  slug?: StringFilter | null | undefined;
};

export type UpdateWorkspaceMutationVariables = Exact<{
  where: WorkspaceWhere;
  update: WorkspaceUpdateInput;
}>;


export type UpdateWorkspaceMutation = { updateWorkspaces: { workspaces: Array<{ id: string | null, name: string | null, description: string | null, missionStatement: string | null, logoUrl: string | null, slug: string | null }> | null } | null };

export type WorkspaceDirectoryQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkspaceDirectoryQuery = { organisations: Array<{ id: string | null, name: string | null, slug: string | null, propelAuthOrgId: string | null }> | null, workspaces: Array<{ id: string | null, name: string | null, slug: string | null, organisationId: string | null, isDefault: boolean | null }> | null };

export type WorkspaceOverviewQueryVariables = Exact<{
  workspaceId: string;
  days?: number | null | undefined;
}>;


export type WorkspaceOverviewQuery = { workspaces: Array<{ id: string | null, name: string | null, description: string | null, missionStatement: string | null, slug: string | null, organisationId: string | null, onboardingStatus: string | null }> | null, goalList: Array<{ id: string | null, displayId: number | null, title: string | null, importance: number | null }> | null, signalActivitySummary: Array<{ source: string | null, count: number | null }> | null, chainHealth: { signalCount: number | null, activeSignalCount: number | null, staleSignalCount: number | null, insightCount: number | null, sourceCount: number | null, signalHealthPercent: number | null } | null, openActions: Array<{ id: string | null }> | null, pendingBriefs: Array<{ id: string | null }> | null };


export const UpdateWorkspaceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWorkspace"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"where"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WorkspaceWhere"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"update"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WorkspaceUpdateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkspaces"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"Variable","name":{"kind":"Name","value":"where"}}},{"kind":"Argument","name":{"kind":"Name","value":"update"},"value":{"kind":"Variable","name":{"kind":"Name","value":"update"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workspaces"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"missionStatement"}},{"kind":"Field","name":{"kind":"Name","value":"logoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>;
export const WorkspaceDirectoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WorkspaceDirectory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organisations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"propelAuthOrgId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workspaces"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"organisationId"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}}]}}]} as unknown as DocumentNode<WorkspaceDirectoryQuery, WorkspaceDirectoryQueryVariables>;
export const WorkspaceOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WorkspaceOverview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"workspaceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"days"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workspaces"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"workspaceId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"missionStatement"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"organisationId"}},{"kind":"Field","name":{"kind":"Name","value":"onboardingStatus"}}]}},{"kind":"Field","name":{"kind":"Name","value":"goalList"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"5"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"importance"}}]}},{"kind":"Field","name":{"kind":"Name","value":"signalActivitySummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"days"},"value":{"kind":"Variable","name":{"kind":"Name","value":"days"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"chainHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"signalCount"}},{"kind":"Field","name":{"kind":"Name","value":"activeSignalCount"}},{"kind":"Field","name":{"kind":"Name","value":"staleSignalCount"}},{"kind":"Field","name":{"kind":"Name","value":"insightCount"}},{"kind":"Field","name":{"kind":"Name","value":"sourceCount"}},{"kind":"Field","name":{"kind":"Name","value":"signalHealthPercent"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"openActions"},"name":{"kind":"Name","value":"actions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"statuses"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"suggested"},{"kind":"EnumValue","value":"in_progress"}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"pendingBriefs"},"name":{"kind":"Name","value":"onePagerList"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"onePagerStatus"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"building"},{"kind":"EnumValue","value":"draft"},{"kind":"EnumValue","value":"in_review"}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WorkspaceOverviewQuery, WorkspaceOverviewQueryVariables>;