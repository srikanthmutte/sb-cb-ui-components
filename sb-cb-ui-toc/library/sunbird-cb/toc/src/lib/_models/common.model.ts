export interface ICommon {
  shareMessage: string
}

export interface IComprehensiveAssessmentCourse {
  identifier: string
  name: string
  code: string
  mandatory: boolean
  completed: boolean
}

export interface IComprehensiveAssessmentStatus {
  courses: IComprehensiveAssessmentCourse[]
  pendingCourses: IComprehensiveAssessmentCourse[]
  isAllCoursesCompleted: boolean
}

export interface IComprehensiveAssessmentAttempts {
  attemptsMade: number
  attemptsAllowed: number
  attemptsRemaining: number
  isAttempted: boolean
}