import { AfterViewInit, Component, EventEmitter, HostListener, Inject, Input, OnChanges, OnInit, Output, QueryList, signal, SimpleChanges, ViewChild, ViewChildren } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfigurationsService, EventService, UtilityService, WsEvents } from '@sunbird-cb/utils-v2'
import { CommonMethodsService } from '@sunbird-cb/consumption'
import { Subscription } from 'rxjs'

import { LoadCheckService } from '../../../services/load-check.service'
import { MatTabGroup as MatTabGroup, MatTabChangeEvent as MatTabChangeEvent } from '@angular/material/tabs'
import { NsDiscussionV2 } from '@sunbird-cb/discussion-v2'
import { AiTutorConfirmPopupComponent } from './ai-tutor-confirm-popup/ai-tutor-confirm-popup.component'
import { MatDialog as MatDialog, MatDialogConfig as MatDialogConfig } from '@angular/material/dialog'
import { viewerRouteGenerator } from '../../../_services/viewer-route-util'
import { AppTocService } from '../../../services/app-toc.service'
import { ActionService } from '../../../services/action.service'
import { VttFile } from '@polyflix/vtt-parser'
import { tap } from 'rxjs/operators'
import { ViewerDataService } from '../../../services/viewer-data.service'
import { MatTab } from '@angular/material/tabs'
import { SamuhikCharchaService } from '../../../_services/samuhik-charcha.service'
import { ComprehensiveAssessmentService } from '../../../_services/comprehensive-assessment.service'
import * as _ from 'lodash'
import { IComprehensiveAssessmentCourse, IComprehensiveAssessmentStatus, NsContent } from '../../../_collection-api'
@Component({
  selector: 'ws-widget-content-toc',
  templateUrl: './content-toc.component.html',
  styleUrls: ['./content-toc.component.scss'],
  standalone: false
})

export class ContentTocComponent implements OnInit, AfterViewInit, OnChanges {

  tabChangeValue: any = ''
  @Input() content!: any
  @Input() contentReadData!: any
  @Input() initialRouteData: any
  @Input() changeTab = false
  @Input() baseContentReadData!: any
  routeSubscription: Subscription | null = null
  @Input() forPreview = window.location.href.includes('/public/') || window.location.href.includes('&preview=true')
  @Input() contentTabFlag = true
  @Input() resumeData: any | null = null
  @Input() batchData: /**NsContent.IBatchListResponse */ any | null = null
  @Input() skeletonLoader = false
  @Input() tocStructure: any = {}
  @Input() pathSet: any
  @Input() fromViewer = false
  @Input() hierarchyMapData: any = {}
  @ViewChild('stickyMenu') tabElement!: MatTabGroup
  @ViewChildren(MatTab) tabs!: QueryList<MatTab>
  @Input() condition: any
  @Input() kparray: any
  @Input() selectedBatchData: any
  @Input() config: any
  @Input() componentName!: string
  @Input() isEnrolled!: boolean
  @Input() playResourceId = ''
  @Input() sideNavBarOpened = false
  @Input() languageList = []
  @Input() lockCertificate = false
  @Input() fromMDO = false
  @Input() isBatchFull = false
  @Input() showLimitedSeatsMsg = false
  @Input() areAllActiveBatchesFull = false
  @Input() userEnrollmentList: any = false
  @Output() playResumeForAI = new EventEmitter()
  @Output() enrollUserToAI = new EventEmitter()
  @Output() trigerCompletionSurveyForm = new EventEmitter<boolean>()
  @Output() resumeContent = new EventEmitter<void>()

  commentId?: string = ''
  sticky = false
  menuPosition: any
  isMobile = false
  selectedTabIndex = 0
  discussWidgetData!: NsDiscussionV2.ICommentWidgetData
  teacherNotesFlag = false
  referenceNotesFlag = false
  viewerPage = window.location.href.includes('/viewer/') ? true : false
  resumeDataLink: any
  enableAITutorFlag = false
  enableTranscriptionFlag = false
  courseCategory = NsContent.ECourseCategory
  subTitles$: Subscription | null = null
  resourceIdentifier: any
  resourceIdentifier$: Subscription | null = null
  subTitles: any = []
  keywordToHighlight: any = ''
  highlightCondition = false
  vttLangArr: any = []
  transcriptionActiveLanguage = 'en'
  defaultTranscriptLanguage = 'en'
  transriptionLanguageSub: Subscription | null = null
  selectedTranscriptionStyle: any
  fromAITutor = false
  totalResource = 0
  scormAssessmentCount = 0
  showAITutorPopup = false
  fromAISelectedTabIndex = false
  isMobileForAI = false
  transcriptActiveLanguageText = 'English'
  showAssignmentsTab = false
  enableSamuhikCharchaTab = false
  samuhikConfig: any
  batchId: any

  caPendingCourses: IComprehensiveAssessmentCourse[] = []
  breadcrumbData = signal<any[]>([])

  constructor(
    private route: ActivatedRoute,
    private utilityService: UtilityService,
    private loadCheckService: LoadCheckService,
    private configService: ConfigurationsService,
    public dialog: MatDialog,
    public tocSvc: AppTocService,
    private actionSVC: ActionService,
    private router: Router,
    private eventSvc: EventService,
    private viewerDataSvc: ViewerDataService,
    private samuhikCharchaSvc: SamuhikCharchaService,
    private commonMethodsSvc: CommonMethodsService,
    private comprehensiveAssessmentSvc: ComprehensiveAssessmentService,
    @Inject('environment') private environment: any

  ) { }


  isCommentApiEnabled(): boolean {
    return !!this.commonMethodsSvc.getEnabledUrl({
      apiConfig: this.config?.apiConfig,
      urlConfigPath: 'commentTreeGet',
      defaultUrl: '/apis/proxies/v8/commentTree/v1/get',
    })
  }

  ngOnInit() {
    if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.aiTutor && this.configService.iGOTAIConfig?.aiTutor?.all) {
      this.enableAITutorFlag = this.onlyscormAssessmentExists(this.route.snapshot?.data?.content?.data?.children, 'mimeType', ['application/vnd.ekstep.html-archive', 'application/vnd.sunbird.questionset', 'application/json', 'text/x-url'])
      // this.enableAITutorFlag = true
    } else if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.aiTutor && this.configService.iGOTAIConfig?.aiTutor?.forOrg && this.configService.iGOTAIConfig.aiTutor?.forOrg?.length &&
      this.configService.iGOTAIConfig?.aiTutor?.forOrg.includes(this.configService.userProfile?.rootOrgId)
    ) {
      this.enableAITutorFlag = this.onlyscormAssessmentExists(this.route.snapshot?.data?.content?.data?.children, 'mimeType', ['application/vnd.ekstep.html-archive', 'application/vnd.sunbird.questionset', 'application/json', 'text/x-url'])
      // this.enableAITutorFlag = true
    } else {
      this.enableAITutorFlag = false
    }
    if (this.content && this.content.courseCategory === NsContent.ECourseCategory.LEARNING_PATHWAY) {
      this.enableAITutorFlag = false
    }
    if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.transcription?.all) {
      // this.resourceIdentifier$ = this.tocSvc.transriptionIdentifier.subscribe((value:any)=>{
      //   if(value &&  value?.identifier) {
      //     this.resourceIdentifier = value?.identifier //value?.identifier // do_1138891198489067521147
      //     this.parseVTT()
      //   }

      // })

      this.subTitles$ = this.tocSvc.transcriptionData$.subscribe((value: any) => {
        this.keywordToHighlight = value
      })

      this.transriptionLanguageSub = this.tocSvc.transriptionActiveLanguageDataObject$
        .pipe(
          tap((langvalue: any) => console.log('tap langvalue:', langvalue))
        )
        .subscribe((langvalue: any) => {
          if (langvalue) {
            // this.renderSelectedLanguageTranscription();
          }

        })
      this.enableTranscriptionFlag = true
    } else if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.transcription && this.configService.iGOTAIConfig?.transcription?.forOrg && this.configService.iGOTAIConfig?.transcription?.forOrg?.length &&
      this.configService.iGOTAIConfig?.transcription?.forOrg?.includes(this.configService.userProfile?.rootOrgId)
    ) {
      // this.resourceIdentifier$ = this.tocSvc.transriptionIdentifier.subscribe((value:any)=>{
      //   if(value &&  value?.identifier) {
      //     this.resourceIdentifier = value?.identifier //value?.identifier // do_1138891198489067521147
      //     this.parseVTT()
      //   }

      // })

      this.subTitles$ = this.tocSvc.transcriptionData$.subscribe((value: any) => {
        this.keywordToHighlight = value
      })

      this.transriptionLanguageSub = this.tocSvc.transriptionActiveLanguageDataObject$
        .pipe(
          tap((langvalue: any) => console.log('tap langvalue:', langvalue))
        )
        .subscribe((langvalue: any) => {
          if (langvalue) {
            // this.renderSelectedLanguageTranscription();
          }

        })
      this.enableTranscriptionFlag = true
    } else {
      this.enableTranscriptionFlag = false
    }

    const batchId = this.route.snapshot.queryParams.batchId ?
      this.route.snapshot.queryParams.batchId : ''
    this.batchId = batchId
    if (batchId) {
      this.selectedTabIndex = 1
    }
    this.commentId = this.route.snapshot.queryParams.commentId ? this.route.snapshot.queryParams.commentId : ''
    if (this.commentId) {
      this.selectedTabIndex = 2
    }

  }

  ngAfterViewInit() {
    this.isMobile = this.utilityService.isMobile
    if (window.innerWidth < 1480) {
      this.isMobileForAI = true
    } else {
      this.isMobileForAI = false
    }
    this.menuPosition =
      this.tabElement._elementRef.nativeElement.offsetTop || 0;

    this.route.queryParamMap.subscribe(async (params: any) => {

      let fromAITutor = params.get('fromAITutor')

      if ((fromAITutor === 'true' || fromAITutor === true) && this.isMobile) {
        setTimeout(() => {
          const tabsArray = this.tabs?.toArray()
          let index = tabsArray?.findIndex(tab => tab.textLabel.trim() === "AI Tutor".trim())
          if (index > -1) {
            this.selectedTabIndex = index
            this.fromAISelectedTabIndex = true
          }
        }, 3000)

      }
    })
  }

  get getCurrentTimeInUTC(): string {
    const currentDate = new Date()
    const isoString = currentDate.toISOString()
    return isoString.replace('Z', '+0000')
  }

  private async getSamuhikConfig() {
    try {
      this.samuhikConfig = await this.samuhikCharchaSvc.fetchConfigFile().toPromise()
    } catch (error) {
    }
  }

  async ngOnChanges(changes: SimpleChanges) {

    if (changes['contentReadData'] || changes['content']) {
      this.loadComprehensiveAssessmentStatus()
    }

    this.resourceIdentifier = this.viewerDataSvc.resourceId

    if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.transcription?.all) {
      this.enableTranscriptionFlag = true
    } else if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.transcription && this.configService.iGOTAIConfig?.transcription?.forOrg && this.configService.iGOTAIConfig?.transcription?.forOrg?.length &&
      this.configService.iGOTAIConfig?.transcription?.forOrg?.includes(this.configService?.userProfile?.rootOrgId)
    ) {
      this.enableTranscriptionFlag = true
    } else {
      this.enableTranscriptionFlag = false
    }

    if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.aiTutor && this.configService.iGOTAIConfig.aiTutor?.all) {
      this.enableAITutorFlag = this.onlyscormAssessmentExists(this.content?.children, 'mimeType', ['application/vnd.ekstep.html-archive', 'application/vnd.sunbird.questionset', 'application/json', 'text/x-url'])
      // this.enableAITutorFlag = true
    } else if (this.configService.iGOTAIConfig && this.configService.iGOTAIConfig?.aiTutor && this.configService.iGOTAIConfig?.aiTutor?.forOrg && this.configService.iGOTAIConfig?.aiTutor?.forOrg?.length
      && this.configService.iGOTAIConfig.aiTutor?.forOrg?.includes(this.configService?.userProfile?.rootOrgId)
    ) {
      this.enableAITutorFlag = this.onlyscormAssessmentExists(this.content?.children, 'mimeType', ['application/vnd.ekstep.html-archive', 'application/vnd.sunbird.questionset', 'application/json', 'text/x-url'])
    } else {
      this.enableAITutorFlag = false
    }

    if (this.content && this.content.courseCategory === NsContent.ECourseCategory.LEARNING_PATHWAY) {
      this.enableAITutorFlag = false
    }

    if (changes && changes['playResourceId']) {
      if (changes?.playResourceId?.previousValue !== changes?.playResourceId?.currentValue) {
        if (this.viewerPage && this.enableTranscriptionFlag) {
          this.resourceIdentifier = this.playResourceId || this.viewerDataSvc?.resourceId
          this.subTitles = []
          this.vttLangArr = []
          this.parseVTT()
        }
      }
    }
    if (changes.changeTab && changes.changeTab.currentValue && !this.fromAISelectedTabIndex) {
      this.selectedTabIndex = 1
    }
    if (this.route.snapshot.data.pageData && this.route.snapshot.data.pageData.data) {
      this.config = this.route.snapshot.data.pageData.data
    }
    if (this.config && this.config.discussWidgetData) {
      this.discussWidgetData = this.config.discussWidgetData
      if (this.baseContentReadData && this.baseContentReadData.identifier) {
        if (!this.discussWidgetData.newCommentSection.commentTreeData.entityId) {
          this.discussWidgetData.newCommentSection.commentTreeData.entityId = this.baseContentReadData.identifier
        }
        if (this.discussWidgetData.commentsList.repliesSection && this.discussWidgetData.commentsList.repliesSection.newCommentReply) {
          this.discussWidgetData.commentsList.repliesSection.newCommentReply.commentTreeData.entityId = this.baseContentReadData.identifier
        }
      }

      if (this.isEnrolled) {
        if (this.content && this.content.primaryCategory === NsContent.ECourseCategory.BLENDED_PROGRAM) {
          this.showAssignmentsTab = true
        }
        this.discussWidgetData.enrolledContent = true
        this.discussWidgetData.newCommentSection.commentBox.placeholder = 'Start a discussion'
      } else {
        this.discussWidgetData.enrolledContent = false
        this.discussWidgetData.newCommentSection.commentBox.placeholder = 'Enrol to add your comments'
      }
      if (this.commentId) {
        this.discussWidgetData.newCommentSection.show = false
      }
      this.discussWidgetData = { ...this.discussWidgetData }
    }

    if (this.contentReadData && this.contentReadData?.eventLinked?.length) {
      const orgId = _.get(this.configService, 'userProfile.userRootOrg.id', '')
      await this.getSamuhikConfig()
      const eventsLinked = this.contentReadData.eventLinked || []
      let eventsData: any = []
      this.samuhikConfig?.strips[0].tabs.forEach((ele: any) => {
        ele.request.searchV6.request.filters.identifier = eventsLinked
        ele.request.searchV6.request.filters.createdFor = [orgId]
        if (ele.request.searchV6.request.filters.endDateTime.hasOwnProperty('>=')) {
          ele.request.searchV6.request.filters.endDateTime['>='] = this.getCurrentTimeInUTC
        }
        if (ele.request.searchV6.request.filters.endDateTime.hasOwnProperty('<')) {
          ele.request.searchV6.request.filters.endDateTime['<'] = this.getCurrentTimeInUTC
        }
        this.samuhikCharchaSvc.getSearchV6Results(ele.request.searchV6).subscribe((res: any) => {
          if (res && res.result && res.result.count && res.result?.Event && res.result.Event?.length) {
            for (let eve = 0; eve < res.result.Event?.length; eve++) {
              if (res.result.Event[eve]['createdFor'] && res.result.Event[eve]['createdFor'].length &&
                res.result.Event[eve]['resourceType'] === 'Samuhik Charcha'
              )
                eventsData.push(res.result.Event[eve]['createdFor'][0])
              if (eventsData.includes(this.configService.userProfile?.rootOrgId)) {
                this.enableSamuhikCharchaTab = true
              }
            }
          }
        })
      })

    }

    if (this.contentReadData && this.contentReadData.referenceNodes) {
      this.contentReadData.referenceNodes.forEach((item: any) => {
        let userRoles: Set<string> = this.configService?.userRoles || new Set()
        let hasEducatorRole = false

        // Check if user has MENTOR role
        if (userRoles.has('MENTOR') ||
          userRoles.has('mentor') ||
          userRoles.has('Mentor')) {
          hasEducatorRole = true
        }

        // Check local storage for survey response only if URL contains 'public' or 'preview=true'
        if (!hasEducatorRole && this.forPreview) {
          const surveyId = this.environment.publicContentSurveyId || ''
          const courseId = this.contentReadData?.identifier || ''
          const storageKey = `survey_${surveyId}_${courseId}`
          const storedData = localStorage.getItem(storageKey)

          if (storedData) {
            try {
              const surveyResponses = JSON.parse(storedData)
              const educatorQuestion = surveyResponses.find((response: any) =>
                response.question === 'Are you an Educator/Faculty member?'
              )
              if (educatorQuestion && educatorQuestion.answer === 'Yes') {
                hasEducatorRole = true
              }
            } catch (error) {
              console.error('Error parsing survey data from local storage:', error)
            }
          }
        }

        // Set teacherNotesFlag if user has educator role
        if (hasEducatorRole) {
          if (item && item.resourceCategory && item.resourceCategory === 'Teachers Resource') {
            this.teacherNotesFlag = true
          }
        }

        if (item && item.resourceCategory && item.resourceCategory === 'Reference Resource') {
          this.referenceNotesFlag = true
        }
      })
    }
    if (this.sideNavBarOpened) {
      if (window.innerWidth < 1480) {
        if (this.isMobileForAI) {
          this.isMobileForAI = false
        }
      } else {
        this.isMobileForAI = false
      }

    } else {
      if (window.innerWidth < 1480) {
        this.isMobileForAI = true
      } else {
        this.isMobileForAI = false
      }
    }

  }

  @HostListener('window:scroll', ['$event'])
  handleScroll() {
    const windowScroll = window.scrollY
    if (windowScroll >= (this.menuPosition - ((this.isMobile) ? 96 : 104))) {
      this.sticky = true
    } else {
      this.sticky = false
    }
  }

  handleTabChange(event: MatTabChangeEvent): void {
    this.tabChangeValue = event.tab
    this.selectedTabIndex = event.index
    this.loadCheckService.componentLoaded(true)
    if (event && event.tab.textLabel === 'AI Tutor') {
      this.showAITutorPopup = true
    }
    if (event && event.index === 0 && event.tab.textLabel === 'Transcription') {
      this.raiseTranscriptionTabStartTelemetry()
      setTimeout(() => {
        this.raiseTranscriptionTabInteractTelemetry()
      }, 1000)
    } else {
      this.raiseTranscriptionTabStopTelemetry()
    }

  }

  showAiTutorConfirmPopup() {
    this.raiseAIPopupStartTelemetry()
    if (this.isEnrolled) {
      this.fromAITutor = true
      setTimeout(() => {
        this.raiseAIPopupInteractTelemetry()
      }, 1000)


      this.generateResumeDataLinkNew()
      setTimeout(() => {
        this.raiseAIPopupEndTelemetry()
      }, 1000)
    } else {
      setTimeout(() => {
        this.raiseAIPopupInteractTelemetry()
      }, 1000)
      const dialogConfig = new MatDialogConfig()

      dialogConfig.width = '421px'
      dialogConfig.data = {
        enroll: this.isEnrolled
      }
      const dialogRef = this.dialog.open(AiTutorConfirmPopupComponent, dialogConfig)

      dialogRef.afterClosed().subscribe((response: any) => {
        if (response === 'enroll') {
          this.fromAITutor = true
          this.generateResumeDataLinkNew()
        } else if (response === 'needToEnroll') {
          this.enrollUserForAITutor()
        }
        this.raiseAIPopupEndTelemetry()
      })
    }

  }

  generateResumeDataLinkNew() {
    if (this.resumeData && this.content) {
      let resumeDataV2: any
      if (this.content.completionPercentage === 100) {
        resumeDataV2 = this.getResumeDataFromList('start')
      } else {
        resumeDataV2 = this.getResumeDataFromList()
      }
      if (!resumeDataV2.mimeType) {
        resumeDataV2.mimeType = this.tocSvc.getMimeType(this.content, resumeDataV2.identifier)
      }
      this.resumeDataLink = viewerRouteGenerator(
        resumeDataV2.identifier,
        resumeDataV2.mimeType,
        this.content.identifier,
        this.content.contentType,
        this.forPreview,
        'Learning Resource',
        this.getBatchId(),
        this.content.name,
      )
      this.actionSVC.setUpdateCompGroupO = this.resumeDataLink
      this.router.navigate([this.resumeDataLink.url], {
        queryParams: {
          ...this.resumeDataLink.queryParams,
          fromAITutor: this.fromAITutor
        }
      })
      // this.router.navigateByUrl(
      //   [this.resumeDataLink.url],
      //   {
      //     relativeTo: this.resumeDataLink.url,
      //     queryParams: this.resumeDataLink.queryParams,
      //     queryParamsHandling: 'merge',
      //   })
      /* tslint:disable-next-line */
    } else {
      this.playResumeForAI.emit()
    }
  }

  private getResumeDataFromList(type?: string): any | void {
    const resumeCopy = [...this.resumeData]
    if (!type) {
      // tslint:disable-next-line:max-line-length

      const lastItem = resumeCopy && resumeCopy.sort((a: any, b: any) =>
        new Date(b.lastAccessTime).getTime() - new Date(a.lastAccessTime).getTime()).shift()
      return {
        identifier: lastItem.contentId,
        mimeType: lastItem.progressdetails && lastItem.progressdetails.mimeType,
      }
    }
    const firstItem = resumeCopy && resumeCopy.length && resumeCopy[0]
    return {
      identifier: firstItem.contentId,
      mimeType: firstItem.progressdetails && firstItem.progressdetails.mimeType,
    }
  }

  public getBatchId(): string {
    let batchId = ''
    if (this.batchData && this.batchData.content) {
      for (const batch of this.batchData.content) {
        batchId = batch.batchId
      }
    }
    return batchId
  }

  raiseAIPopupStartTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": "ai-tutor-toc-page", "pageid": `/app/toc/${this.content?.identifier}` },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Loaded,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: '/app/toc', module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  raiseAIPopupEndTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": "ai-tutor-toc-page", "pageid": `/app/toc/${this.content?.identifier}` },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Unloaded,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: '/app/toc', module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  raiseAIPopupInteractTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": "ai-tutor-toc-page", "pageid": `/app/toc/${this.content?.identifier}` },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Interact,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: '/app/toc', module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  enrollUserForAITutor() {
    this.enrollUserToAI.emit()
  }

  async parseVTT() {
    let identifier = this.resourceIdentifier
    // resolve the transcoder-stats api from toc config; empty url => disabled (e.g. public / preview)
    const vttUrl = this.commonMethodsSvc.getEnabledUrl({
      apiConfig: this.config?.apiConfig,
      urlConfigPath: 'aiResourceTranscoderStats',
      defaultUrl: '/apis/proxies/v8/chatbot/v3/transcoder/stats',
    })
    if (!vttUrl) {
      this.vttLangArr = []
      this.enableTranscriptionFlag = false
      return
    }
    // console.log('identifier--', identifier)
    await this.tocSvc.aiGetResourceVttFile(identifier, vttUrl).subscribe(async (datas: any) => {
      let data: any = datas?.data
      if (data && data.length && data[0]['transcription_urls'] && data[0]['transcription_urls'].length) {
        this.vttLangArr = data[0]['transcription_urls']

        this.enableTranscriptionFlag = true
        // let url =  data[0]['transcription_urls'][0]['uri']
        this.transcriptionActiveLanguage = this.vttLangArr && this.vttLangArr.length && this.vttLangArr[0] && this.vttLangArr[0]['default_lang'] ? 'en' : 'en'
        this.defaultTranscriptLanguage = this.vttLangArr && this.vttLangArr.length && this.vttLangArr[0] && this.vttLangArr[0]['default_lang'] ? 'en' : 'en'
        let selectedTranscriptionStyle = this.vttLangArr.filter((item: any) => {
          return item?.label === this.transcriptionActiveLanguage
        })
        if (selectedTranscriptionStyle && selectedTranscriptionStyle.length) {
          this.selectedTranscriptionStyle = selectedTranscriptionStyle[0]
        } else {
          this.selectedTranscriptionStyle = this.vttLangArr[0]
        }
        const filteredArr = this.vttLangArr.filter(
          (item: any) => item.label === this.transcriptionActiveLanguage
        )
        let url = filteredArr.length > 0 ? filteredArr[0].uri : null
        //let url = this.vttLangArr.filter((item: any) => item.label === this.transcriptionActiveLanguage)[0]['uri']
        if (url) {
          const file = await VttFile.fromUrl(url)
          let blocks: any = file.getBlocks()

          this.subTitles = blocks
        }
        this.tocSvc.changeTranscriptionLanguageEvent.next({ activeLang: this.transcriptionActiveLanguage, langData: this.vttLangArr, loadPlayer: true })


      } else {
        this.vttLangArr = []
        this.enableTranscriptionFlag = false
      }

    })

  }

  async renderSelectedLanguageTranscription(_langvalue: any) {
    // this.transcriptionActiveLanguage = this.selectedTranscriptionStyle?.label
    if (typeof _langvalue === 'string' && _langvalue) {
      this.transcriptionActiveLanguage = _langvalue

    } else {
      this.selectedTranscriptionStyle = _langvalue?.value
      this.transcriptionActiveLanguage = this.selectedTranscriptionStyle?.label
      this.transcriptActiveLanguageText = _langvalue?.value?.language
    }
    this.raiseTranscriptionLanguageStartTelemetry()
    setTimeout(() => {
      this.raiseTranscriptionLanguageInteractTelemetry()
    })
    let currentPath = this.vttLangArr.filter((item: any) => item?.label === this.transcriptionActiveLanguage)
    if (currentPath && currentPath.length) {
      this.selectedTranscriptionStyle = currentPath[0]
    }
    const file = await VttFile.fromUrl(currentPath && currentPath[0]?.uri)
    let blocks: any = file.getBlocks()
    this.subTitles = blocks
    this.raiseTranscriptionLanguageStopTelemetry()
    // this.tocSvc.changeTranscriptionLanguageEvent.next({activeLang: this.transcriptionActiveLanguage, langData: this.vttLangArr, loadPlayer:false})

  }

  openSurveyFormPopup(event: boolean) {
    this.trigerCompletionSurveyForm.emit(event)
  }

  playFromSlot(subtitle: any) {
    if (subtitle) {
      let startTime = subtitle.startTime / 1000
      let endTime = subtitle.endTime / 1000
      this.tocSvc.playTranscriptionVideo.next({ startTime, endTime })
    }
  }

  formatMsToVttTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    //  const milliseconds = ms % 1000;
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const pad = (num: number, size: number) => num.toString().padStart(size, '0')

    // return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}`
  }

  onlyscormAssessmentExists(data: any, key: any, value: any) {

    for (let i = 0; i < data?.length; i++) {
      if (data[i] && data[i]['children'] && data[i]['children'].length) {
        this.onlyscormAssessmentExists(data[i]?.children, key, value)
      } else {

        this.totalResource = this.totalResource + 1
        if (value.includes(data[i][key])) {
          // this.showAITutorFlag = false;
          this.scormAssessmentCount = this.scormAssessmentCount + 1
        }
      }
    }

    if (this.totalResource === this.scormAssessmentCount) {
      this.enableAITutorFlag = false
    } else {
      this.enableAITutorFlag = true
    }
    return this.enableAITutorFlag
  }

  raiseTranscriptionTabStartTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": "ai-tutor-viewer-page", "pageid": `/viewer/video/${this.viewerDataSvc?.resourceId}`, subType: 'transcript-tab' },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Loaded,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: `/viewer/video/${this.viewerDataSvc?.resourceId}`, module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  raiseTranscriptionTabInteractTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": "ai-tutor-viewer-page", "pageid": `/viewer/video/${this.viewerDataSvc?.resourceId}`, subType: 'transcript-tab' },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Interact,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: `/viewer/video/${this.viewerDataSvc?.resourceId}`, module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  raiseTranscriptionTabStopTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": "ai-tutor-viewer-page", "pageid": `/viewer/video/${this.viewerDataSvc?.resourceId}`, subType: 'transcript-tab' },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Unloaded,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: `/viewer/video/${this.viewerDataSvc?.resourceId}`, module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  raiseTranscriptionLanguageStartTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": this.transcriptActiveLanguageText, "pageid": `/viewer/video/${this.viewerDataSvc?.resourceId}`, subType: 'transcript-language' },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Loaded,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: `/viewer/video/${this.viewerDataSvc?.resourceId}`, module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  raiseTranscriptionLanguageInteractTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": this.transcriptActiveLanguageText, "pageid": `/viewer/video/${this.viewerDataSvc?.resourceId}`, subType: 'transcript-language' },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Interact,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: `/viewer/video/${this.viewerDataSvc?.resourceId}`, module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  raiseTranscriptionLanguageStopTelemetry() {
    const event = {
      eventType: WsEvents.WsEventType.Telemetry,
      eventLogLevel: WsEvents.WsEventLogLevel.Info,
      data: {
        edata: { type: 'click', "id": this.transcriptActiveLanguageText, "pageid": `/viewer/video/${this.viewerDataSvc?.resourceId}`, subType: 'transcript-language' },
        object: { "id": this.content?.identifier, "type": this.content?.courseCategory },
        state: WsEvents.EnumTelemetrySubType.Unloaded,
        eventSubType: WsEvents.EnumTelemetrySubType.Chatbot,
        mode: 'view',
      },
      pageContext: { pageId: `/viewer/video/${this.viewerDataSvc?.resourceId}`, module: 'Learn' },
      from: '',
      to: 'Telemetry',
    }
    this.eventSvc.dispatchChatbotEvent<WsEvents.IWsEventTelemetryInteract>(event)
  }

  closeAIPopup(event: any) {
    if (event) {
      this.showAITutorPopup = false
      this.selectedTabIndex = 0
    }
  }

  ngOnDestroy() {
    if (this.resourceIdentifier$) {
      this.resourceIdentifier$.unsubscribe()
    }

    if (this.subTitles$) {
      this.subTitles$.unsubscribe()
    }

    if (this.transriptionLanguageSub) {
      this.transriptionLanguageSub.unsubscribe()
    }
  }

  clearCommentIdFromUrl(): void {
    const currentQueryParams = { ...this.route.snapshot.queryParams }
    delete currentQueryParams.commentId
    this.commentId = ''
    this.discussWidgetData.newCommentSection.show = true
  }

  resumeContentCall() {
    this.resumeContent.emit()
  }
  
  private setBreadcrumbData(): void {
    const plan = this.contentReadData?.trainingPlan_v2
    const planTitle = plan?.orgName || this.contentReadData?.source || this.contentReadData?.organisation?.[0] || ''
    const crumbs: any[] = [
      { url: '/page/home', title: 'Home', icon: '' },
      { url: '/page/home', title: 'APAR', icon: '' },
    ]

    if (planTitle) {
      crumbs.push({
        url: plan?.identifier ? `/app/plans/${plan.identifier}` : '',
        queryParams: plan?.planYear ? { planYear: plan.planYear } : undefined,
        title: planTitle,
        icon: '',
      })
    }

    crumbs.push({ url: '', title: this.contentReadData?.courseCategory || 'Comprehensive Assessment', icon: '' })
    this.breadcrumbData.set(crumbs)
  }

  private loadComprehensiveAssessmentStatus(): void {
    if (this.content?.courseCategory !== 'Comprehensive Assessment') {
      this.caPendingCourses = []
      return
    }
    this.setBreadcrumbData()
    this.comprehensiveAssessmentSvc.getUnlockStatus(this.contentReadData)
      .then((status: IComprehensiveAssessmentStatus) => {
        this.caPendingCourses = status.pendingCourses
      })
      .catch(() => {
        this.caPendingCourses = []
      })
  }
}