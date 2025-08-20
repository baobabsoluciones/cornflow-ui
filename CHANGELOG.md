# Changelog

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
