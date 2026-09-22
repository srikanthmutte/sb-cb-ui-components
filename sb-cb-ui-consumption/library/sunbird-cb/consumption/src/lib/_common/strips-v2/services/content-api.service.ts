import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { BehaviorSubject, Observable, of, Subject } from 'rxjs'
import { catchError, map, switchMap } from 'rxjs/operators'
import { ApiMethod, ApiRegistryEntry, ChainedApiConfig, ContentSectionConfig } from '../models/content-section.model'
import { API_REGISTRY } from '../registry/api-registry'
import { ConfigurationsService, WidgetEnrollService } from '@sunbird-cb/utils-v2'
import { IUserCbpPlan, UserCbpPlansService } from '../../../_services/user-cbp-plans.service'
import * as _ from 'lodash'

@Injectable({ providedIn: 'root' })
export class ContentApiService {
  private http = inject(HttpClient);
  private configSvc = inject(ConfigurationsService);
  private userCbpPlansSvc = inject(UserCbpPlansService);
  private userServiceLib = inject(WidgetEnrollService);
  private readonly cardClickDetailsSubject = new Subject<any>()
  readonly cardClickDetails$ = this.cardClickDetailsSubject.asObservable()

  private readonly emptySectionKeysSubject = new BehaviorSubject<string[]>([])
  readonly emptySectionKeys$ = this.emptySectionKeysSubject.asObservable()

  private readonly sectionUpdateSubject = new Subject<{ sectionKey: string; changes: Partial<ContentSectionConfig> }>()
  // Lets a consumer (e.g. HomeV2Component, after a slow info API resolves) patch an already-rendered
  // section's config in place — ContetnSectionsComponent merges these into its sections signal.
  readonly sectionUpdate$ = this.sectionUpdateSubject.asObservable()

  publishCardClickDetails(details: any): void {
    this.cardClickDetailsSubject.next(details)
  }

  reportEmptySection(sectionKey: string): void {
    if (!sectionKey) {
      return
    }
    const current = this.emptySectionKeysSubject.value
    if (!current.includes(sectionKey)) {
      this.emptySectionKeysSubject.next([...current, sectionKey])
    }
  }

  updateSection(sectionKey: string, changes: Partial<ContentSectionConfig>): void {
    if (!sectionKey) {
      return
    }
    this.sectionUpdateSubject.next({ sectionKey, changes })
  }

  async loadContent(apiDetailsKey: string): Promise<Observable<unknown>> {
    switch (apiDetailsKey) {
      case 'aparApi':
      case 'trainingPlanApi':
      case 'draftCBPplanApi':
      // The older *PlanListApi spellings resolve here too. They named the retired plan
      // search, so a config still using one would otherwise call an endpoint we no longer
      // use; routing them to V4 keeps those configs working without a config deploy.
      case 'aparPlanListApi':
      case 'trainingPlanListApi':
      case 'draftCBPplanListApi':
        // CBPlan V4. These keys are slices of ONE response, and UserCbpPlansService already
        // splits them — so each section takes its own list off a single call rather than
        // fetching and re-filtering the whole dataset.
        return of(await this.loadCbpPlansV4(apiDetailsKey))
      default:
        let config: ApiRegistryEntry | undefined
        const globalApiConfig = _.get(this.configSvc, 'globalConfig.apis.apiRegistryConfig')
        if (globalApiConfig && globalApiConfig[apiDetailsKey]) {
          const apiConfig = globalApiConfig[apiDetailsKey]
          const methodKey = String(apiConfig.method).split('.').pop() as keyof typeof ApiMethod
          config = { ...apiConfig, method: ApiMethod[methodKey] }

          if (config && config.chainedApi) {
            const chainedMethodKey = String(config.chainedApi.method).split('.').pop() as keyof typeof ApiMethod
            const buildBody = config.chainedApi.buildBody
            config.chainedApi = {
              ...config.chainedApi,
              method: ApiMethod[chainedMethodKey],
              buildBody: buildBody && typeof buildBody === 'string'
                ? new Function(`return ${this.stripParamTypes(buildBody)}`)()
                : buildBody
            }
          }
        } else {
          config = API_REGISTRY[apiDetailsKey]
        }

        if (!config) {
          console.warn(`[ContentApiService] No API config found for key: ${apiDetailsKey}`)
          return of(null)
        }

        return this.executeRequest(config, apiDetailsKey)
    }
  }

  /**
   * The plans for one CBP section, off a single CBPlan V4 call.
   *
   * No dedupe map here: UserCbpPlansService keeps one request per plan year in flight, so
   * the three sections starting together share that one POST and then each take their own
   * pre-split list. The V3 path needed a map at this level because its response was one
   * flat content list that every section re-filtered.
   */
  private async loadCbpPlansV4(apiDetailsKey: string): Promise<IUserCbpPlan[]> {
    const plans = await this.userCbpPlansSvc.getUserCbpPlansAsync()
    switch (apiDetailsKey) {
      case 'aparApi':
      case 'aparPlanListApi':
        return plans.aparPlanList
      case 'draftCBPplanApi':
      case 'draftCBPplanListApi':
        return plans.aiCbpPlanList
      case 'trainingPlanApi':
      case 'trainingPlanListApi':
        return plans.cbpPlanList
      default:
        return []
    }
  }

  private executeRequest(config: ApiRegistryEntry, apiDetailsKey: string): Observable<unknown> {
    const firstResponse$ = this.makeHttpRequest({
      ...config,
      body: this.applyUserContextFilters(config.body)
    })

    if (!config.chainedApi) {
      return firstResponse$
    }

    const chainedConfig = config.chainedApi

    if (chainedConfig.mode === 'mergeIndependent') {
      return this.executeMergeIndependentChain(firstResponse$, chainedConfig, apiDetailsKey)
    }

    return firstResponse$.pipe(
      switchMap(firstResponse => {
        const sourceList = this.getNestedValue(firstResponse, chainedConfig.sourceListPath)

        if (!Array.isArray(sourceList) || sourceList.length === 0) {
          return of([])
        }

        const identifierField = chainedConfig.identifierField as string

        if (apiDetailsKey === 'caProgramApi') {
          return this.executeCaProgramChain(firstResponse, sourceList, identifierField, chainedConfig)
        }

        const identifiers = sourceList
          .map(item => (item as Record<string, unknown>)[identifierField])
          .filter((id): id is string => typeof id === 'string' && !!id)

        if (identifiers.length === 0) {
          return of([])
        }

        return this.makeHttpRequest({
          endpoint: chainedConfig.endpoint,
          method: chainedConfig.method,
          body: chainedConfig.buildBody(identifiers),
          queryParams: chainedConfig.queryParams,
          addUserId: chainedConfig.addUserId
        }).pipe(
          map(secondResponse => {
            const enrolledList = this.getNestedValue(secondResponse, chainedConfig.enrolledListPath)

            if (!Array.isArray(enrolledList) || enrolledList.length === 0) {
              return []
            }

            const filteredEnrolledList = apiDetailsKey === 'standaloneApi'
              ? enrolledList.filter(item => this.hasActiveBatch(item) && !this.isFullyCompleted(item))
              : enrolledList

            if (filteredEnrolledList.length === 0) {
              return []
            }

            const enrolledMatchField = chainedConfig.enrolledMatchField as string
            const enrolledIds = new Set(
              filteredEnrolledList.map(item => (item as Record<string, unknown>)[enrolledMatchField])
            )

            const filteredContent = sourceList.filter(item =>
              enrolledIds.has((item as Record<string, unknown>)[identifierField])
            )

            return this.setNestedValue(firstResponse, chainedConfig.sourceListPath, filteredContent)
          })
        )
      })
    )
  }

  // caProgramApi: drop programs whose endDate has already passed, then hide any of the
  // remaining ones that the user has already enrolled in AND fully completed (100%).
  private executeCaProgramChain(
    firstResponse: unknown,
    sourceList: unknown[],
    identifierField: string,
    chainedConfig: ChainedApiConfig
  ): Observable<unknown> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activeList = sourceList.filter(item => {
      const endDate = (item as Record<string, unknown>)['endDate'] as string | undefined
      if (!endDate) {
        return true
      }
      const itemEndDate = new Date(endDate)
      itemEndDate.setHours(0, 0, 0, 0)
      return itemEndDate.getTime() >= today.getTime()
    })

    if (activeList.length === 0) {
      return of(this.setNestedValue(firstResponse, chainedConfig.sourceListPath, activeList))
    }

    const identifiers = activeList
      .map(item => (item as Record<string, unknown>)[identifierField])
      .filter((id): id is string => typeof id === 'string' && !!id)

    if (identifiers.length === 0) {
      return of(this.setNestedValue(firstResponse, chainedConfig.sourceListPath, activeList))
    }

    const request = {
      request: {
        courseId: identifiers
      }
    }

    return this.userServiceLib.fetchEnrollContentData(request).pipe(
      map(enrollResponse => {
        const enrolledList = this.getNestedValue(enrollResponse, chainedConfig.enrolledListPath)

        if (!Array.isArray(enrolledList) || enrolledList.length === 0) {
          return this.setNestedValue(firstResponse, chainedConfig.sourceListPath, activeList)
        }

        const enrolledMatchField = chainedConfig.enrolledMatchField as string
        const completedIds = new Set(
          enrolledList
            .filter(item => {
              const record = item as Record<string, unknown>
              const completion = record['completionPercentage'] ?? record['progress']
              return completion === 100
            })
            .map(item => {
              const record = item as Record<string, unknown>
              return record[enrolledMatchField] ?? record['collectionId']
            })
        )

        const filteredList = activeList.filter(item =>
          !completedIds.has((item as Record<string, unknown>)[identifierField])
        )

        return this.setNestedValue(firstResponse, chainedConfig.sourceListPath, filteredList)
      })
    )
  }

  // Calls the second endpoint unconditionally (independent of the first response, and even if
  // the first request errored — makeHttpRequest already swallows errors into `of(null)`), then
  // concatenates both lists rather than filtering the first by the second.
  private executeMergeIndependentChain(
    firstResponse$: Observable<unknown>,
    chainedConfig: ChainedApiConfig,
    apiDetailsKey: string
  ): Observable<unknown> {
    return firstResponse$.pipe(
      switchMap(firstResponse => {
        const sourceList = this.getNestedValue(firstResponse, chainedConfig.sourceListPath)
        const firstList = Array.isArray(sourceList) ? sourceList : []

        const secondResponse$ = apiDetailsKey === 'continueLearningApi'
          ? this.userServiceLib.fetchExternalEnrollmentData(chainedConfig.buildBody([]))
          : this.makeHttpRequest({
            endpoint: chainedConfig.endpoint,
            method: chainedConfig.method,
            body: chainedConfig.buildBody([]),
            queryParams: chainedConfig.queryParams,
            addUserId: chainedConfig.addUserId
          })

        return secondResponse$.pipe(
          map(secondResponse => {
            const secondListRaw = this.getNestedValue(secondResponse, chainedConfig.enrolledListPath)
            const secondList = Array.isArray(secondListRaw) ? secondListRaw : []
            const merged = [...firstList, ...secondList]
            return this.setNestedValue(firstResponse ?? {}, chainedConfig.sourceListPath, merged)
          })
        )
      })
    )
  }

  private applyUserContextFilters(body: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!body) {
      return body
    }

    // Plan search (/cbplan/v2/search) takes a FLAT body — { filter, pageNumber, pageSize, … } —
    // rather than the { request: { filters } } envelope every content search uses. Its
    // `orgIdList` placeholder still has to be resolved to the signed-in user's org, or the
    // plan strips would ask for every org's plans.
    const flatFilter = (body as Record<string, any>).filter
    if (flatFilter && Object.prototype.hasOwnProperty.call(flatFilter, 'orgIdList')) {
      const rootOrgId = this.configSvc?.userProfile?.rootOrgId
      return {
        ...body,
        filter: {
          ...flatFilter,
          orgIdList: rootOrgId ? [rootOrgId] : [],
        },
      }
    }

    const request = (body as Record<string, any>).request
    if (!request || !request.filters) {
      return body
    }

    const filters = { ...request.filters }

    if (Object.prototype.hasOwnProperty.call(filters, 'secureSettings.organisation')) {
      let orgId
      if (this.configSvc && this.configSvc.userProfile && this.configSvc.userProfile.rootOrgId) {
        orgId = this.configSvc.userProfile.rootOrgId
      }
      if (orgId) {
        filters['secureSettings.organisation'] = orgId
      }
    }

    if (Object.prototype.hasOwnProperty.call(filters, 'secureSettings.isVerifiedKarmayogi')) {
      delete filters['secureSettings.isVerifiedKarmayogi']
      const profileDetails = this.configSvc && this.configSvc.unMappedUser &&
        this.configSvc.unMappedUser.profileDetails
      const profileStatus = profileDetails && profileDetails.profileStatus
      if (!profileStatus || profileStatus.toLowerCase() !== 'verified') {
        filters['secureSettings.isVerifiedKarmayogi'] = 'No'
      }
    }

    return {
      ...body,
      request: {
        ...request,
        filters
      }
    }
  }

  private makeHttpRequest(config: {
    endpoint: string
    method: ApiMethod
    body?: Record<string, unknown>
    queryParams?: Record<string, string>
    addUserId?: boolean
  }): Observable<unknown> {
    let endpoint = config.endpoint
    const params = this.buildHttpParams(config.queryParams)

    if (config.addUserId) {
      const userId = this.getUserId()
      if (userId) {
        endpoint = `${endpoint}${userId}`
      }
    }

    switch (config.method) {
      case ApiMethod.Get:
        return this.http.get(endpoint, { params }).pipe(
          catchError(error => {
            console.error('[ContentApiService] GET request failed:', error)
            return of(null)
          })
        )
      case ApiMethod.Post:
        return this.http.post(endpoint, config.body ?? {}, { params }).pipe(
          catchError(error => {
            console.error('[ContentApiService] POST request failed:', error)
            return of(null)
          })
        )
      default:
        return of(null)
    }
  }

  private stripParamTypes(fnString: string): string {
    return fnString.replace(/\(([^)]*)\)(\s*=>)/, (_match, params: string, arrow: string) => {
      const cleanedParams = params
        .split(',')
        .map(param => param.split(':')[0].trim())
        .join(', ')
      return `(${cleanedParams})${arrow}`
    })
  }

  getUserId(): string | null {
    return this.configSvc.userProfileV2?.userId ?? null
  }

  private buildHttpParams(queryParams: Record<string, string> | undefined): HttpParams {
    let params = new HttpParams()
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        params = params.set(key, value)
      })
    }
    return params
  }

  private hasActiveBatch(item: unknown): boolean {
    const batches = _.get(item, 'content.batches')

    if (!Array.isArray(batches) || batches.length === 0) {
      return false
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return batches.some((batch: any) => {
      const endDate = batch && batch.endDate
      if (!endDate) {
        return false
      }
      const batchEndDate = new Date(endDate)
      batchEndDate.setHours(0, 0, 0, 0)
      return batchEndDate.getTime() > today.getTime()
    })
  }

  private isFullyCompleted(item: unknown): boolean {
    return _.get(item, 'completionPercentage') === 100
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((acc, key) => {
      return acc !== null && acc !== undefined && typeof acc === 'object'
        ? (acc as Record<string, unknown>)[key]
        : undefined
    }, obj)
  }

  private setNestedValue(obj: unknown, path: string, value: unknown): unknown {
    const keys = path.split('.')
    if (keys.length === 1) {
      return { ...(obj as Record<string, unknown>), [keys[0]]: value }
    }
    const [first, ...rest] = keys
    const objRecord = obj as Record<string, unknown>
    return {
      ...objRecord,
      [first]: this.setNestedValue(objRecord[first], rest.join('.'), value)
    }
  }
}

