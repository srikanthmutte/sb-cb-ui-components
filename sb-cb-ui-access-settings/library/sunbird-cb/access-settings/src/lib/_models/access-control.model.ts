export namespace NsAccessControlConfig {
  export interface IAccessControlConfig {
    accessControlCriteriaSelection: IAccessControlCriteriaSelection;
    usersTableConfig: ITableConfig;
    bulkUploadKarmayogi: IBulkUploadKarmayogi;
    accessControlGuide: IAccessControlGuide;
    visiblilityOnOff: IVisiblilityOnOff;
    userConfig: { [key: string]: any; userRoles: any; org?: any };
    content: any;
    application: string;
    mdoContent: any;
    context: {
      type: string;
      userGroupId?: string;
    };
  }
  export interface IAccessControlCriteriaSelection {
    optionsEntity: IOptionsEntity[];
    optionsConditions: IOptionsCondition[];
    organizationRadioSelection: ISelectionOption[];
    designationRadioSelection: ISelectionOption[];
    servicesRadioSelection: ISelectionOption[];
    cadreRadioSelection: ISelectionOption[];
    batchRadioSelection: ISelectionOption[];
    groupsOptions: string[];
    verificationStatus: ISelectionOption[];
    accessTypes: { name: string; value: string; tooltip: string; disabled: boolean }[];
    readOnly: boolean;
    canShowAccessTypeRadio: boolean;
    shouldShowVisibilityToggle: boolean;
    allowCustomsField: boolean;
    centralDeputation?: ISelectionOption[];
    paginationLimit: number
  }

  export interface IOptionsEntity {
    value: string;
    label: string;
    disabled: boolean;
    isCustomField?: boolean;
  }

  export interface IOptionsCondition {
    value: string;
    label: string;
  }

  export interface ITableConfig {
    allLearners: ITableParameters;
    selectedUsers: ITableParameters;
    bulkUploadTable: ITableParameters;
  }

  export interface ITableParameters {
    displayedColumns: string[];
    type: string;
    initialPaginationSize: number;
    initialPaginationSizeOptions: number[];
    canShowPagination: boolean;
    canShowMasterSelect: boolean;
    canShowRefreshBtn: boolean;
    canShowDeleteBtn: boolean;
    canShowSelectedItems: boolean;
    canSortColumn: boolean;
  }
  export type IUserTableType = "allLearners" | "selectedUsers" | "bulkUploadTable";

  export type IManageSelectionType = "add_karmayogis" | "bulk_upload_karmayogis";

  export interface IBulkUploadKarmayogi {
    uploadInstructions: string[];
    downloadSampleFile: {
      path: string;
      fileName: string;
    };
    bulkUploadTable: ITableParameters;
  }

  export enum SelectionType {
    Users = "user",
    Organizations = "rootOrgId",
    Group = "group",
    Designation = "designation",
    VerificationStatus = "profilestatus",
    Cadre = "Cadre",
    Service = "service",
    Batch = "batch",
    CustomField = "customeField",
    CentralDeputation = "isOnCentralDeputation",
  }

  export const SelectionTypeValues = Object.values(SelectionType);
  export interface ISelectionOption {
    value: string;
    label: string;
  }

  export enum IActions {
    Confirm = "confirm",
    Reject = "reject",
  }

  export enum IAccessTypes {
    Public = "public",
    Custom = "custom",
  }

  export type ITypeAccessType = "public" | "custom";
  export interface IAccessControlGuide {
    summaryText: string;
    canShowSummaryTab: boolean;
    canShowTranscriptTab: boolean;
    instructionVideoPath: string;
  }

  export enum IAccessSetting {
    ALL_USERS = "allUsers",
    MDO_SPECIFIC = "mdoSpecific",
    CUSTOME_USER = "customeUser",
  }

  export enum Application {
    MDO = "mdo_portal",
    Creation_Portal = "cbp_portal",
  }
}

export interface IUserGroupRequest {
  contentId: string;
  accessControl: {
    version: number;
    userGroups: {
      userGroupId: string;
      userGroupName: string;
      userGroupCriteriaList: {
        criteriaKey: string;
        criteriaValue: string[];
      }[];
    }[];
  };
}

export interface IReusableUserGroupRequest {
  request: {
    userGroupName: string;
    criteria: {
      criteriaKey: string;
      criteriaValue: string[];
    }[];
    userGroupId?: string;
  };
}

export interface IReusableUserGroupSearchRequest {
  filters: { [key: string]: any };
  pageSize: number;
  pageNumber: number;
  sortBy: string;
  sortOrder: string;
}

export interface IReusableUserGroupResult {
  usergroupid: string;
  usergroupname: string;
  criteria?: ({ criteriaKey: string; criteriaValue: string[] } | { [key: string]: string[] })[];
  orgid?: string;
  status?: string;
  createdby?: string;
  updatedby?: string;
  createddate?: string;
  updateddate?: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface IReusableUserGroupSearchResponse {
  responseCode?: string;
  result?: { count?: number; content?: IReusableUserGroupResult[] };
}

export interface IReusableUserGroupReadResponse {
  responseCode?: string;
  result?: IReusableUserGroupResult;
}

export interface IVisiblilityOnOff {
  label: string;
  disabled: boolean;
  on: string;
  off: string;
  default: string;
}
export interface IReuseUserGroupRow {
  id: string;
  name: string;
  owner: string;
  updatedOn: string;
  conditions: string[];
  searchText: string;
}