import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core'
import { AbstractControl, FormBuilder, FormGroup, FormArray, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { AssessmentService } from '../../service/assessment.service'
import { Subscription } from 'rxjs'
import { NsAssessment } from '../../service/assessment.model'
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatDialog } from '@angular/material/dialog'
import { SelectQuestionModalComponent } from '../select-question-modal/select-question-modal.component'
import { BulkUploadAllTypeQuestionComponent } from '../bulk-upload-all-type-question/bulk-upload-all-type-question.component'

/** The most questions one section can be authored with. */
const MAX_TOTAL_QUESTIONS = 500

@Component({
    selector: 'sb-uic-assessment-sessions',
    templateUrl: './assessment-sessions.component.html',
    styleUrls: ['./assessment-sessions.component.scss'],
    standalone: false
})
export class AssessmentSessionsComponent implements OnInit, OnDestroy, OnChanges {
  @Output() saved = new EventEmitter<any>()
  @Output() updated = new EventEmitter<any>()
  @Output() updateQuestion = new EventEmitter<any>()

  sessionsForm!: FormGroup
  basicAssessmentForm!: FormGroup
  optionWeightageForm!: FormGroup
  assessmentData: any = {}
  difficultyLevels = [
    { name: 'Easy', count: 0 },
    { name: 'Medium', count: 0 },
    { name: 'Difficult', count: 0 },
    { name: 'HOTS', count: 0 }
  ]
  selectedSectionIndex = 0
  nameMaxLength = 70
  instructionsMaxLength = 1000
  maxTotalQuestions = MAX_TOTAL_QUESTIONS
  maxSectionWeightage = 100
  questionsList: Array<{ qType: string; identifier: string }> = []
  expandedQuestionIndex: number | null = null
  private subscriptions: Subscription[] = []

  constructor(
    private fb: FormBuilder,
    private assessmentService: AssessmentService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.initForm()
  }

  ngOnInit(): void {
    this.loadAssessmentData()
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload data when assessment hierarchy is updated from parent
    if (changes['assessmentData'] && !changes['assessmentData'].firstChange) {
      this.reloadAssessmentData()
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe())
  }

  initForm(): void {
    this.sessionsForm = this.fb.group({
      sections: this.fb.array([this.createSectionGroup()])
    })

    this.basicAssessmentForm = this.fb.group({
      totalQuestions: [0, [Validators.required, Validators.min(1), Validators.max(MAX_TOTAL_QUESTIONS)]],
      maxQuestions: [0, [Validators.required, Validators.min(1), this.displayedWithinTotalValidator()]],
      minPassPercentage: [50, [Validators.required, Validators.min(50), Validators.max(100)]],
      additionalInstructions: ['', [Validators.maxLength(this.instructionsMaxLength)]]
    })
    this.watchQuestionCounts(this.basicAssessmentForm)

    this.optionWeightageForm = this.fb.group({
      additionalInstructions: ['', [Validators.maxLength(this.instructionsMaxLength)]]
    })
  }

  createSectionGroup(): FormGroup {
    return this.fb.group({
      name: ['Section A', [Validators.required, Validators.maxLength(this.nameMaxLength), Validators.pattern(/^[a-zA-Z0-9.\-_$/:\[\]*!'\s]+$/)]],
      additionalInstructions: [''],
      questionParagraph: ['']
    })
  }

  get sections(): FormArray {
    return this.sessionsForm.get('sections') as FormArray
  }

  get basicSections(): FormArray {
    // Create sections FormArray if it doesn't exist (for basic assessment with sections)
    if (!this.basicAssessmentForm.get('sections')) {
      this.basicAssessmentForm.addControl('sections', this.fb.array([]))
    }
    return this.basicAssessmentForm.get('sections') as FormArray
  }

  get currentSectionGroup(): FormGroup {
    return this.sections.at(this.selectedSectionIndex) as FormGroup
  }

  loadAssessmentData(): void {
    // Get assessment hierarchy data from service
    this.assessmentData = this.assessmentService.getAssessmentHierarchyData()

    if (this.assessmentData && this.isAdvancedAssessmentQuestionWeightage()) {
      this.populateFormFromAssessmentData()
      this.calculateDifficultyLevelCounts()
    } else if (this.assessmentData && this.isAdvanceAssessmentQuestionOptionWeightage()) {
      // No difficulty levels are defined for CQF, so only the section forms are needed.
      this.populateFormFromAssessmentData()
    } else if (this.assessmentData && this.isBasicAssessment()) {
      this.populateBasicAssessmentForm()
    } else if (this.assessmentData && this.isAdvanceAssessmentOptionWeightage()) {
      this.populateOptionWeightageForm()
    }
  }

  reloadAssessmentData(): void {
    // Reload fresh data from service
    this.loadAssessmentData()
    // Reload questions for current section to get updated identifiers
    this.loadQuestionsForSection(this.selectedSectionIndex)
  }

  isAdvancedAssessmentQuestionWeightage(): boolean {
    return this.assessmentData?.compatibilityLevel === NsAssessment.ECompatibilityLevel.ADVANCED &&
      this.assessmentData?.assessmentType === NsAssessment.EAssessmentType.QUESTION_WEIGHTAGE
  }

  isAdvanceAssessmentOptionWeightage(): boolean {
    return this.assessmentData?.compatibilityLevel === NsAssessment.ECompatibilityLevel.ADVANCED &&
      this.assessmentData?.assessmentType === NsAssessment.EAssessmentType.OPTION_WEIGHTAGE
  }

  isAdvanceAssessmentQuestionOptionWeightage(): boolean {
    return this.assessmentData?.compatibilityLevel === NsAssessment.ECompatibilityLevel.ADVANCED &&
      this.assessmentData?.assessmentType === NsAssessment.EAssessmentType.QUESTION_OPTION_WEIGHTAGE
  }

  /**
   * Question weightage and question-option weightage (CQF) both author their content
   * through the same multi-section form.
   */
  isSectionedAdvancedAssessment(): boolean {
    return this.isAdvancedAssessmentQuestionWeightage() || this.isAdvanceAssessmentQuestionOptionWeightage()
  }

  isBasicAssessment(): boolean {
    return this.assessmentData?.compatibilityLevel === NsAssessment.ECompatibilityLevel.BASIC
  }

  isBasicAssessmentWithSections(): boolean {
    return this.isBasicAssessment() && this.assessmentData?.scoreCutoffType === 'SectionLevel'
  }

  hasBasicAssessmentSection(): boolean {
    // Check if basic assessment has a created section (with do_ identifier)
    return this.isBasicAssessment() &&
      this.assessmentData?.children &&
      this.assessmentData.children.length > 0 &&
      this.assessmentData.children[0]?.identifier?.startsWith('do_')
  }

  hasCurrentBasicSectionIdentifier(): boolean {
    // Check if the current selected basic section has a do_ identifier
    return this.assessmentData?.children &&
      this.assessmentData.children[this.selectedSectionIndex] &&
      this.assessmentData.children[this.selectedSectionIndex]?.identifier?.startsWith('do_')
  }

  hasOptionWeightageSection(): boolean {
    // Check if option weightage assessment has a created section (with do_ identifier)
    return this.isAdvanceAssessmentOptionWeightage() &&
      this.assessmentData?.children &&
      this.assessmentData.children.length > 0 &&
      this.assessmentData.children[0]?.identifier?.startsWith('do_')
  }

  /**
   * The questions shown to a learner are drawn from the ones authored, so asking for more
   * than are being added cannot be satisfied. It sits on the displayed field rather than on
   * the group so the field itself reports it, the way every other error here does.
   */
  private displayedWithinTotalValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const total = Number(control.parent?.get('totalQuestions')?.value)
      const displayed = Number(control.value)
      if (!total || !displayed || Number.isNaN(total) || Number.isNaN(displayed)) {
        return null
      }
      return displayed > total ? { displayedExceedsTotal: { total } } : null
    }
  }

  /** The pair is only wrong together, so the displayed field is re-checked when either moves. */
  private watchQuestionCounts(group: FormGroup): void {
    const total = group.get('totalQuestions')
    const displayed = group.get('maxQuestions')
    if (!total || !displayed) {
      return
    }
    this.subscriptions.push(
      total.valueChanges.subscribe(() => displayed.updateValueAndValidity({ emitEvent: false }))
    )
  }

  createBasicSectionGroup(): FormGroup {
    const group = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(this.nameMaxLength)]],
      additionalInstructions: ['', [Validators.maxLength(this.instructionsMaxLength)]],
      totalQuestions: [0, [Validators.required, Validators.min(1), Validators.max(MAX_TOTAL_QUESTIONS)]],
      maxQuestions: [0, [Validators.required, Validators.min(1), this.displayedWithinTotalValidator()]],
      minPassPercentage: [50, [Validators.required, Validators.min(50), Validators.max(100)]]
    })
    this.watchQuestionCounts(group)
    return group
  }

  /**
   * CQF sections carry a pass mark, a weightage and rich text instructions. The other
   * assessment types keep the shape they already save, so these are added only for CQF.
   */
  private addCqfSectionControls(group: FormGroup, section?: any): void {
    if (!this.isAdvanceAssessmentQuestionOptionWeightage()) {
      return
    }

    group.addControl('minPassPercentage', this.fb.control(
      section?.minimumPassPercentage || 50,
      [Validators.required, Validators.min(50), Validators.max(100)]
    ))
    group.addControl('sectionWeightage', this.fb.control(
      section?.sectionWeightage ?? null,
      [Validators.required, Validators.min(0), Validators.max(this.maxSectionWeightage)]
    ))

    // The rich text editor has no input cap of its own, so the limit the textarea
    // enforces for the other types becomes a validator here.
    const additionalInstructions = group.get('additionalInstructions')
    additionalInstructions?.setValidators(this.instructionsLengthValidator())
    additionalInstructions?.updateValueAndValidity({ emitEvent: false })
  }

  onAdditionalInstructionsChange(content: string): void {
    const additionalInstructions = this.currentSectionGroup?.get('additionalInstructions')
    additionalInstructions?.setValue(content)
    additionalInstructions?.markAsDirty()
  }

  get additionalInstructionsLength(): number {
    return this.getInstructionsLength(this.currentSectionGroup?.get('additionalInstructions')?.value)
  }

  /**
   * CQF instructions are stored as markup, so the limit is measured against the text
   * the learner reads instead of the tags wrapped around it.
   */
  private getInstructionsLength(value: string): number {
    if (!value) {
      return 0
    }
    if (!this.isAdvanceAssessmentQuestionOptionWeightage()) {
      return value.length
    }
    return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length
  }

  private instructionsLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const actualLength = this.getInstructionsLength(control.value)
      return actualLength > this.instructionsMaxLength
        ? { maxlength: { requiredLength: this.instructionsMaxLength, actualLength } }
        : null
    }
  }

  addBasicSection(): void {
    const maxSections = 5
    if (this.basicSections.length >= maxSections) {
      this.snackBar.open(`Maximum ${maxSections} sections allowed`)
      return
    }
    this.basicSections.push(this.createBasicSectionGroup())
    this.selectBasicSection(this.basicSections.length - 1)
  }

  selectBasicSection(index: number): void {
    if (index >= 0 && index < this.basicSections.length) {
      this.selectedSectionIndex = index
      // Load questions for the selected section
      this.loadQuestionsForSection(index)
      // Force change detection to update the form
      this.cdr.detectChanges()
    }
  }

  get currentBasicSectionGroup(): FormGroup {
    return this.basicSections.at(this.selectedSectionIndex) as FormGroup
  }

  populateBasicAssessmentForm(): void {
    // For basic assessment, populate based on whether sections are supported
    if (this.isBasicAssessmentWithSections()) {
      // Ensure sections FormArray exists for section level assessments
      if (!this.basicAssessmentForm.get('sections')) {
        this.basicAssessmentForm.addControl('sections', this.fb.array([]))
      }
      // Populate sections FormArray from assessmentData.children
      if (this.assessmentData.children && this.assessmentData.children.length > 0) {
        const sectionsArr = this.basicSections
        while (sectionsArr.length) {
          sectionsArr.removeAt(0)
        }

        this.assessmentData.children.forEach((section: any, index: number) => {
          const sg = this.createBasicSectionGroup()
          sg.patchValue({
            name: section.name || `Section ${String.fromCharCode(65 + index)}`,
            additionalInstructions: section.additionalInstructions || section.instructions || '',
            totalQuestions: section.totalQuestions || 0,
            maxQuestions: section.maxQuestions || 0,
            minPassPercentage: section.minimumPassPercentage || 0
          })
          sectionsArr.push(sg)
        })

        if (sectionsArr.length === 0) {
          sectionsArr.push(this.createBasicSectionGroup())
        }

        // Load questions for the initially selected basic section
        this.loadQuestionsForSection(this.selectedSectionIndex)
      }
    } else {
      // Single-section basic assessment (legacy behavior)
      if (this.assessmentData.children && this.assessmentData.children.length > 0) {
        const section = this.assessmentData.children[0]

        this.basicAssessmentForm.patchValue({
          totalQuestions: section.totalQuestions || 0,
          maxQuestions: section.maxQuestions || 0,
          minPassPercentage: section.minimumPassPercentage || 0,
          additionalInstructions: section.additionalInstructions || ''
        })

        // Store section identifier for updates
        if (!this.basicAssessmentForm.get('sectionIdentifier')) {
          this.basicAssessmentForm.addControl('sectionIdentifier', this.fb.control(section.identifier))
        } else {
          this.basicAssessmentForm.get('sectionIdentifier')?.setValue(section.identifier)
        }

        // Load questions for basic assessment section
        this.loadQuestionsForSection(0)
      }
    }

    // Disable form if read-only mode
    if (this.isReadOnly) {
      this.basicAssessmentForm.disable()
    }
  }

  populateOptionWeightageForm(): void {
    // For option weightage assessment, populate form with existing data
    if (this.assessmentData.children && this.assessmentData.children.length > 0) {
      const section = this.assessmentData.children[0] // Option weightage has only one section

      this.optionWeightageForm.patchValue({
        additionalInstructions: section.additionalInstructions || section.instructions || ''
      })

      // Load questions for option weightage section
      this.loadQuestionsForSection(0)
    }

    // Disable form if read-only mode
    if (this.isReadOnly) {
      this.optionWeightageForm.disable()
    }
  }

  populateFormFromAssessmentData(): void {
    if (this.assessmentData.children && this.assessmentData.children.length > 0) {
      // Clear existing sections
      while (this.sections.length) {
        this.sections.removeAt(0)
      }

      // Add sections from assessment data
      this.assessmentData.children.forEach((section: any, index: number) => {
        const isParagraphSection = section.sectionType === 'paragraph'
        const sectionGroup = this.fb.group({
          name: [section.name || `Section ${String.fromCharCode(65 + index)}`, [Validators.required, Validators.maxLength(this.nameMaxLength), Validators.pattern(/^[a-zA-Z0-9.\-_$/:\[\]*!'\s]+$/)]],
          additionalInstructions: [isParagraphSection ? '' : (section.additionalInstructions || section.instructions || '')],
          questionParagraph: [
            isParagraphSection ? (section.questionParagraph || section.paragraph || '') : '',
            isParagraphSection ? [Validators.required] : []
          ]
        })
        this.sections.push(sectionGroup)
      })

      if (this.sections.length === 0) {
        this.sections.push(this.createSectionGroup())
      }

      // Load questions for the initially selected section
      this.loadQuestionsForSection(this.selectedSectionIndex)
    }

    // Covers the rebuilt sections above as well as the default one that stands in
    // before any section has been created.
    this.sections.controls.forEach((sectionGroup, index) => {
      this.addCqfSectionControls(sectionGroup as FormGroup, this.assessmentData.children?.[index])
    })

    // Disable form if read-only mode
    if (this.isReadOnly) {
      this.sessionsForm.disable()
    }
  }

  calculateDifficultyLevelCounts(): void {
    // Reset counts
    this.difficultyLevels.forEach(level => level.count = 0)

    if (this.assessmentData.children) {
      this.assessmentData.children.forEach((section: any) => {
        if (section.sectionLevelDefinition) {
          Object.keys(section.sectionLevelDefinition).forEach(difficultyKey => {
            const definition = section.sectionLevelDefinition[difficultyKey]
            const levelIndex = this.difficultyLevels.findIndex(level =>
              level.name.toLowerCase() === difficultyKey.toLowerCase()
            )
            if (levelIndex >= 0 && definition.noOfQuestions) {
              this.difficultyLevels[levelIndex].count += definition.noOfQuestions
            }
          })
        }
      })
    }
  }



  selectSection(index: number): void {
    this.selectedSectionIndex = index
    // Load questions for the selected section
    this.loadQuestionsForSection(index)
    // Force change detection to update the form
    this.cdr.detectChanges()
  }

  loadQuestionsForSection(sectionIndex: number): void {
    this.questionsList = []
    if (this.assessmentData?.children && this.assessmentData.children[sectionIndex]) {
      const section = this.assessmentData.children[sectionIndex]
      if (section.children && section.children.length > 0) {
        section.children.forEach((question: any) => {
          this.questionsList.push({
            qType: question.qType || 'MCQ-SCA',
            identifier: question.identifier,
            ...question
          })
        })
      }
    }
  }

  getDifficultyLevelSummary(): string {
    return this.difficultyLevels
      .map(level => `${level.name} - ${level.count}`)
      .join(', ')
  }

  getSectionDifficultyLevelSummary(sectionIndex: number): string {
    if (!this.assessmentData.children || !this.assessmentData.children[sectionIndex]) {
      return 'Easy - 0, Medium - 0, Difficult - 0, HOTS - 0'
    }

    const section = this.assessmentData.children[sectionIndex]
    const sectionDifficultyLevels = [
      { name: 'Easy', count: 0 },
      { name: 'Medium', count: 0 },
      { name: 'Difficult', count: 0 },
      { name: 'HOTS', count: 0 }
    ]

    if (section.sectionLevelDefinition) {
      Object.keys(section.sectionLevelDefinition).forEach(difficultyKey => {
        const definition = section.sectionLevelDefinition[difficultyKey]
        const levelIndex = sectionDifficultyLevels.findIndex(level =>
          level.name.toLowerCase() === difficultyKey.toLowerCase()
        )
        if (levelIndex >= 0 && definition.noOfQuestions) {
          sectionDifficultyLevels[levelIndex].count = definition.noOfQuestions
        }
      })
    }

    return sectionDifficultyLevels
      .map(level => `${level.name} - ${level.count}`)
      .join(', ')
  }

  get nameLength(): number {
    return this.currentSectionGroup?.get('name')?.value?.length || 0
  }

  onBasicAssessmentSave(): void {
    if (this.basicAssessmentForm.valid) {
      // For basic assessment without sections, exclude the sections array from form value if it exists
      const formValue = this.basicAssessmentForm.value
      const { sections, ...formData } = formValue

      // For single section basic assessment, parent totals match the section values
      const parentChanges = {
        totalQuestions: formData.totalQuestions || 0,
        maxQuestions: formData.maxQuestions || 0
      }

      const saveData = {
        ...formData,
        parentChanges: parentChanges
      }
      this.saved.emit(saveData)
    } else {
      this.basicAssessmentForm.markAllAsTouched()
    }
  }

  onOptionWeightageSave(): void {
    if (this.optionWeightageForm.valid) {
      const formData = this.optionWeightageForm.value
      const sectionIdentifier = this.assessmentData.children?.[0]?.identifier || null

      const saveData = {
        sectionData: formData,
        sectionIdentifier: sectionIdentifier
      }
      this.saved.emit(saveData)
    } else {
      this.optionWeightageForm.markAllAsTouched()
    }
  }

  onSave(): void {
    // Validate only the current section
    const currentSection = this.currentSectionGroup
    if (currentSection.valid) {
      const currentSectionData = currentSection.value
      const sectionIdentifier = this.assessmentData.children?.[this.selectedSectionIndex]?.identifier || null

      const saveData = {
        sectionData: currentSectionData,
        sectionIdentifier: sectionIdentifier
      }
      this.saved.emit(saveData)
    } else {
      currentSection.markAllAsTouched()
    }
  }

  onUpdate(): void {
    // Validate only the current section
    const currentSection = this.currentSectionGroup
    if (currentSection.valid) {
      const currentSectionData = currentSection.value
      const originalSectionData = this.assessmentData.children?.[this.selectedSectionIndex]

      // Compare current values with original data and get only changed fields
      const changedData: any = {}

      // Check name
      const currentName = currentSectionData.name?.trim()
      const originalName = originalSectionData?.name
      if (currentName !== originalName) {
        changedData.name = currentName
      }

      // Check additional instructions or question paragraph based on section type
      const isParagraphSection = originalSectionData?.sectionType === 'paragraph'
      if (isParagraphSection) {
        const currentQuestionParagraph = currentSectionData.questionParagraph
        const originalQuestionParagraph = originalSectionData?.questionParagraph || originalSectionData?.paragraph || ''
        if (currentQuestionParagraph !== originalQuestionParagraph) {
          changedData.questionParagraph = currentQuestionParagraph
        }
      } else {
        const currentAdditionalInstructions = currentSectionData.additionalInstructions
        const originalAdditionalInstructions = originalSectionData?.additionalInstructions || originalSectionData?.instructions || ''
        if (currentAdditionalInstructions !== originalAdditionalInstructions) {
          changedData.additionalInstructions = currentAdditionalInstructions
        }
      }

      // CQF sections also carry a pass mark and a weightage
      if (this.isAdvanceAssessmentQuestionOptionWeightage()) {
        if (currentSectionData.minPassPercentage !== originalSectionData?.minimumPassPercentage) {
          changedData.minimumPassPercentage = currentSectionData.minPassPercentage
        }
        if (currentSectionData.sectionWeightage !== originalSectionData?.sectionWeightage) {
          changedData.sectionWeightage = currentSectionData.sectionWeightage
        }
      }

      if (Object.keys(changedData).length > 0) {
        const sectionIdentifier = this.assessmentData.children?.[this.selectedSectionIndex]?.identifier || null

        const updateData = {
          changedData: changedData,
          sectionIdentifier: sectionIdentifier
        }
        this.updated.emit(updateData)
      } else {
        this.snackBar.open('No changes detected')
      }
    } else {
      currentSection.markAllAsTouched()
    }
  }

  onSaveBasicSection(): void {
    const currentSection = this.currentBasicSectionGroup
    if (currentSection.valid) {
      const currentSectionData = currentSection.value
      const sectionIdentifier = this.assessmentData.children?.[this.selectedSectionIndex]?.identifier || null

      // Calculate parent totals if multiple sections exist
      let parentChanges: any = null
      if (this.isBasicAssessmentWithSections()) {
        parentChanges = this.calculateParentTotalsForSave(currentSectionData)
      }

      const saveData = {
        sectionData: currentSectionData,
        sectionIdentifier: sectionIdentifier,
        parentChanges: parentChanges
      }

      this.saved.emit(saveData)
    } else {
      currentSection.markAllAsTouched()
    }
  }

  private calculateParentTotalsForSave(currentSectionData: any): any {
    const parentChanges: any = {}

    let totalQuestionsSum = 0
    let maxQuestionsSum = 0

    this.basicSections.controls.forEach((section, index) => {
      if (index === this.selectedSectionIndex) {
        // Use the new values for current section being saved
        totalQuestionsSum += currentSectionData.totalQuestions || 0
        maxQuestionsSum += currentSectionData.maxQuestions || 0
      } else {
        // Use existing values for other sections
        const sectionData = this.assessmentData.children?.[index]
        totalQuestionsSum += sectionData?.totalQuestions || 0
        maxQuestionsSum += sectionData?.maxQuestions || 0
      }
    })

    parentChanges.totalQuestions = totalQuestionsSum
    parentChanges.maxQuestions = maxQuestionsSum

    return parentChanges
  }

  onUpdateBasicSection(): void {
    const currentSection = this.currentBasicSectionGroup
    if (currentSection.valid) {
      const currentSectionData = currentSection.value
      const originalSectionData = this.assessmentData.children?.[this.selectedSectionIndex]

      const changedData: any = {}
      const currentName = currentSectionData.name?.trim()
      const originalName = originalSectionData?.name
      if (currentName !== originalName) {
        changedData.name = currentName
      }

      const currentAdditionalInstructions = currentSectionData.additionalInstructions
      const originalAdditionalInstructions = originalSectionData?.additionalInstructions || originalSectionData?.instructions || ''
      if (currentAdditionalInstructions !== originalAdditionalInstructions) {
        changedData.additionalInstructions = currentAdditionalInstructions
      }

      // Check totalQuestions
      const currentTotalQuestions = currentSectionData.totalQuestions
      const originalTotalQuestions = originalSectionData?.totalQuestions || 0
      let totalQuestionsChanged = false
      if (currentTotalQuestions !== originalTotalQuestions) {
        changedData.totalQuestions = currentTotalQuestions
        totalQuestionsChanged = true
      }

      // Check maxQuestions
      const currentMaxQuestions = currentSectionData.maxQuestions
      const originalMaxQuestions = originalSectionData?.maxQuestions || 0
      let maxQuestionsChanged = false
      if (currentMaxQuestions !== originalMaxQuestions) {
        changedData.maxQuestions = currentMaxQuestions
        maxQuestionsChanged = true
      }

      // Check minPassPercentage
      const currentMinPassPercentage = currentSectionData.minPassPercentage
      const originalMinPassPercentage = originalSectionData?.minimumPassPercentage || 0
      if (currentMinPassPercentage !== originalMinPassPercentage) {
        changedData.minimumPassPercentage = currentMinPassPercentage
      }

      if (Object.keys(changedData).length > 0) {
        const sectionIdentifier = this.assessmentData.children?.[this.selectedSectionIndex]?.identifier || null

        // Calculate parent totals if totalQuestions or maxQuestions changed
        let parentChanges: any = null
        if ((totalQuestionsChanged || maxQuestionsChanged) && this.isBasicAssessmentWithSections()) {
          parentChanges = this.calculateParentTotals(currentSectionData, totalQuestionsChanged, maxQuestionsChanged)
        }

        const updateData = {
          changedData: changedData,
          sectionIdentifier: sectionIdentifier,
          parentChanges: parentChanges
        }
        this.updated.emit(updateData)
      } else {
        this.snackBar.open('No changes detected')
      }
    } else {
      currentSection.markAllAsTouched()
    }
  }

  private calculateParentTotals(currentSectionData: any, totalQuestionsChanged: boolean, maxQuestionsChanged: boolean): any {
    const parentChanges: any = {}

    if (totalQuestionsChanged) {
      let totalQuestionsSum = 0
      this.basicSections.controls.forEach((section, index) => {
        if (index === this.selectedSectionIndex) {
          // Use the updated value for current section
          totalQuestionsSum += currentSectionData.totalQuestions || 0
        } else {
          // Use existing values for other sections
          const sectionData = this.assessmentData.children?.[index]
          totalQuestionsSum += sectionData?.totalQuestions || 0
        }
      })
      parentChanges.totalQuestions = totalQuestionsSum
    }

    if (maxQuestionsChanged) {
      let maxQuestionsSum = 0
      this.basicSections.controls.forEach((section, index) => {
        if (index === this.selectedSectionIndex) {
          // Use the updated value for current section
          maxQuestionsSum += currentSectionData.maxQuestions || 0
        } else {
          // Use existing values for other sections
          const sectionData = this.assessmentData.children?.[index]
          maxQuestionsSum += sectionData?.maxQuestions || 0
        }
      })
      parentChanges.maxQuestions = maxQuestionsSum
    }

    return Object.keys(parentChanges).length > 0 ? parentChanges : null
  }

  addQuestions(): void {
    const dialogRef = this.dialog.open(SelectQuestionModalComponent, {
      width: '800px',
      maxWidth: '90vw',
      data: {
        title: 'Select the questions type',
        isOptionWeightage: this.isAdvanceAssessmentOptionWeightage() || this.isAdvanceAssessmentQuestionOptionWeightage(),
        isBasicAssessment: this.isBasicAssessment()
      }
    })

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.handleQuestionTypeSelection(result)
      }
    })
  }

  private handleQuestionTypeSelection(questionType: string): void {

    // Create question object with qType and identifier
    const questionData = {
      qType: this.mapQuestionType(questionType),
      identifier: this.assessmentService.generateUUID()
    }

    // Add to questions list
    this.questionsList.push(questionData)
  }

  private mapQuestionType(questionType: string): string {
    // Map the question types to appropriate codes
    switch (questionType) {
      case 'single-mcq':
        return 'MCQ-SCA'
      case 'multiple-mcq':
        return 'MCQ-MCA'
      case 'fill-blanks':
        return 'FTB'
      case 'match-following':
        return 'MTF'
      case 'true-false':
        return 'MCQ-SCA-TF'
      default:
        return questionType
    }
  }

  onQuestionExpanded(questionIndex: number): void {
    // Toggle expanded state - if same question clicked, collapse it
    this.expandedQuestionIndex = this.expandedQuestionIndex === questionIndex ? null : questionIndex
  }

  onQuestionUpdated(questionData: any): void {
    // For basic assessment with sections OR advanced assessment, use selected section
    // For basic assessment without sections (single section), always use index 0
    const sectionIndex = this.isBasicAssessmentWithSections() || !this.isBasicAssessment() ? this.selectedSectionIndex : 0
    const sectionIdentifier = this.assessmentData.children?.[sectionIndex]?.identifier || null
    // Get identifier from questionData directly (not questionData.questionData)
    const questionIdentifier = questionData.identifier || this.assessmentService.generateUUID()

    // Wrap the question request with the question identifier as key
    const changedData = {
      [questionIdentifier]: questionData.questionRequest
    }

    const updateData = {
      changedData: changedData,
      sectionIdentifier: sectionIdentifier,
      questionIdentifier: questionIdentifier
    }
    this.updateQuestion.emit(updateData)

  }

  onQuestionDeleted(event: any): void {
    const questionData = event.questionData
    const questionIndex = event.questionIndex - 1 // Convert to 0-based index

    // For basic assessment with sections OR advanced assessment, use selected section
    // For basic assessment without sections (single section), always use index 0
    const sectionIndex = this.isBasicAssessmentWithSections() || !this.isBasicAssessment() ? this.selectedSectionIndex : 0

    // Check if this is an existing question with do_ identifier
    if (questionData.identifier && questionData.identifier.startsWith('do_')) {
      // This is an existing question - need to call API to remove from section
      const sectionIdentifier = this.assessmentData.children?.[sectionIndex]?.identifier

      if (sectionIdentifier) {
        // Remove the question identifier from section's children array
        const section = this.assessmentData.children[sectionIndex]
        if (section.children && Array.isArray(section.children)) {
          section.children = section.children.filter((childId: string) => childId !== questionData.identifier)
        }

        // Build update request to remove question from hierarchy
        const deleteData = {
          sectionIdentifier: sectionIdentifier,
          questionIdentifier: questionData.identifier,
          isDelete: true
        }

        this.updateQuestion.emit(deleteData)
      }
    } else {
      // This is a new unsaved question - just remove from local list
      this.questionsList.splice(questionIndex, 1)
      this.snackBar.open('Question removed')
    }
  }

  getCurrentSectionLevelDefinition(): any {
    if (this.assessmentData.children && this.assessmentData.children[this.selectedSectionIndex]) {
      return this.assessmentData.children[this.selectedSectionIndex].sectionLevelDefinition || null
    }
    return null
  }

  isCurrentSectionParagraphType(): boolean {
    if (this.assessmentData?.children && this.assessmentData.children[this.selectedSectionIndex]) {
      return this.assessmentData.children[this.selectedSectionIndex].sectionType === 'paragraph'
    }
    return false
  }

  isQuestionLimitReached(): boolean {
    // For basic assessment (single section)
    if (this.isBasicAssessment() && !this.isBasicAssessmentWithSections()) {
      const totalQuestions = this.basicAssessmentForm?.get('totalQuestions')?.value || 0
      const currentQuestionsCount = this.questionsList?.length || 0
      return currentQuestionsCount >= totalQuestions
    }

    // For basic assessment with sections
    if (this.isBasicAssessmentWithSections()) {
      const currentSection = this.currentBasicSectionGroup
      const totalQuestions = currentSection?.get('totalQuestions')?.value || 0
      const currentQuestionsCount = this.questionsList?.length || 0
      return currentQuestionsCount >= totalQuestions
    }

    return false
  }

  openBulkUploadDialog() {
    // Get totalQuestions based on assessment type
    let totalQuestions = null
    if (this.isBasicAssessmentWithSections()) {
      // For basic assessment with multiple sections, get totalQuestions from current section
      totalQuestions = this.currentBasicSectionGroup?.get('totalQuestions')?.value || null
    } else if (this.isBasicAssessment()) {
      // For basic assessment without sections, get totalQuestions from basicAssessmentForm
      totalQuestions = this.basicAssessmentForm?.get('totalQuestions')?.value || null
    }

    const dialogRef = this.dialog.open(BulkUploadAllTypeQuestionComponent, {
      width: '90vw',
      maxWidth: '1200px',
      data: {
        maxFileSize: 400 * 1024 * 1024,
        questionTracking: this.getCurrentSectionLevelDefinition(),
        totalQuestions: totalQuestions,
        compatibilityLevel: this.assessmentData?.compatibilityLevel,
        assessmentType: this.assessmentData?.assessmentType,
        existingQuestionsCount: this.questionsList?.length || 0
      },
      autoFocus: false
    })


    dialogRef.afterClosed().subscribe(result => {
      if (result && result.action === 'CREATE') {
        // Handle the created questions from bulk upload
        const questions = result.questions
        const isOldTemplate = result.isOldTemplate || false

        // Process FTB questions to update body and editorState.question
        if (questions && questions.length > 0) {
          questions.forEach((question: any) => {
            if (question.qType === 'FTB') {
              // Update body and editorState.question using getFtbQuestion
              const formattedQuestion = this.getFtbQuestion(question.body)
              question.body = formattedQuestion
              question.name = formattedQuestion
              if (question.editorState) {
                question.editorState.question = formattedQuestion
              }
            }
          })
        }
        // For basic assessment with sections OR advanced assessment, use selected section
        // For basic assessment without sections (single section), always use index 0
        const sectionIndex = this.isBasicAssessmentWithSections() || !this.isBasicAssessment() ? this.selectedSectionIndex : 0
        const sectionIdentifier = this.assessmentData.children?.[sectionIndex]?.identifier || null

        if (sectionIdentifier && questions && questions.length > 0) {
          // Emit the update event with the array of questions
          const updateData = {
            changedData: questions, // Array of questions
            sectionIdentifier: sectionIdentifier,
            isOldTemplate: isOldTemplate
          }
          this.updateQuestion.emit(updateData)
        }
      }
    })
  }

  getFtbQuestion(q: string) {
    const tempData = q.split('<blank>').join('<input style=\"border-style:none none solid none\" />')
    return `<p>${tempData}</p>`
  }

  get isReadOnly(): boolean {
    return this.assessmentService.getReadOnly()
  }
}
