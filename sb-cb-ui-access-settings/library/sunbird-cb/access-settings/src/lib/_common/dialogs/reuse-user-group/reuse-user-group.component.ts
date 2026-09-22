import { Component, DestroyRef, OnInit, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Subject } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AccessControlService } from "../../../_services/access-control.service";
import { IReusableUserGroupResult, IReuseUserGroupRow, NsAccessControlConfig } from "../../../_models/access-control.model";
import { MINISTRY_OR_STATE_CRITERIA_KEY, CRITERIA_LABELS } from "../../../_constants/app.constants";

const PAGE_SIZE = 5;
const LOAD_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;
const SORT_BY = "updateddate";
const SORT_ORDER = "desc";

@Component({
  selector: "sb-uic-reuse-user-group",
  templateUrl: "./reuse-user-group.component.html",
  styleUrls: ["./reuse-user-group.component.scss"],
  standalone: false
})
export class ReuseUserGroupComponent implements OnInit {
  private readonly dialogRef = inject<MatDialogRef<ReuseUserGroupComponent>>(MatDialogRef);
  private readonly accessControlService = inject(AccessControlService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchInput = new Subject<string>();

  readonly data = inject<{ optionsEntity?: NsAccessControlConfig.IOptionsEntity[]; usedUserGroupIds?: string[] }>(MAT_DIALOG_DATA);

  private readonly usedGroupIds = new Set<string>(this.data?.usedUserGroupIds || []);

  readonly displayedColumns = ["select", "name", "conditions", "owner"];

  readonly isLoading = signal(false);
  readonly hasLoadFailed = signal(false);
  readonly groups = signal<IReuseUserGroupRow[]>([]);
  readonly totalCount = signal(0);
  readonly searchKey = signal("");
  readonly currentPage = signal(1);
  readonly pageSize = signal(PAGE_SIZE);
  readonly selectedGroupId = signal("");

  readonly filteredGroups = computed(() => {
    const query = this.searchKey();
    const groups = this.groups();
    return query ? groups.filter(group => group.searchText.includes(query)) : groups;
  });

  readonly lastPage = computed(() => Math.max(1, Math.ceil(this.filteredGroups().length / this.pageSize())));

  readonly pagedGroups = computed(() => {
    const page = Math.min(this.currentPage(), this.lastPage());
    const start = (page - 1) * this.pageSize();
    return this.filteredGroups().slice(start, start + this.pageSize());
  });

  readonly selectedGroup = computed(() => {
    const selectedId = this.selectedGroupId();
    return selectedId ? this.groups().find(group => group.id === selectedId) : undefined;
  });

  readonly isApplyDisabled = computed(() => {
    const group = this.selectedGroup();
    return !group || this.isAlreadyUsed(group);
  });

  readonly hasMoreThanLoaded = computed(() => this.totalCount() > this.groups().length);
  readonly isPaginationVisible = computed(() => this.filteredGroups().length > this.pageSize());
  readonly isCCA = computed(() => this.accessControlService.accessControlConfig()?.userConfig.org?.isCCA || false);

  ngOnInit(): void {
    this.searchInput.pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(value => {
      this.searchKey.set(value);
      this.currentPage.set(1);
    });

    this.fetchUserGroups();
  }

  fetchUserGroups(): void {
    this.isLoading.set(true);
    this.hasLoadFailed.set(false);
    this.accessControlService
      .searchReusableUserGroups({ filters: {}, pageSize: LOAD_LIMIT, pageNumber: 0, sortBy: SORT_BY, sortOrder: SORT_ORDER })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.groups.set((response?.result?.content || []).map((group: IReusableUserGroupResult) => this.toRow(group)));
          this.totalCount.set(response?.result?.count || this.groups().length);
          this.isLoading.set(false);
        },
        error: () => {
          this.groups.set([]);
          this.totalCount.set(0);
          this.hasLoadFailed.set(true);
          this.isLoading.set(false);
        }
      });
  }

  onSearch(value: string): void {
    this.searchInput.next((value || "").trim().toLowerCase());
  }

  onPageChange(event: { currentPage: number; limit: number }): void {
    this.currentPage.set(event?.currentPage || 1);
    this.pageSize.set(event?.limit || PAGE_SIZE);
  }

  isAlreadyUsed(group: IReuseUserGroupRow): boolean {
    return this.usedGroupIds.has(group?.id);
  }

  selectGroup(group: IReuseUserGroupRow): void {
    if (this.isAlreadyUsed(group)) {
      return;
    }
    this.selectedGroupId.set(group?.id || "");
  }

  cancel(): void {
    this.dialogRef.close({ action: NsAccessControlConfig.IActions.Reject });
  }

  apply(): void {
    const group = this.selectedGroup();
    if (!group || this.isAlreadyUsed(group)) {
      return;
    }
    this.dialogRef.close({ action: NsAccessControlConfig.IActions.Confirm, userGroup: group });
  }

  private toRow(group: IReusableUserGroupResult): IReuseUserGroupRow {
    const conditions = (group?.criteria || []).map(entry => this.toConditionLabel(entry)).filter(Boolean) as string[];
    return {
      id: group?.usergroupid,
      name: group?.usergroupname,
      owner: group?.createdByName || "",
      updatedOn: group?.updateddate || group?.createddate || "",
      conditions,
      searchText: [group?.usergroupname, ...conditions].join(" ").toLowerCase()
    };
  }

  private toConditionLabel(entry: any): string {
    const criteriaKey = entry?.criteriaKey || Object.keys(entry || {})[0];
    if (!criteriaKey) {
      return "";
    }
    const isOrganisationCriteria =
      criteriaKey === NsAccessControlConfig.SelectionType.Organizations || criteriaKey === MINISTRY_OR_STATE_CRITERIA_KEY;
    if (isOrganisationCriteria && !this.isCCA()) {
      return "";
    }
    const criteriaValue = entry?.criteriaKey ? entry?.criteriaValue : entry[criteriaKey];
    const count = Array.isArray(criteriaValue) ? criteriaValue.length : criteriaValue ? 1 : 0;
    if (!count) {
      return "";
    }
    const label = this.entityLabel(criteriaKey);
    return count > 1 ? `${label} is any of ${count}` : `${label} is 1`;
  }

  private entityLabel(criteriaKey: string): string {
    const option = (this.data?.optionsEntity || []).find(item => item?.value === criteriaKey);
    return option?.label || CRITERIA_LABELS[criteriaKey] || criteriaKey;
  }
}
