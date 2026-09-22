import { ApiMethod, ApiRegistryConfig } from '../models/content-section.model'

export const API_REGISTRY: ApiRegistryConfig = {
  popularCoursesApi: {
    endpoint: '/api/content/v1/popular-courses',
    method: ApiMethod.Get,
    queryParams: { limit: '10' }
  },
  caProgramBeginnerApi: {
    endpoint: '/api/content/v1/ca-program',
    method: ApiMethod.Post,
    body: { level: 'beginner' }
  },
  caProgramAdvancedApi: {
    endpoint: '/api/content/v1/ca-program',
    method: ApiMethod.Post,
    body: { level: 'advanced' }
  },
  spotlightApi: {
    endpoint: '/api/content/v1/spotlight',
    method: ApiMethod.Get
  },
  trendingAllApi: {
    endpoint: '/api/content/v1/trending',
    method: ApiMethod.Get,
    queryParams: { category: 'all' }
  },
  trendingCyberApi: {
    endpoint: '/api/content/v1/trending',
    method: ApiMethod.Get,
    queryParams: { category: 'cyber' }
  },
  // ContentApiService.loadContent() short-circuits these keys to UserCbpPlansService, which
  // owns the plan year, the APAR/CBP/AI-CBP split and the IndexedDB cache. All three are
  // slices of ONE V4 response, so they cost a single request between them. These entries are
  // kept only so the registry stays an accurate description of the endpoint each key
  // represents.
  aparApi: {
    endpoint: '/apis/proxies/v8/cbplan/v4/user/dictionary',
    method: ApiMethod.Post
  },
  trainingPlanApi: {
    endpoint: '/apis/proxies/v8/cbplan/v4/user/dictionary',
    method: ApiMethod.Post
  },
  draftCBPplanApi: {
    endpoint: '/apis/proxies/v8/cbplan/v4/user/dictionary',
    method: ApiMethod.Post
  },
  // ── Plan-level lists (CardType.PlanCard) ───────────────────────────────────────
  // Older spellings of the three keys above, kept so existing page configs keep working.
  // They named POST /cbplan/v2/search, which is no longer used: ContentApiService
  // short-circuits them to UserCbpPlansService alongside the V4 keys, so all six describe
  // the same single request.
  aparPlanListApi: {
    endpoint: '/apis/proxies/v8/cbplan/v4/user/dictionary',
    method: ApiMethod.Post
  },
  trainingPlanListApi: {
    endpoint: '/apis/proxies/v8/cbplan/v4/user/dictionary',
    method: ApiMethod.Post
  },
  draftCBPplanListApi: {
    endpoint: '/apis/proxies/v8/cbplan/v4/user/dictionary',
    method: ApiMethod.Post
  },
  trendingOnIGOTApi: {
    endpoint: '/apis/proxies/v8/trending/content/search',
    method: ApiMethod.Post,
    body: {
      "request": {
        "filters": {
          "contextType": [
            "courses"
          ],
          "organisation": "across"
        },
        "limit": 12
      },
      "query": ""
    }
  },
  featuredAiCoursesApi: {
    endpoint: '/apis/proxies/v8/playList/read/013633005407862784180MDO_test_1_b2157aab-cc34-4a85-8500-10a5ed189d3b_ALLCONTENT_TRUE/013633005407862784180',
    method: ApiMethod.Get
  },
  thirtyMinutesOrLessApi: {
    endpoint: '/apis/proxies/v8/trending/content/search',
    method: ApiMethod.Post,
    body: {
      "request": {
        "filters": {
          "contextType": [
            "under_30_mins"
          ],
          "organisation": "across"
        },
        "limit": 12
      },
      "responseKey": "under_30_mins",
      "query": ""
    }
  },
  caProgramApi: {
    endpoint: '/apis/proxies/v8/user/v2/assignedcourses',
    method: ApiMethod.Post,
    body: {
      "courseCategory": "Comprehensive Assessment Program"
    },
    chainedApi: {
      endpoint: '/apis/proxies/v8/learner/course/v4/user/enrollment/details/',
      method: ApiMethod.Post,
      addUserId: true,
      sourceListPath: 'result.content',
      identifierField: 'identifier',
      buildBody: (ids: string[]) => ({ request: { courseId: ids } }),
      enrolledListPath: 'result.courses',
      enrolledMatchField: 'courseId'
    }
  },
  aparModeratedApi: {
    endpoint: '/apis/proxies/v8/sunbirdigot/v4/search',
    method: ApiMethod.Post,
    body: {
      "request": {
        "query": "",
        "filters": {
          "courseCategory": [
            "Moderated Course",
            "Moderated Program",
            "Moderated Assessment"
          ],
          "secureSettings.organisation": "0133783095823810560",
          "contentType": [
            "Course"
          ],
          "status": [
            "Live"
          ],
          "secureSettings.isVerifiedKarmayogi": "No"
        },
        "sort_by": {
          "lastUpdatedOn": "desc"
        },
        "facets": [
          "mimeType"
        ],
        "limit": 20
      }
    }
  },
  learningPathApi: {
    endpoint: '/apis/proxies/v8/sunbirdigot/search',
    method: ApiMethod.Post,
    body: {
      "request": {
        "filters": {
          "contentType": [
            "Course"
          ],
          "courseCategory": [
            "learning pathway"
          ],
          "status": [
            "Live"
          ]
        },
        "limit": 5
      },
      "query": ""
    }
  },
  standaloneApi: {
    endpoint: '/apis/proxies/v8/sunbirdigot/search',
    method: ApiMethod.Post,
    body: {
      'request': {
        'filters': {
          'primaryCategory': ['Standalone Assessment'],
          'courseCategory': 'Invite-Only Assessment',
          'contentType': ['Course']
        },
        'query': '',
        'sort_by': { 'lastUpdatedOn': 'desc' },
        'fields': [
          'name', 'appIcon', 'instructions', 'description', 'purpose',
          'mimeType', 'gradeLevel', 'identifier', 'medium', 'pkgVersion',
          'board', 'subject', 'resourceType', 'primaryCategory', 'languageMapV1',
          'contentType', 'channel', 'organisation', 'trackable', 'license',
          'posterImage', 'idealScreenSize', 'learningMode', 'creatorLogo',
          'duration', 'avgRating', 'difficultyLevel'
        ]
      },
      'query': ''
    },
    chainedApi: {
      endpoint: '/apis/proxies/v8/learner/course/v4/user/enrollment/details/',
      method: ApiMethod.Post,
      addUserId: true,
      sourceListPath: 'result.content',
      identifierField: 'identifier',
      buildBody: (ids: string[]) => ({ request: { courseId: ids } }),
      enrolledListPath: 'result.courses',
      enrolledMatchField: 'courseId'
    }
  },
  // Mirrors ContinueLearningV2Component.loadInProgressCourse(): internal enrollment list
  // (In-Progress, limit 1), merged with the external (CIOS) In-Progress enrollment list —
  // the external call always fires and results are concatenated, not filtered.
  continueLearningApi: {
    endpoint: '/apis/proxies/v8/learner/course/v5/user/enrollment/list',
    method: ApiMethod.Post,
    body: {
      request: {
        retiredCoursesEnabled: false,
        status: 'In-Progress',
        limit: 1
      }
    },
    chainedApi: {
      endpoint: '/apis/proxies/v8/cios-enroll/v1/courselist/byuserid',
      method: ApiMethod.Post,
      mode: 'mergeIndependent',
      sourceListPath: 'result.courses',
      buildBody: () => ({
        request: {
          status: 'In-Progress'
        }
      }),
      enrolledListPath: 'result.courses'
    }
  }

}
