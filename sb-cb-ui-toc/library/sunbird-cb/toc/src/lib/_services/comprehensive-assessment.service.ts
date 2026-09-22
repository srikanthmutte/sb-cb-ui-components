import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { ContentDictionaryService } from '@sunbird-cb/consumption'
import {
  IComprehensiveAssessmentAttempts,
  IComprehensiveAssessmentCourse,
  IComprehensiveAssessmentStatus,
} from '../_models/common.model'

const API_END_POINTS = {
  CAN_ATTEMPT: (assessmentId: string) => `/apis/proxies/v8/user/assessment/retake/${assessmentId}`,
  CAN_ATTEMPT_V5: (assessmentId: string) => `/apis/proxies/v8/user/assessment/v5/retake/${assessmentId}`,
}

const V5_COMPATIBILITY_LEVEL = 7
const DEFAULT_COMPATIBILITY_LEVEL = 6
const QUESTION_SET_MIME_TYPES = ['application/vnd.sunbird.questionset', 'application/quiz']
const COMPLETED_STATUS = 2
const APP_DB_NAME = 'iGotAppDB'
const ENROLMENT_STORE = 'enrollmentDetails'
const ENROLMENT_KEY = 'current'
const DB_TIMEOUT_MS = 2000

@Injectable({
  providedIn: 'root',
})
export class ComprehensiveAssessmentService {
  constructor(
    private contentDictionarySvc: ContentDictionaryService,
    private http: HttpClient,
  ) { }

  async getUnlockStatus(contentReadData: any): Promise<IComprehensiveAssessmentStatus> {
    const contentList: any[] = contentReadData?.trainingPlan_v2?.contentList || []
    const identifiers: string[] = contentList
      .map((item: any) => item?.identifier)
      .filter((identifier: string) => !!identifier)

    if (!identifiers.length) {
      // No linked courses, so there is nothing left to complete before the assessment opens.
      return { courses: [], pendingCourses: [], isAllCoursesCompleted: true }
    }

    const [dictionary, enrolments] = await Promise.all([
      this.readDictionary(identifiers),
      this.readEnrolments(),
    ])

    const courses: IComprehensiveAssessmentCourse[] = contentList
      .filter((item: any) => !!item?.identifier)
      .map((item: any) => {
        const meta = dictionary[item.identifier] || {}
        const enrolment = enrolments[item.identifier]
        return {
          identifier: item.identifier,
          name: meta.name || '',
          code: meta.code || '',
          mandatory: !!item.mandatory,
          completed: enrolment?.status === COMPLETED_STATUS,
        }
      })

    const pendingCourses = courses.filter((course: IComprehensiveAssessmentCourse) => !course.completed)
    return { courses, pendingCourses, isAllCoursesCompleted: !pendingCourses.length }
  }

  async getAttemptStatus(contentReadData: any): Promise<IComprehensiveAssessmentAttempts> {
    const assessment = this.resolveAssessmentNode(contentReadData)
    const fallbackAllowed = this.resolveAttemptsAllowed(contentReadData, 0)
    if (!assessment?.identifier) {
      return this.toAttempts(0, fallbackAllowed)
    }

    const compatibilityLevel = Number(assessment.compatibilityLevel) || DEFAULT_COMPATIBILITY_LEVEL
    const url = compatibilityLevel >= V5_COMPATIBILITY_LEVEL
      ? API_END_POINTS.CAN_ATTEMPT_V5(assessment.identifier)
      : API_END_POINTS.CAN_ATTEMPT(assessment.identifier)

    try {
      const response: any = await this.http.get<any>(url).toPromise()
      const result = response?.result || {}
      const attemptsMade = Number(result.attemptsMade) || 0
      return this.toAttempts(attemptsMade, this.resolveAttemptsAllowed(contentReadData, result.attemptsAllowed))
    } catch (_err) {
      return this.toAttempts(0, fallbackAllowed)
    }
  }

  private resolveAssessmentNode(contentReadData: any): any {
    const children: any[] = contentReadData?.children || []
    const questionSet = children.find((child: any) => QUESTION_SET_MIME_TYPES.includes(child?.mimeType))
    return questionSet || children[0] || contentReadData
  }

  private resolveAttemptsAllowed(contentReadData: any, attemptsAllowed: any): number {
    const fromApi = Number(attemptsAllowed)
    if (fromApi > 0) {
      return fromApi
    }
    const authored = Number(contentReadData?.maxAssessmentRetakeAttempts)
    return authored > 0 ? authored : 0
  }

  private toAttempts(attemptsMade: number, attemptsAllowed: number): IComprehensiveAssessmentAttempts {
    return {
      attemptsMade,
      attemptsAllowed,
      attemptsRemaining: Math.max(attemptsAllowed - attemptsMade, 0),
      isAttempted: attemptsMade > 0,
    }
  }

  /** Course metadata, dictionary cache first and content read only for what it misses. */
  private async readDictionary(identifiers: string[]): Promise<Record<string, any>> {
    try {
      const contents = await this.contentDictionarySvc.getContents(identifiers).toPromise()
      return contents || {}
    } catch (_err) {
      return {}
    }
  }

  private readEnrolments(): Promise<Record<string, any>> {
    return new Promise<Record<string, any>>((resolve: (value: Record<string, any>) => void) => {
      let settled = false
      const finish = (value: Record<string, any>) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(value)
        }
      }
      const timer = setTimeout(() => finish({}), DB_TIMEOUT_MS)

      try {
        const request = indexedDB.open(APP_DB_NAME)
        request.onerror = () => finish({})
        request.onblocked = () => finish({})
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(ENROLMENT_STORE)) {
            db.close()
            finish({})
            return
          }
          try {
            const tx = db.transaction(ENROLMENT_STORE, 'readonly')
            const read = tx.objectStore(ENROLMENT_STORE).get(ENROLMENT_KEY)
            read.onsuccess = () => finish(read.result || {})
            read.onerror = () => finish({})
            tx.oncomplete = () => db.close()
            tx.onerror = () => {
              db.close()
              finish({})
            }
          } catch (_err) {
            db.close()
            finish({})
          }
        }
      } catch (_err) {
        finish({})
      }
    })
  }
}
