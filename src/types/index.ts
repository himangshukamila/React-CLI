export interface CustomCreatedFile {
  name: string
  folder: string
  ext: string
}

export interface UiSelections {
  projectName?: string
  selectedPackages: string[]
  selectedSetup: string[]
  selectedFolders: string[]
  shouldRunDevServer: boolean
  devServerPort: number
  createdFiles: CustomCreatedFile[]
}

export interface FormField {
  name: string
  type: string
  label: string
}

export interface OptionChoice {
  value: string
  label: string
  hint?: string
}

export interface PromptMultiselectOptions {
  message?: string
  options: OptionChoice[]
  initialValues?: string[]
  required?: boolean
}

export interface PromptConfirmOptions {
  message?: string
  initialValue?: boolean
}

export interface PromptSelectOptions {
  message?: string
  options: OptionChoice[]
  initialValue?: string
}

export interface SetupUiHtmlParams {
  displayName?: string
  token: string
  submitUrl: string
  timeLeftMs: number
}

export interface SetupWizardOptions {
  displayName?: string
}

export interface AssetGeneratorOptions {
  name?: string
  output?: string
  force?: boolean
}

export interface FormGeneratorOptions {
  name?: string
  fields?: string[]
  output?: string
  force?: boolean
}

export interface MakeOptions {
  name?: string
  fields?: string[]
  output?: string
  force?: boolean
}

export interface EnvironmentVariable {
  key: string
  value: string
}

export interface DoctorCheckResult {
  title: string
  status: 'ok' | 'warn' | 'error'
  message: string
}
