import { Component, Input, Output, EventEmitter, ViewChild, OnInit, OnChanges, SimpleChanges } from '@angular/core'
import { MultipleChoiceQuestionComponent } from '../multiple-choice-question/multiple-choice-question.component'
import { MatchTheFollowingComponent } from '../match-the-following/match-the-following.component'
import { FillUpTheBlanksComponent } from '../fill-up-the-blanks/fill-up-the-blanks.component'
import { AssessmentService } from '../../service/assessment.service'
import { MatDialog } from '@angular/material/dialog'
import { ConfirmationDialogComponent } from '../../../dialog-components/confirmation-dialog/confirmation-dialog.component'

@Component({
  selector: 'sb-uic-assessment-question-list',
  templateUrl: './assessment-question-list.component.html',
  styleUrls: ['./assessment-question-list.component.scss'],
  standalone: false
})
export class AssessmentQuestionListComponent implements OnInit, OnChanges {
  @Input() questionData: any = { qType: '', identifier: '' }
  @Input() questionIndex: number = 0
  @Input() isExpanded: boolean = false
  @Input() sectionLevelDefinition: any = null
  @Input() assessmentData: any = null
  @Output() questionUpdated = new EventEmitter<any>()
  @Output() questionDeleted = new EventEmitter<any>()
  @Output() questionExpanded = new EventEmitter<number>()

  @ViewChild('mcqComponent') mcqComponent?: MultipleChoiceQuestionComponent
  @ViewChild('mtfComponent') mtfComponent?: MatchTheFollowingComponent
  @ViewChild('ftbComponent') ftbComponent?: FillUpTheBlanksComponent

  difficultyLevels = [
    { name: 'Easy', value: 'easy' },
    { name: 'Medium', value: 'medium' },
    { name: 'Difficult', value: 'difficult' },
    { name: 'HOTS', value: 'hots' }
  ]
  selectedDifficultyLevel: string = 'easy'

  htmlTasRemovalRegex = /<\/?[^>]+>|&nbsp;|<br\s*\/?>|<\/br>|&#39;|&quot;/gi
  assessmentNoSpecialChar = new RegExp(/^[a-zA-Z0-9\u0900-\u097F._\-\s$":/?,।()\[\]'!]+$/)
  isRegexPassed: boolean = true
  questionText: string = ''
  /**
   * What the editor is seeded with, and the only thing it is ever told. `questionText` is
   * the live value the editor reports back, so binding the editor to that closed the loop:
   * the parent handed the editor its own content again on every change, and where the value
   * came back reshaped - the empty case below rewrites it to '' - the editor answered with
   * `setData`, which re-parses the document and drops the selection and the undo stack.
   * A question carrying only an image erased itself that way as it was being authored.
   * The seed is written when a question is loaded, and never from an edit.
   */
  questionSeed: string = ''
  fitbCount: number = 0
  fitbConfig = {
    maxOptions: 7,
  }
  questionOptions: any[] = []
  questionDataLoaded: boolean = false
  questionDetailsFetched: boolean = false
  questionDetailsFetchInFlight: boolean = false

  constructor(
    public assessemntService: AssessmentService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.initializeQuestionData()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questionData'] && !changes['questionData'].firstChange) {
      this.initializeQuestionData()
    }
    // `initializeQuestionData` drops the card back to the loading state whenever it is
    // re-bound, and only a click used to start the fetch that leaves it again. A question
    // that is already open when that happens - the parent rebuilds `questionsList` every
    // time the assessment reloads - would then sit on the spinner for ever, because no
    // further click is coming. Anything that leaves the card open and unloaded is
    // recovered here.
    if (this.isExpanded && !this.questionDataLoaded) {
      this.loadQuestionDetails()
    }
  }

  initializeQuestionData(): void {
    // Existing questions (do_ identifier) fetch their full data on expand, so gate the
    // editor view until that completes. New questions have nothing to fetch — mark them
    // loaded up front so they expand immediately regardless of how they're opened.
    this.questionDataLoaded = !this.questionData?.identifier?.startsWith('do_')
    // A new question is bound here on re-use, so any details cached for the previous one are stale.
    this.questionDetailsFetched = false
    this.questionDetailsFetchInFlight = false
    // For initial load, just use whatever data we have
    // Complete data will be fetched when question is expanded
    this.populateQuestionForm()
  }

  populateQuestionForm(): void {
    // Populate existing question data if available
    if (this.questionData) {
      // Set question text
      if (this.questionData.body) {
        this.questionText = this.questionData.body
      } else if (this.questionData.name) {
        this.questionText = this.questionData.name
      }
      this.questionSeed = this.questionText

      // Set difficulty level
      if (this.questionData.questionLevel) {
        this.selectedDifficultyLevel = this.questionData.questionLevel.toLowerCase()
      }

      // Set MCQ options if available - check multiple possible data structures
      if (this.isMCQQuestion()) {
        if (this.questionData.editorState?.options && this.questionData.editorState.options.length > 0) {
          this.questionOptions = this.questionData.editorState.options.map((opt: any, index: number) => ({
            id: index + 1,
            text: opt.value?.body || opt.body || '',
            value: opt.value?.body || opt.body || '',
            isCorrect: false, // Will be set based on answer field below
            weight: this.parseOptionWeight(opt.answer) // Load weight for MCQ-MCA-W
          }))

          // Set correct answers based on answer field at question level
          if (this.questionData.answer !== undefined && this.questionData.answer !== null) {
            const answerStr = String(this.questionData.answer)
            const answerIndices = answerStr.split(',').map((a: string) => parseInt(a.trim()))
            answerIndices.forEach((idx: number) => {
              if (this.questionOptions[idx]) {
                this.questionOptions[idx].isCorrect = true
              }
            })
          }
        } else if (this.questionData.choices?.options && this.questionData.choices.options.length > 0) {
          // Try alternative structure from choices
          this.questionOptions = this.questionData.choices.options.map((opt: any, index: number) => ({
            id: index + 1,
            text: opt.value?.body || opt.body || '',
            value: opt.value?.body || opt.body || '',
            isCorrect: false, // Will be set based on answer field
            weight: this.parseOptionWeight(opt.answer) // Load weight for MCQ-MCA-W
          }))

          // Set correct answers based on answer field
          if (this.questionData.answer !== undefined && this.questionData.answer !== null) {
            const answerStr = String(this.questionData.answer)
            const answerIndices = answerStr.split(',').map((a: string) => parseInt(a.trim()))
            answerIndices.forEach((idx: number) => {
              if (this.questionOptions[idx]) {
                this.questionOptions[idx].isCorrect = true
              }
            })
          }
        }
      }

      // Set MTF pairs if available
      if (this.isMTFQuestion()) {
        if (this.questionData.editorState?.options && this.questionData.editorState.options.length > 0) {
          // Load pairs from editorState where each option has question (value.body) and answer (answer field)
          this.questionOptions = this.questionData.editorState.options.map((opt: any, index: number) => ({
            id: index + 1,
            question: opt.value?.body || '',
            answer: opt.answer || ''
          }))
        } else if (this.questionData.choices?.options && this.questionData.rhsChoices) {
          // Alternative structure with choices.options (questions) and rhsChoices (answers)
          this.questionOptions = this.questionData.choices.options.map((opt: any, index: number) => ({
            id: index + 1,
            question: opt.value?.body || opt.body || '',
            answer: this.questionData.rhsChoices[index] || ''
          }))
        }
      }

      // Set FTB blanks if available
      if (this.isFTBQuestion()) {
        if (this.questionData.editorState?.options && this.questionData.editorState.options.length > 0) {
          // Load blanks from editorState
          // The blank assignment is in opt.answer field (e.g., "B1", "B2", "B3", "none")
          this.questionOptions = this.questionData.editorState.options.map((opt: any, index: number) => ({
            id: index + 1,
            text: opt.value?.body || opt.text || '',
            blankNumber: opt.answer
          }))
        } else if (this.questionData.choices?.options && this.questionData.choices.options.length > 0) {
          // Alternative structure from choices
          this.questionOptions = this.questionData.choices.options.map((opt: any, index: number) => ({
            id: index + 1,
            text: opt.value?.body || opt.body || '',
            blankNumber: opt.answer && opt.answer !== 'none' ? opt.answer : null
          }))
        }

        // Count blanks in question text
        this.checkBlankIntext()
      }
    }
  }

  hasSectionLevelDefinition(): boolean {
    return this.sectionLevelDefinition && Object.keys(this.sectionLevelDefinition).length > 0
  }

  isMCQQuestion(): boolean {
    return this.questionData.qType && this.questionData.qType.includes('MCQ')
  }

  isMTFQuestion(): boolean {
    return this.questionData.qType === 'MTF'
  }

  isFTBQuestion(): boolean {
    return this.questionData.qType === 'FTB'
  }

  isTrueFalseQuestion(): boolean {
    return this.questionData.qType === 'MCQ-SCA-TF'
  }

  isUpdateMode(): boolean {
    return this.questionData.identifier && this.questionData.identifier.startsWith('do_')
  }

  onOptionsUpdated(options: any[]): void {
    this.questionOptions = options
  }

  parseOptionWeight(answer: any): number | undefined {
    // Weighted questions (MCQ-MCA-W) store the option weight in the option's answer field.
    // The API can send it as a number or as a numeric string, while regular MCQs keep a
    // boolean there, so only take a value that reads as a number.
    if (answer === undefined || answer === null || answer === '' || typeof answer === 'boolean') {
      return undefined
    }
    const weight = Number(answer)
    return isNaN(weight) ? undefined : weight
  }

  onAddOption(): void {
    if (this.mcqComponent) {
      this.mcqComponent.addOption()
    }
  }

  onAddPair(): void {
    if (this.mtfComponent) {
      this.mtfComponent.addPair()
    }
  }

  onAddBlank(): void {
    if (this.ftbComponent) {
      this.ftbComponent.addOption()
    }
  }

  canAddMoreOptions(): boolean {
    if (this.mcqComponent) {
      return this.mcqComponent.canAddMoreOptions()
    }
    return true
  }

  canAddMorePairs(): boolean {
    if (this.mtfComponent) {
      return this.mtfComponent.canAddMorePairs()
    }
    return true
  }

  canAddMoreBlanks(): boolean {
    if (this.ftbComponent) {
      return this.ftbComponent.canAddMoreOptions()
    }
    return true
  }

  canSaveMTFQuestion(): boolean {
    if (!this.questionText || this.questionText.trim().length === 0) {
      return false
    }
    if (!this.questionOptions || this.questionOptions.length < 2) {
      return false
    }
    // Check that all pairs have both question and answer
    return this.questionOptions.every(pair =>
      pair.question && pair.question.trim().length > 0 &&
      pair.answer && pair.answer.trim().length > 0
    )
  }

  canSaveFTBQuestion(): boolean {
    if (!this.questionText || this.questionText.trim().length === 0) {
      return false
    }
    if (this.fitbCount === 0) {
      return false
    }
    if (!this.questionOptions || this.questionOptions.length === 0) {
      return false
    }
    // Check that all blanks have text
    const allBlanksHaveText = this.questionOptions.every(blank =>
      blank.text && blank.text.trim().length > 0
    )
    if (!allBlanksHaveText) {
      return false
    }

    // For basic assessments, blank assignment is automatic, so skip blank validation
    if (this.isBasicAssessment()) {
      return true
    }

    // For advanced assessments, validate blank assignments
    // Get all unique assigned blank numbers (excluding null/undefined/empty/'none')
    const assignedBlanks = this.questionOptions
      .filter(blank => blank.blankNumber && blank.blankNumber !== 'none' && blank.blankNumber !== '')
      .map(blank => {
        // Handle both 'B1', 'B2' format and numeric format
        const blankStr = String(blank.blankNumber)
        if (blankStr.startsWith('B')) {
          return Number(blankStr.substring(1))
        }
        return Number(blankStr)
      })
      .filter(num => !isNaN(num))

    // Get unique blank numbers
    const uniqueAssignedBlanks = Array.from(new Set(assignedBlanks))

    // Check that all blanks (1 to fitbCount) have at least one assignment
    for (let i = 1; i <= this.fitbCount; i++) {
      if (!uniqueAssignedBlanks.includes(i)) {
        return false
      }
    }

    return true
  }

  onDifficultyLevelChange(level: string): void {
    this.selectedDifficultyLevel = level
  }

  getSelectedLevelMarks(): number {
    if (!this.sectionLevelDefinition || !this.selectedDifficultyLevel) {
      return 0
    }
    const selectedLevelName = this.getSelectedLevelName()
    const levelData = this.sectionLevelDefinition[selectedLevelName]
    return levelData?.marksForQuestion || 0
  }

  getSelectedLevelName(): string {
    const level = this.difficultyLevels.find(l => l.value === this.selectedDifficultyLevel)
    return level?.name || ''
  }

  getQuestionTypeName(): string {
    switch (this.questionData.qType) {
      case 'MCQ-SCA':
        return 'Single Selection MCQ'
      case 'MCQ-MCA':
        return 'Multiple Selection MCQ'
      case 'MCQ-MCA-W':
        return 'Weightage Single Choice'
      case 'FTB':
        return 'Fill in the Blanks'
      case 'MTF':
        return 'Match the Following'
      case 'MCQ-SCA-TF':
        return 'True and False'
      default:
        return 'Unknown Question Type'
    }
  }

  onEditQuestion(): void {
    this.questionExpanded.emit(this.questionIndex - 1)
  }

  onExpandQuestion(): void {
    this.questionExpanded.emit(this.questionIndex - 1)
    // Only fetch if we're expanding (not collapsing)
    if (!this.isExpanded) {
      this.loadQuestionDetails()
    }
  }

  /**
   * Fills in the body the card was not listed with - the listing carries a summary, and the
   * editors cannot render without the rest. `questionDataLoaded` is what holds the spinner
   * up until then, so every path out of here lowers it.
   */
  private loadQuestionDetails(): void {
    const identifier = this.questionData && this.questionData.identifier
    // A question that has not been saved yet carries no `do_` id, so it has nothing to fetch.
    if (!identifier || !identifier.startsWith('do_')) {
      this.questionDataLoaded = true
      return
    }

    // Fetch the details only once. Re-populating rebuilds every rich text editor in the
    // expanded question (one for the body plus one per option), so letting repeated expands
    // - or impatient double clicks while the first call is still out - stack duplicate
    // responses tears down and recreates all of them once per response.
    if (this.questionDetailsFetched || this.questionDetailsFetchInFlight) {
      this.questionDataLoaded = true
      return
    }

    const reqBody = {
      request: {
        search: {
          identifier: [identifier]
        }
      }
    }

    this.questionDetailsFetchInFlight = true
    this.assessemntService.getQuestionReadDetailsModeEdit(reqBody).subscribe({
      next: (response: any) => {
        this.questionDetailsFetchInFlight = false
        this.questionDataLoaded = true
        if (response?.result?.questions && response.result.questions.length > 0) {
          this.questionDetailsFetched = true
          const completeQuestionData = response.result.questions[0]
          // Merge complete data with existing questionData
          this.questionData = { ...this.questionData, ...completeQuestionData }
          // Now populate the form with complete data
          this.populateQuestionForm()
        }
      },
      error: (error: any) => {
        this.questionDetailsFetchInFlight = false
        this.questionDataLoaded = true
        console.error('Error fetching question details:', error)
      }
    })
  }

  onDeleteQuestion(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '500px',
      data: {
        planeDescription: 'Are you sure you want to delete this question? This action cannot be undone.',
        iconName: 'delete',
        type: 'warning',
        buttonsPositionClass: 'justify-center items-center',
        buttons: [
          {
            text: 'Cancel',
            classes: 'btn-out-line',
            response: false
          },
          {
            text: 'Delete',
            classes: 'succes-button',
            response: true
          }
        ],
      },
      autoFocus: false,
    })

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.questionDeleted.emit({
          questionData: this.questionData,
          questionIndex: this.questionIndex
        })
      }
    })
  }

  onQuestionUpdated(updatedData: any): void {
    this.questionExpanded.emit(-1) // Collapse after update
    this.questionUpdated.emit(updatedData)
  }

  onEditCancelled(): void {
    this.questionExpanded.emit(-1) // Collapse
  }

  getQuestionContent(event: any) {
    // First remove invisible Unicode characters from the event itself
    const cleanedEvent = (event || '').replace(/\u200B|\u200C|\u200D|\uFEFF/g, '')

    // Then get plain text by removing HTML tags and entities
    const plainText = cleanedEvent.replace(this.htmlTasRemovalRegex, ' ').replace(/\s+/g, ' ').trim()

    if (!plainText) {
      this.isRegexPassed = true
      this.questionText = ''
    } else {
      const isValid = this.assessmentNoSpecialChar.test(plainText)
      this.isRegexPassed = isValid
      this.questionText = cleanedEvent
      if (isValid) {

      }
    }
    if (this.questionData.qType === 'FTB') {
      this.checkBlankIntext()
    }
  }

  checkBlankIntext() {
    // Count occurrences of <input tags in the HTML
    const inputMatches = (this.questionText.match(/<input[^>]*>/gi) || [])
    const previousCount = this.fitbCount
    this.fitbCount = inputMatches.length

    // Reset options if all blanks are deleted
    if (this.fitbCount === 0 && previousCount > 0) {
      // Initialize with minimum required options based on assessment type
      const minOptions = this.isBasicAssessment() ? 1 : 2
      this.questionOptions = []
      for (let i = 0; i < minOptions; i++) {
        this.questionOptions.push({
          id: i + 1,
          text: '',
          blankNumber: null
        })
      }
    }
  }

  canSaveQuestion(): boolean {
    // Check if questionText is not empty
    if (!this.questionText || !this.questionText.trim()) {
      return false
    }

    // Check if difficulty level is selected when section level definition exists
    if (this.hasSectionLevelDefinition() && !this.selectedDifficultyLevel) {
      return false
    }

    // Check if MCQ options have values
    if (this.isMCQQuestion()) {
      if (!this.questionOptions || this.questionOptions.length === 0) {
        return false
      }

      // Check if ALL options have text (for non-True/False questions)
      if (!this.isTrueFalseQuestion()) {
        const allOptionsHaveText = this.questionOptions.every(opt => opt.text && opt.text.trim())
        if (!allOptionsHaveText) {
          return false
        }
      }

      // Check if correct answers are selected based on question type
      if (this.questionData.qType === 'MCQ-MCA') {
        // For MCQ-MCA, require at least 2 correct answers
        const correctAnswersCount = this.questionOptions.filter(opt => opt.isCorrect).length
        if (correctAnswersCount < 2) {
          return false
        }
      } else if (this.questionData.qType === 'MCQ-MCA-W') {
        // For MCQ-MCA-W (weighted), check that all options have valid weight values
        const allOptionsHaveWeights = this.questionOptions.every(opt =>
          opt.weight !== undefined && opt.weight !== null && opt.weight !== ''
        )
        if (!allOptionsHaveWeights) {
          return false
        }
      } else {
        // For MCQ-SCA and MCQ-SCA-TF, require at least 1 correct answer
        const hasCorrectAnswer = this.questionOptions.some(opt => opt.isCorrect)
        if (!hasCorrectAnswer) {
          return false
        }
      }
    }

    return true
  }

  saveQuestion(): void {
    // Check appropriate validation based on question type
    if (this.isMTFQuestion() && !this.canSaveMTFQuestion()) {
      return
    }
    if (this.isFTBQuestion() && !this.canSaveFTBQuestion()) {
      return
    }
    if (!this.isMTFQuestion() && !this.isFTBQuestion() && !this.canSaveQuestion()) {
      return
    }

    const questionUUID = this.questionData.identifier || this.assessemntService.generateUUID()
    const isNewQuestion = !this.questionData.identifier || !this.questionData.identifier.startsWith('do_')

    let answer = ''
    let editorStateOptions: any[] = []
    let choicesOptions: any[] = []
    let rhsChoices: any[] = []

    if (this.isMCQQuestion()) {
      // Get the correct answer index/indices for MCQ
      if (this.questionData.qType === 'MCQ-SCA' || this.questionData.qType === 'MCQ-SCA-TF') {
        // Single correct answer
        const correctOption = this.questionOptions.find(opt => opt.isCorrect)
        answer = correctOption ? String(this.questionOptions.indexOf(correctOption)) : ''
      } else if (this.questionData.qType === 'MCQ-MCA') {
        // Multiple correct answers
        const correctIndices = this.questionOptions
          .map((opt, idx) => opt.isCorrect ? String(idx) : null)
          .filter(idx => idx !== null)
        answer = correctIndices.join(',')
      } else if (this.questionData.qType === 'MCQ-MCA-W') {
        // For weighted questions, answer contains all option indices
        answer = this.questionOptions.map((_, idx) => String(idx)).join(',')
      }

      // Build editorState options for MCQ
      if (this.questionData.qType === 'MCQ-MCA-W') {
        // For weighted questions, answer field contains the weight value
        editorStateOptions = this.questionOptions.map((opt, idx) => ({
          answer: opt.weight !== undefined ? opt.weight : 0,
          value: {
            body: opt.text || opt.value || '',
            value: idx
          }
        }))
      } else {
        // For regular MCQ, answer field contains boolean
        editorStateOptions = this.questionOptions.map((opt, idx) => ({
          answer: opt.isCorrect,
          value: {
            body: opt.text || opt.value || '',
            value: idx
          }
        }))
      }

      // Build choices options for MCQ
      choicesOptions = this.questionOptions.map((opt, idx) => ({
        value: {
          body: opt.text || opt.value || '',
          value: idx
        }
      }))
    } else if (this.isMTFQuestion()) {
      // For MTF, build question-answer pairs structure
      // answer field remains empty or can be indices (0,1,2...)
      answer = this.questionOptions.map((_, idx) => String(idx)).join(',')

      // Build editorState options for MTF with answer field containing answer text
      editorStateOptions = this.questionOptions.map((pair, idx) => ({
        answer: pair.answer || '',
        value: {
          body: pair.question || '',
          value: idx
        }
      }))

      // Build choices options for MTF with question texts
      choicesOptions = this.questionOptions.map((pair, idx) => ({
        value: {
          body: pair.question || '',
          value: idx
        }
      }))

      // Build rhsChoices with answer texts
      rhsChoices = this.questionOptions.map(pair => pair.answer || '')
    } else if (this.isFTBQuestion()) {
      // For FTB, build blank answers structure
      // Helper function to extract numeric value from blankNumber
      const getBlankNumericValue = (blankNumber: any): number => {
        if (!blankNumber) return 0
        const blankStr = String(blankNumber)
        if (blankStr.startsWith('B')) {
          return Number(blankStr.substring(1))
        }
        return Number(blankStr)
      }

      // answer field contains comma-separated correct answers in order
      const sortedBlanks = [...this.questionOptions].sort((a, b) =>
        getBlankNumericValue(a.blankNumber) - getBlankNumericValue(b.blankNumber)
      )
      answer = sortedBlanks.map(blank => `${blank.id - 1}` || '').join(',')

      // Build editorState options for FTB with blank number as value
      editorStateOptions = this.questionOptions.map((blank) => {
        return {
          answer: (this.isBasicAssessment()) ? true : blank.blankNumber || '',
          value: {
            body: blank.text || '',
            value: blank.id - 1  // Convert to 0-based index
          }
        }
      })

      // Build choices options for FTB
      choicesOptions = this.questionOptions.map((blank) => {
        return {
          value: {
            body: blank.text || '',
            value: blank.id - 1  // Convert to 0-based index
          }
        }
      })
    }

    const questionRequest = {
      isNew: isNewQuestion,
      root: false,
      metadata: {
        code: 'question',
        mimeType: 'application/vnd.sunbird.question',
        body: this.questionText,
        primaryCategory: this.getPrimaryCategory(),
        qType: this.questionData.qType,
        editorState: {
          options: editorStateOptions,
          question: this.questionText
        },
        objectType: 'Question',
        answer: answer,
        name: this.questionText,
        choices: {
          options: choicesOptions
        },
        rhsChoices: rhsChoices,
        compatibilityLevel: this.assessmentData?.compatibilityLevel,
        questionLevel: this.getSelectedLevelName() || 'Easy',
        totalMarks: this.getSelectedLevelMarks() || 0
      },
      objectType: 'Question'
    }

    const updatedQuestion = {
      ...this.questionData,
      questionText: this.questionText,
      questionIndex: this.questionIndex,
      questionRequest: questionRequest
    }
    this.onQuestionUpdated(updatedQuestion)
  }

  private getPrimaryCategory(): string {
    switch (this.questionData.qType) {
      case 'MCQ-SCA':
      case 'MCQ-MCA':
      case 'MCQ-SCA-TF':
        return 'Multiple Choice Question'
      case 'FTB':
        return 'FTB Question'
      case 'MTF':
        return 'MTF Question'
      default:
        return 'Multiple Choice Question'
    }
  }

  get isReadOnly(): boolean {
    return this.assessemntService.getReadOnly()
  }

  isBasicAssessment(): boolean {
    return this.assessmentData?.compatibilityLevel === 6
  }
}
