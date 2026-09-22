import { Component, inject } from "@angular/core";
import { AbstractControl, FormControl, ValidationErrors } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { NsAccessControlConfig } from "../../../_models/access-control.model";

const NAME_PATTERN = /^[a-zA-Z0-9.\-_$\/:\[\] !]+$/;
const MAX_NAME_LENGTH = 70;

@Component({
  selector: "sb-uic-save-user-group",
  templateUrl: "./save-user-group.component.html",
  styleUrls: ["./save-user-group.component.scss"],
  standalone: false
})
export class SaveUserGroupComponent {
  private readonly dialogRef = inject<MatDialogRef<SaveUserGroupComponent>>(MatDialogRef);
  readonly data = inject<{ userGroupName: string }>(MAT_DIALOG_DATA);

  readonly maxNameLength = MAX_NAME_LENGTH;

  readonly nameControl = new FormControl(this.data?.userGroupName || "", [
    SaveUserGroupComponent.requiredValidator,
    SaveUserGroupComponent.maxLengthValidator,
    SaveUserGroupComponent.patternValidator
  ]);

  private static requiredValidator(control: AbstractControl): ValidationErrors | null {
    return (control.value || "").trim() ? null : { required: true };
  }

  private static maxLengthValidator(control: AbstractControl): ValidationErrors | null {
    return (control.value || "").trim().length > MAX_NAME_LENGTH ? { maxlength: true } : null;
  }

  private static patternValidator(control: AbstractControl): ValidationErrors | null {
    const value = (control.value || "").trim();
    return !value || NAME_PATTERN.test(value) ? null : { pattern: true };
  }

  showValidationMsg(errorKey: string): boolean {
    return this.nameControl.hasError(errorKey) && (this.nameControl.dirty || this.nameControl.touched);
  }

  cancel(): void {
    this.dialogRef.close({ action: NsAccessControlConfig.IActions.Reject });
  }

  apply(): void {
    if (this.nameControl.invalid) {
      this.nameControl.markAsTouched();
      return;
    }
    this.dialogRef.close({
      action: NsAccessControlConfig.IActions.Confirm,
      userGroupName: (this.nameControl.value || "").trim()
    });
  }
}
