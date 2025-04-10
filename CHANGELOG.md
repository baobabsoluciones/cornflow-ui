# Changelog

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
