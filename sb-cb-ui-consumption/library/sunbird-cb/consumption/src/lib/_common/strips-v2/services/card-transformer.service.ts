import { Injectable } from '@angular/core'
import { CardType } from '../models/content-section.model'
import { CardViewModel, PlanCardViewModel, PlanStatus } from '../models/card.model'
import dayjs from 'dayjs'

@Injectable({ providedIn: 'root' })
export class CardTransformerService {

  transformCards(response: unknown, cardType: CardType, apiDetailsKey?: string): any[] {
    if (!response) {
      return []
    }

    switch (cardType) {
      case CardType.CourseCard:
        return this.processCourseCards(response, apiDetailsKey)
      case CardType.AssessmentCard:
        return this.processAssessmentCards(response)
      case CardType.ProgramCard:
        return this.processProgramCards(response)
      case CardType.PlanCard:
        return this.processPlanCards(response, apiDetailsKey)
      default:
        return []
    }
  }

  processCourseCards(response: unknown, apiDetailsKey?: string): any[] {
    const data = this.extractResultArray(response)
    if (apiDetailsKey) {
      return this.mapTheData(data, apiDetailsKey)
    }
    return data.map((item: Record<string, unknown>) => ({
      identifier: (item?.['identifier'] as string) ?? '',
      title: (item?.['name'] as string) ?? '',
      image: (item?.['appIcon'] as string) ?? (item?.['posterImage'] as string) ?? '',
      tags: (item?.['tags'] as string[]) ?? [],
      duration: (item?.['duration'] as string) ?? '',
      status: (item?.['status'] as string) ?? '',
      rating: this.resolveRating(item),
      provider: this.resolveProvider(item),
      organisation: this.resolveOrganisation(item),
      creatorLogo: this.resolveCreatorLogo(item),
      sourceName: this.resolveSourceName(item),
      resourceType: this.resolveResourceType(item),
      languageMapV1: this.resolveLanguageMap(item),
      language: this.resolveLanguage(item),
      difficultyLevel: this.resolveDifficultyLevel(item),
      metadata: item ?? {}
    }))
  }

  mapTheData(data: any, apiDetailsKey?: string): CardViewModel[] {
    const mapedData: CardViewModel[] = []
    switch (apiDetailsKey) {
      // aparApi / trainingPlanApi / draftCBPplanApi are deliberately absent.
      //
      // They each used to map their slice of the CBPlan response into a CardViewModel here,
      // re-deriving the APAR / CBP / AI-CBP split with `isApar` and `planTypeV2` as it went.
      // All three now render CardType.PlanCard, so they go through processPlanCards, and the
      // split is already done upstream by UserCbpPlansService. A key that still arrives here
      // is a config asking for content cards off a plan list, which `default` maps plainly.
      case 'trendingOnIGOTApi':
        data.forEach((item: any) => {
          const card: CardViewModel = {
            identifier: (item?.['identifier'] as string) ?? '',
            title: (item?.['name'] as string) ?? '',
            image: (item?.['appIcon'] as string) ?? (item?.['posterImage'] as string) ?? '',
            additionalTags: (item?.['additionalTags'] as string[]) ?? [],
            duration: (item?.['duration'] as string) ?? '',
            status: (item?.['status'] as string) ?? '',
            rating: this.resolveRating(item),
            provider: this.resolveProvider(item, true),
            organisation: this.resolveOrganisation(item),
            creatorLogo: this.resolveCreatorLogo(item),
            sourceName: this.resolveSourceName(item),
            resourceType: this.resolveResourceType(item),
            languageMapV1: this.resolveLanguageMap(item),
            language: this.resolveLanguage(item),
            difficultyLevel: this.resolveDifficultyLevel(item),
            planDuration: item['planDuration'],
            contentStatus: item['contentStatus'],
            courseCategory: item['courseCategory'],
            primaryCategory: item['primaryCategory'],
            metadata: item ?? {}
          }
          mapedData.push(card)
        })
        break
      case 'featuredAiCoursesApi':
        data.forEach((item: any) => {
          const card: CardViewModel = {
            identifier: (item?.['identifier'] as string) ?? '',
            title: (item?.['name'] as string) ?? '',
            image: (item?.['posterImage'] as string) ?? (item?.['posterImage'] as string) ?? '',
            additionalTags: (item?.['tags'] as string[]) ?? [],
            duration: (item?.['duration'] as string) ?? '',
            status: (item?.['status'] as string) ?? '',
            rating: this.resolveRating(item),
            provider: this.resolveProvider(item),
            organisation: this.resolveOrganisation(item),
            creatorLogo: this.resolveCreatorLogo(item),
            sourceName: this.resolveSourceName(item),
            resourceType: this.resolveResourceType(item),
            languageMapV1: this.resolveLanguageMap(item),
            language: this.resolveLanguage(item),
            difficultyLevel: this.resolveDifficultyLevel(item),
            planDuration: item['planDuration'],
            contentStatus: item['contentStatus'],
            courseCategory: item['courseCategory'],
            primaryCategory: item['primaryCategory'],
            metadata: item ?? {}
          }
          mapedData.push(card)
        })
        break
      default:
        data.forEach((item: any) => {
          const card: CardViewModel = {
            identifier: (item?.['identifier'] as string) ?? '',
            title: (item?.['name'] as string) ?? '',
            image: (item?.['posterImage'] as string) ?? (item?.['posterImage'] as string) ?? '',
            additionalTags: (item?.['tags'] as string[]) ?? [],
            duration: (item?.['duration'] as string) ?? '',
            status: (item?.['status'] as string) ?? '',
            rating: this.resolveRating(item),
            provider: this.resolveProvider(item),
            organisation: this.resolveOrganisation(item),
            creatorLogo: this.resolveCreatorLogo(item),
            sourceName: this.resolveSourceName(item),
            resourceType: this.resolveResourceType(item),
            languageMapV1: this.resolveLanguageMap(item),
            language: this.resolveLanguage(item),
            difficultyLevel: this.resolveDifficultyLevel(item),
            planDuration: item['planDuration'],
            contentStatus: item['contentStatus'],
            courseCategory: item['courseCategory'],
            primaryCategory: item['primaryCategory'],
            metadata: item ?? {}
          }
          mapedData.push(card)
        })

    }
    return mapedData
  }

  processAssessmentCards(response: unknown): CardViewModel[] {
    const data = this.extractResultArray(response)
    return data.map((item: Record<string, unknown>) => ({
      identifier: (item?.['identifier'] as string) ?? '',
      title: (item?.['name'] as string) ?? '',
      image: (item?.['appIcon'] as string) ?? '',
      additionalTags: (item?.['tags'] as string[]) ?? [],
      duration: (item?.['expectedDuration'] as string) ?? '',
      status: (item?.['assessmentStatus'] as string) ?? '',
      rating: this.resolveRating(item),
      provider: this.resolveProvider(item),
      organisation: this.resolveOrganisation(item),
      creatorLogo: this.resolveCreatorLogo(item),
      sourceName: this.resolveSourceName(item),
      resourceType: this.resolveResourceType(item),
      languageMapV1: this.resolveLanguageMap(item),
      language: this.resolveLanguage(item),
      difficultyLevel: this.resolveDifficultyLevel(item),
      planDuration: (item?.['planDuration'] as string) ?? '',
      contentStatus: (item?.['contentStatus'] as number) ?? 0,
      courseCategory: item['courseCategory'] as string,
      primaryCategory: item['primaryCategory'] as string,
      metadata: item ?? {}
    }))
  }

  processProgramCards(response: unknown): CardViewModel[] {
    const data = this.extractResultArray(response)
    return data.map((item: Record<string, unknown>) => ({
      identifier: (item?.['identifier'] as string) ?? '',
      title: (item?.['name'] as string) ?? '',
      image: (item?.['appIcon'] as string) ?? '',
      additionalTags: (item?.['tags'] as string[]) ?? [],
      duration: (item?.['duration'] as string) ?? '',
      status: (item?.['programStatus'] as string) ?? '',
      rating: this.resolveRating(item),
      provider: this.resolveProvider(item),
      organisation: this.resolveOrganisation(item),
      creatorLogo: this.resolveCreatorLogo(item),
      sourceName: this.resolveSourceName(item),
      resourceType: this.resolveResourceType(item),
      languageMapV1: this.resolveLanguageMap(item),
      language: this.resolveLanguage(item),
      difficultyLevel: this.resolveDifficultyLevel(item),
      planDuration: (item?.['planDuration'] as string) ?? '',
      contentStatus: (item?.['contentStatus'] as number) ?? 0,
      courseCategory: item['courseCategory'] as string,
      primaryCategory: item['primaryCategory'] as string,
      metadata: item ?? {}
    }))
  }

  /**
   * Plan-level cards: one card per CBP / APAR / AI-CBP training plan.
   *
   * Fed by the plan-level lists CBPlan V4 returns, NOT by a content dictionary — those
   * flatten every plan down to one item per content id, so the plan itself (its name, year,
   * content count) is already gone by the time the transformer sees them.
   *
   * The plan list is shared by all three plan pills, so each `apiDetailsKey` narrows it to the
   * plans that pill owns — mirroring the aparApi / trainingPlanApi / draftCBPplanApi split above.
   */
  processPlanCards(response: unknown, apiDetailsKey?: string): PlanCardViewModel[] {
    const data = this.extractResultArray(response)

    return data
      .filter((item) => this.belongsToPlanPill(item, apiDetailsKey))
      .map((item) => this.toPlanCard(item))
  }

  private belongsToPlanPill(item: Record<string, unknown>, apiDetailsKey?: string): boolean {
    const planType = this.resolvePlanType(item)
    switch (apiDetailsKey) {
      case 'aparPlanListApi':
      // CBPlan V4 hands each section its own pre-split list, so this is a guard rather
      // than the filter that does the work — it keeps a list that reached the wrong
      // section from rendering there.
      case 'aparApi':
        return planType === 'APAR'
      case 'draftCBPplanListApi':
      case 'draftCBPplanApi':
        return planType === 'AICBP'
      case 'trainingPlanListApi':
      case 'trainingPlanApi':
        return planType === 'CBP'
      // An unrecognised key must not silently empty the strip — show every plan.
      default:
        return true
    }
  }

  private toPlanCard(item: Record<string, unknown>): PlanCardViewModel {
    const contentList = item?.['contentList']
    // Resolved once: the CA tag is gated on the plan being APAR, so the two must agree.
    const planType = this.resolvePlanType(item)
    // Either name: the CBPlan user dictionary (and the plan search) send
    // `comprehensiveAssessment`, /cbplan/v4/read/:id sends `caLinkedId`. PlansService
    // normalises the read response, but this transformer is also handed raw payloads.
    const comprehensiveAssessment = this.firstString([
      item?.['comprehensiveAssessment'],
      item?.['caLinkedId'],
    ])

    return {
      // Each source names the plan id differently: the plan search sends `id`, CBPlan V4
      // sends `planId`, and `identifier` is only ever present on content. Missing it leaves
      // the card unclickable, so all three are accepted.
      identifier: this.firstString([item?.['id'], item?.['planId'], item?.['identifier']]),
      title: this.firstString([item?.['name'], item?.['planName']]),
      planYear: this.firstString([item?.['planYear']]),
      endDate: this.firstString([item?.['endDate']]),
      contentCount: Array.isArray(contentList) ? contentList.length : 0,
      contentType: this.firstString([item?.['contentType']]),
      // Falls back to the creator's name until the plan list carries an org name — the
      // response only identifies the owning org by id (`orgIdList`).
      createdByName: this.firstString([
        item?.['orgName'],
        item?.['organisationName'],
        // CBPlan V4 names the owning org outright, so it does not need the fallback below.
        item?.['createdByOrgName'],
        this.resolveOrganisation(item)[0],
        item?.['createdByName'],
      ]),
      // Left empty when the source has no logo; CardPlanV2Component substitutes the
      // instance logo, which is a display decision and not the transformer's to make.
      createdByLogo: this.firstString([
        item?.['createdByOrgLogo'],
        item?.['orgLogo'],
        item?.['createdByLogo'],
      ]),
      status: this.firstString([item?.['status']]),
      planType,
      // An APAR plan can carry a comprehensive assessment the learner has to clear on top
      // of its courses, which the card flags. `comprehensiveAssessment` is a content id, so
      // presence is the whole signal — the id itself is only needed on the detail page.
      hasComprehensiveAssessment: planType === 'APAR' && !!comprehensiveAssessment,
      planStatus: this.resolvePlanStatus(item),
      metadata: item ?? {},
    }
  }

  
  /** APAR wins over AI-CBP, matching the MAX(endDate) tie-break used for content cards. */
  private resolvePlanType(item: Record<string, unknown>): PlanCardViewModel['planType'] {
    if (item?.['isApar'] === true) {
      return 'APAR'
    }
    // `planType` is the plan-level field; `planTypeV2` is the name it carries once flattened
    // onto content, and plan payloads have been seen with either.
    const type = this.firstString([item?.['planType'], item?.['planTypeV2']]).toUpperCase()
    return type === 'AICBP' ? 'AICBP' : 'CBP'
  }

  /**
   * Badge state on the card's media area.
   *
   * The plan list carries no per-user progress, so completion is only claimed when the
   * response actually reports it; otherwise the state is date-derived — past its end date is
   * Overdue, anything else is In Progress.
   */
  private resolvePlanStatus(item: Record<string, unknown>): PlanStatus {
    const progress = Number(item?.['progress'] ?? item?.['completionPercentage'])
    const isCompleted = progress === 100
      || item?.['contentStatus'] === 2
      || this.firstString([item?.['planStatus']]).toLowerCase() === 'completed'
    if (isCompleted) {
      return 'completed'
    }

    const endDate = this.firstString([item?.['endDate']])
    if (endDate && dayjs(dayjs(endDate).format('YYYY-MM-DD')).diff(dayjs().format('YYYY-MM-DD'), 'day') < 0) {
      return 'overdue'
    }
    return 'inProgress'
  }

  private firstString(values: unknown[]): string {
    const match = values.find((value): value is string => typeof value === 'string' && !!value.trim())
    return match ?? ''
  }

  /**
   * Level shown on the card chip. Content publishes it as `difficultyLevel`; `complexityLevel` is
   * the authoring-side name and `knowledgeLevel` the legacy one, so accept whichever is present.
   * Reading only `complexityLevel` left the chip blank on every cbplan / search-backed section.
   */
  private resolveDifficultyLevel(item: Record<string, unknown>): string {
    const level = [
      item?.['difficultyLevel'],
      item?.['complexityLevel'],
      item?.['knowledgeLevel'],
    ].find((value): value is string => typeof value === 'string' && !!value.trim())

    return level ?? ''
  }

  private resolveRating(item: Record<string, unknown>): number {
    const raw = item?.['avgRating'] ?? item?.['averageRating']
    const rating = Number(raw)
    return Number.isFinite(rating) ? rating : 0
  }

  /**
   * Provider org names, e.g. ['Ministry of Coal'] — the card footer renders organisation[0].
   * `organisation` is what search / cbplan / enrolment content carries; the rest are the
   * single-name shapes used by the trending, playlist and external (CIOS) responses.
   */
  private resolveOrganisation(item: Record<string, unknown>): string[] {
    const orgs = item?.['organisation']
    if (Array.isArray(orgs)) {
      const names = orgs.filter((org): org is string => typeof org === 'string' && !!org.trim())
      if (names.length) {
        return names
      }
    } else if (typeof orgs === 'string' && orgs.trim()) {
      return [orgs]
    }

    const partner = item?.['contentPartner'] as Record<string, unknown> | undefined
    const name = [
      item?.['orgName'],
      item?.['orgname'],
      item?.['sourceName'],
      item?.['source'],
      partner?.['contentPartnerName'],
      item?.['channelName'],
    ].find((value): value is string => typeof value === 'string' && !!value.trim())

    return name ? [name] : []
  }

  /** Org logo shown next to the org name. `contentPartner.link` is the external-content variant. */
  private resolveCreatorLogo(item: Record<string, unknown>): string {
    const partner = item?.['contentPartner'] as Record<string, unknown> | undefined
    const logo = [
      item?.['creatorLogo'],
      item?.['orgLogo'],
      item?.['sourceIconUrl'],
      partner?.['link'],
    ].find((value): value is string => typeof value === 'string' && !!value.trim())

    return logo ?? ''
  }

  /** Display provider — the org name wins when the source fields are absent. */
  private resolveProvider(item: Record<string, unknown>, preferSource = false): string {
    const sources = preferSource
      ? [item?.['source'], item?.['sourceName']]
      : [item?.['sourceName'], item?.['source']]
    const source = sources.find((value): value is string => typeof value === 'string' && !!value.trim())
    return source ?? this.resolveOrganisation(item)[0] ?? ''
  }

  private resolveSourceName(item: Record<string, unknown>): string {
    const sourceName = item?.['sourceName']
    return typeof sourceName === 'string' ? sourceName : ''
  }

  private resolveResourceType(item: Record<string, unknown>): string {
    const resourceType = item?.['resourceType']
    return typeof resourceType === 'string' ? resourceType : ''
  }

  /** Per-language translation map ({ hindi: { id, status, isBaseLang } }) — drives the language pill. */
  private resolveLanguageMap(item: Record<string, unknown>): Record<string, any> {
    const map = item?.['languageMapV1']
    return map && typeof map === 'object' && !Array.isArray(map) ? map as Record<string, any> : {}
  }

  /** Fallback for content published before languageMapV1 existed. */
  private resolveLanguage(item: Record<string, unknown>): string[] {
    const language = item?.['language']
    if (Array.isArray(language)) {
      return language.filter((lang): lang is string => typeof lang === 'string' && !!lang.trim())
    }
    return typeof language === 'string' && language.trim() ? [language] : []
  }

  private extractResultArray(response: unknown): Record<string, unknown>[] {
    if (Array.isArray(response)) {
      return response
    }
    const res = response as Record<string, unknown> | null
    if (res?.['result'] && Array.isArray(res['result'])) {
      return res['result'] as Record<string, unknown>[]
    }
    if (res?.['result'] && typeof res['result'] === 'object') {
      const result = res['result'] as Record<string, unknown>
      if (result?.['content'] && Array.isArray(result['content'])) {
        return result['content'] as Record<string, unknown>[]
      }
      if (result?.['data'] && Array.isArray(result['data'])) {
        return result['data'] as Record<string, unknown>[]
      }
      // Some plan payloads nest one level deeper:
      // { result: { result: { data: [...], totalCount, facets } } }.
      if (result?.['result'] && typeof result['result'] === 'object') {
        const inner = result['result'] as Record<string, unknown>
        if (Array.isArray(inner?.['data'])) {
          return inner['data'] as Record<string, unknown>[]
        }
        if (Array.isArray(inner?.['content'])) {
          return inner['content'] as Record<string, unknown>[]
        }
      }
    }
    if (res?.['data'] && Array.isArray(res['data'])) {
      return res['data'] as Record<string, unknown>[]
    }
    if (res?.['response'] && typeof res['response'] === 'object') {
      const responseObj = res?.['response'] as Record<string, unknown> | undefined
      if (responseObj?.['courses'] && Array.isArray(responseObj['courses'])) {
        return responseObj['courses'] as Record<string, unknown>[]
      } else if (responseObj?.['under_30_mins'] && Array.isArray(responseObj['under_30_mins'])) {
        return responseObj['under_30_mins'] as Record<string, unknown>[]
      }
    }
    return []
  }
}
