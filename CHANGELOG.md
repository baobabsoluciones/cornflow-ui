# Changelog

## [3.4.0] - 02-10-2026

### Added
- **Configurable instance upload file formats**  
  - Added `instanceFileFormats` to the core parameters: a deployment that only ever receives Excel can narrow the upload drop zone instead of advertising `json` and `csv` it cannot use
  - Unreadable extensions are dropped with a console warning, and a list that ends up empty falls back to the default, so a typo narrows nothing rather than blocking every upload
  - `xls`, `xlsm` and `xlsb` can be opted into; the parser already read them
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #227

- **Schema-declared column order**  
  - Tables and exports honour an `order` list written by the backend beside `required`, accepted both on the table and inside `items`
  - It orders columns without selecting them: a partial `order` places what it names and leaves the rest behind it
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #228

- **Project languages driven by configuration**  
  - The visible languages now come from `config.languages` instead of being fixed
  *Contributors:* [@sergiodelatorre](#)  
  *Commit ID:* #225

### Fixed
- **One column-order rule for every table and every export**  
  - The interface and the Excel download disagreed about column order, and the frontend-automation tables followed a third path of their own
  - All of them now share one rule: with rows the data decides, without rows `required` does, and `order` outranks both
  - Empty tables keep every column instead of only the mandatory ones, and tables with no `required` are no longer dropped from the workbook
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #228

- **File processors on master-data uploads**  
  - The configured `fileProcessors` only ran on the instance-load path, so "edit all master tables" and the per-table bulk upload sent the raw file and the backend rejected it
  - Extracted to a shared `useFilePreProcessing` so all three upload routes go through it
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #226

- **`$vuetify` messages rendered as raw keys**  
  - The hand-written `$vuetify` block covered 5 of the ~26 message groups Vuetify asks for, and the vue-i18n adapter prints the raw key for anything missing, so `$vuetify.fileInput.counterSize` appeared verbatim in the bulk-upload modal
  - Vuetify's own locale is now the base, with the project translations on top
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #226

### Changed
- **Version in `package-lock.json`**  
  - The lockfile had been left at 3.2.6 and is now kept in step with `package.json`

## [3.3.0] - 30-09-2026

### Added
- **Pre-ETL parameters in the load-instance step**  
  - Config parameters marked `pre_etl: true` in the JSON schema are asked for alongside the instance upload and sent to the ETL, the data checks and the solve
  - Shown as a grid in the left column of the same step, two fields per row
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #221

### Fixed
- **UTC hours**  
  - Corrected the hour handling that shifted times in the execution views
  *Contributors:* [@david-hidalgo-baobab](#)  
  *Commit ID:* #220

## [3.2.9] - 28-09-2026

### Added
- **Hide the solver column from the execution history**  
  - `showSolver` in `showExtraProjectExecutionColumns`; unlike the rest it defaults to shown, so deployments with a single solver can drop a column that carries no information
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #218

### Fixed
- **`canEditAllMasterTables` checked the wrong flag**  
  *Contributors:* [@sergiodelatorre](#)  
  *Commit ID:* #219

## [3.2.8] - 22-09-2026

### Fixed
- **Solution Excel column order**  
  - `getArrayTypeExportHeaders` was letting the schema's `properties` order override the data's own, a regression from #186; the data order is the default again and the schema order became opt-in for the one call site that builds its schema from the configured columns
  - Fixed in both copies of the function, the main thread and the Excel Web Worker
  *Contributors:* [@david-hidalgo-baobab](#)  
  *Commit ID:* #215

## [3.2.7] - 16-09-2026

### Changed
- **Historical components migrated to `<script setup>`**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #213

## [3.2.6] - 15-09-2026

### Fixed
- **Dependabot alerts**  
  - Resolved the open dependency vulnerability alerts
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #211

## [3.2.5] - 26-08-2026

### Added
- **Unit specs recovered from an enterprise branch**  
  - 11 specs that had been stranded outside the core
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #204

### Changed
- **CI runners on Node 24**  
  - Moved the runners and recorded the real cause of the Sonar 413
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #206

### Fixed
- **Frontend automation: a null `schemas` means no schema restriction**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #205

- **Dependency vulnerabilities**  
  - `npm audit` clean
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #201

### Removed
- **Hardening branch reverted**  
  - #196 was reverted in #203
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #203

## [3.2.4] - 10-08-2026

### Added
- **End-to-end tests**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #198

## [3.2.3] - 06-08-2026

### Fixed
- **Router built after config init**  
  - `useHashMode` was read before the config had resolved, so it was ignored
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #199

## [3.2.2] - 05-08-2026

### Fixed
- **Consumer app locales loaded via the `@/` alias**  
  - A relative path broke the lookup once the core was consumed as a package
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #197

## [3.2.1] - 15-07-2026

### Changed
- **Spanish code comments translated to English**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #193

### Fixed
- **Create-execution view scrolls to the wizard buttons**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #194

## [3.2.0] - 09-07-2026

### Added
- **Frontend automation moved into the core**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #188

- **Execution polling hardening**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #187

### Fixed
- **Core table: deferred height timer cancelled and DOM access guarded**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #191

- **ReDoS in the email regex (S5852)**  
  - Bounded the quantifiers
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #190

- **CI inherited from the carve**  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #189

## [3.1.0] - 07-07-2026

### Added
- **Frontend-automation module shipped in the core**  
  *Contributors:* [@HelenaCA](#)

### Changed
- **Core re-baseline v3**  
  - The baseline the whole 3.x line builds on
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #186

## [3.0.3] - 01-07-2026

### Added
- **Edit a user profile from the roles dialog**  
  *Contributors:* [@HelenaCA](#)

### Changed
- **Dependency bumps**  
  - vue 3.5.39, vue-i18n 11.4.6, dompurify, prettier, @types/node, @aws-amplify/core
  *Contributors:* [@HelenaCA](#)

### Fixed
- **Large table exports routed through the worker/zip path**  
  - Avoids freezing the tab on datasets that would otherwise exhaust memory
  *Contributors:* [@HelenaCA](#)

## [3.0.2] - 30-06-2026

### Fixed
- **TypeScript 6.0 and vue-tsc errors**  
  - tsconfig deprecations and pre-existing type debt
  *Contributors:* [@HelenaCA](#)

## [3.0.1] - 29-06-2026

### Changed
- **The core is consumable as a package** (breaking)  
  - Self-referencing imports and an explicit exports map, so a client can depend on `@cornflow-ui/core` instead of cloning the codebase
  *Contributors:* [@HelenaCA](#)

## [3.0.0] - 29-06-2026

### Changed
- **Re-baselined as `@cornflow-ui/core`** (breaking)  
  - The repository becomes the shared core package the client frontends consume, rather than an application in its own right
  *Contributors:* [@HelenaCA](#)

### Added
- **Frontend-automation filters, sections and automatic dashboards**  
  - Filtering in frontend automation (#182), new frontend-automation and app-specific sections (#180), improved automatic dashboards (#179), instance setting (#177) and search input operation (#178)
  *Contributors:* [@HelenaCA](#)

> Versions 2.x were never released: the project went from the 1.x application to the 3.x core package.

## [1.3.2] - 24-09-2025

### Added
- **PR checks workflow and issue templates**  
  - Added pull request checks workflow for automated code quality validation
  - Implemented issue templates to standardize bug reports and feature requests
  - Enhanced development workflow with automated checks
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #163

### Changed
- **HTML name implementation**  
  - Implemented dynamic name configuration in HTML document
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #164

### Fixed
- **GitHub security improvements**  
  - Fixed GitHub security vulnerabilities and warnings
  - Enhanced repository security configuration
  - Improved dependency security and vulnerability management
  *Contributors:* [@HelenaCA](#)

## [1.3.1] - 02-09-2025

### Changed
- **Configuration management improvements**  
  - Refactored app/config.ts to only contain app codebase config values
  - Improved separation of concerns between environment and codebase configuration
  - Enhanced documentation for two-layer configuration system
  - Added clear guidelines for environment variable usage
  - Improved portability across different deployment environments
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #149

- **Code quality enhancements**  
  - Refactored codebase to meet SonarQube quality gate standards
  - Improved code maintainability and reduced technical debt
  - Enhanced code documentation and type definitions
  - Fixed code smells and potential vulnerabilities
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #147

## [1.3.0] - 20-08-2025

### Added
- **User manual and dashboard improvements**  
  - Added download user manual with correct href functionality
  - Added showDashboardMainView config parameter for better dashboard control
  - Updated README documentation with new features
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #127

- **New modern login page design**  
  - Implemented new sign in landing page with modern design
  - Added multiple ways of log-in functionality
  - Added dynamic background image with moving cards
  - Added prominent display of company logo and baobab logo
  - Added new platform name displayed on login interface
  - Positioned login form on the right side with application name title
  - Added options to log in with Google and Microsoft when configurations are enabled
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #128

- **Added default language and values json path**  
  - Added configurable values.json path in app configuration
  - Added configurable default language setting (defaulting to 'es')
  - Enhanced flexibility for localization efforts
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #134

- **Instance checks excel export**  
  - Added "Download instance checks" button on instance checks view
  - Implemented XLSX (Excel) export functionality for instance check data
  - Enhanced analysis and reporting capabilities
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #141

- **External app integration enhancements**  
  - Added fullname display option for better user identification
  - Added staging environment warning option for development safety
  - Improved refresh token handling for OpenID authentication
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #145

- **Comprehensive unit testing implementation**  
  - Implemented comprehensive core unit testing with Vitest
  - Achieved 90% test coverage
  - Added workflow to ensure unit tests pass in CI/CD pipeline
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #146

- **Package management improvements**  
  - Added package-lock.json for better dependency management
  - Updated all package.json library versions with exact versions (without ^)
  - Enhanced build reproducibility and stability

### Fixed
- **Data validation error handling fix**  
  - Fixed UI hanging indefinitely when check data fails
  - Improved error handling for DAG data validation failures
  - Added proper error messages instructing users to contact support
  - Enhanced user feedback during data validation processes
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #133

- **Date processing and navigation fixes**  
  - Fixed incorrect date header handling in data processing utilities
  - Preserved original date string formats in instance and solution data
  - Fixed incorrect redirection after execution load (now redirects to solution tables)
  - Improved date format consistency across the application
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #140

- **Authentication-specific UI improvements**  
  - Hidden "Change password" option when using external authentication methods
  - Improved user interface consistency for non-Cornflow authentication
  - Enhanced user experience by removing non-applicable options
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #142

- **Excel processing improvements**  
  - Fixed handling of empty Excel sheets in data processing
  - Improved error handling for edge cases in file processing
  - Enhanced stability of data import/export functionality

- **Project execution workflow fix**  
  - Fixed solver step reset when creating new project executions
  - Improved workflow consistency in execution creation process
  - Enhanced user experience during project setup

### Changed
- **Login interface visual improvements**  
  - Fixed border radius styling for new login cards
  - Improved visual consistency of login interface
  - Enhanced overall login page aesthetics
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #143

## [1.2.0] - 09-06-2025

### Added
- **Feature/manual user in public**  
  - Moved user manual PDF files from src/app/assets/manual/ to public/manual/ for better production deployment
  - Updated manual file path in HelpMenu.vue
  - Updated README.md documentation
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #125

- **Feature/developer mode**  
  - Implemented isDeveloperMode config variable to enable developer mode for creating executions with solution files without solving
  - Implemented isExternalApp .env or values.json variable for better backend endpoint definition
  - Added cornflow version in the help center menu
  - Updated README with new functionality documentation
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #122

- **Feature/multiple excel import**  
  - Added support for uploading multiple files when uploading an instance
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #120

- **Feature/new config value extra table fields**  
  - Added possibility to show new columns in Project execution table (username and end time)
  - Improved code maintainability through refactoring
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #117

### Changed
- **Schema visibility improvements**  
  - Added parameter in config.ts to toggle visibility of tables without json schema
  - Improved handling of .zip type responses
  - Added loading spinners for file downloads and execution loading
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #121

## [1.1.4] - 09-04-2025

### Added
- **Feature/improve checks flow**  
  Fixed an issue with the checks flow: When running checks, there are three possible outcomes: all checks pass, some checks fail, or the checks encounter a critical error. Previously, when a DAG was triggered for checks and failed, the frontend didn't capture this failure, leaving the issue unnoticed. Now, this information is properly retrieved, preventing further progress if the DAG encounters a failure.  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #114

- **Feature/cognito fixes**  
  - Better redirect handling for cognito auth (delete all session storage and local storage data when sign out or before login)
  - Improved history execution style table
  - Added hash mode in config to be able to decide if hash mode is active or not in routing
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #113

## [1.1.3] - 04-03-2025

### Added
- **Bugfix: export excel with hidden tables and columns**  
  Fixed an issue where hidden tables and columns were still being exported in the Excel file.  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #108

- **New mango vue release**  
  Implemented a new version of mango vue, introducing updated features and improved functionality.  
  *Contributors:* [@HelenaCA](#) 
  *Commit ID:* #107

- **Cognito Auth improvements**  
  - Enhanced OpenID authentication for proper refresh token functionality
  - Updated authentication to use Bearer token instead of access_token
  - Improved configuration handling with values.json and .env fallback
  - Enhanced sign out functionality for OpenID enabled systems
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #106

- **Schema visibility management**  
  - Added visible prop in schema for tables and columns visibility control
  - Improved instance table handling for non-schema tables
  - Refactored table/schema management logic into composables
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #105

### Fixed
- **UI Component Warnings**  
  - Resolved app drawer warnings
  - Fixed app tab warnings
  - Improved drawer text styling
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #104

- **Input Output Datatable Rendering**  
  Fixed conflicts in InputOutputDatatable component rendering with other views.  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #101

## [1.1.2] - 07-01-2025 

### Added
- **Authentication openID improvements**  
  Enhanced authentication openId system functionality.  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #93

### Changed
- **Configuration environment updates**
  - Added schema app as environment variable  
  - Updated config environment build arguments  
  - New values.json configuration form  
  *Contributors:* [@HelenaCA](#)
  *Commit ID:* #87, #90, #89

- **OpenID implementation**  
  - Implemented OpenID login functionality  
  - Added OpenID login redirect feature  
  *Contributors:* [@HelenaCA](#)  
  *Commit ID:* #81, #86

## [1.1.1] - 26-11-2024

### Added
- **Specific locale tests for app clients**  
  Added localized testing for app clients, enhancing compatibility across regions.  
  *Contributors:* [@HelenaCA](#)
  *Commit ID:* #75  

- **New mango vue release**  
  Implemented a new version of mango vue, introducing updated features and improved functionality.  
  *Contributors:* [@HelenaCA](#) 
  *Commit ID:* #74, #79

### Fixed
- **Filters display issue**  
  Resolved a bug causing selected filters to not be highlighted correctly.  
  *Contributors:* [@HelenaCA](#)
  *Commit ID:* #76  
