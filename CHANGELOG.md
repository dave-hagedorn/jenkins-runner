# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - March 28 2020
### Added
- Added `environment` object on a job's config.  This behaves same as `parameters`, but injects environment variables into the job (`env.VAR`)
  - This requires that the Jenkins instance running the job have the envinject plugin installed.  An error is shown if this plugin isn't found
  - Docs updated to show this new setting
  - Thanks @Roman-Bober for the filing the feature request
  - [https://github.com/dave-hagedorn/jenkins-runner/issues/19](https://github.com/dave-hagedorn/jenkins-runner/issues/19)
- Misc code cleanup, reorg
  - Using latest TypeScript
  - Using latest Jenkins node lib (needed to fetch list of plugins from a Jenkins instance)
- Potential fix when running jobs that are newly created
  - [Error if pipeline job is freshly created](https://github.com/dave-hagedorn/jenkins-runner/issues/14)


### Changed
- Modified `clearOutput` boolean to be on `jenkinsRunner.clearOutput` (extension-wide setting)
  - Thanks @atiniir for original feature request and implementation
  - [#18 Add option to clear console when build starts](https://github.com/dave-hagedorn/jenkins-runner/issues/18)


## [1.2.4] - March 8 2020 (not released to marketplace)
### Added
- Added `clearOutput` boolean to host entry in settings - allows clearing output window at start of run [#18 Add option to clear console when build starts](https://github.com/dave-hagedorn/jenkins-runner/issues/18)

### Changed
- Update to lates Jenkins node lib
  - [No valid crumb was included in the request](https://github.com/dave-hagedorn/jenkins-runner/issues/16)

## [1.2.3] - March 8 2020
### Fixed
- Update jenkins dependency to fix crumbs [#16 - No valid crumb was included in the request](https://github.com/dave-hagedorn/jenkins-runner/issues/16)

## [1.2.2] - May 19 2019
### Fixed
- Related to [#5 - Need ability to use/not use crumbIssuer CSRF protection](https://github.com/dave-hagedorn/jenkins-runner/issues/5).  crumbIssuer config was not used for all user+password combinations in host settings

## [1.2.1] - May 19 2019
### Fixed
- [#5 - Need ability to use/not use crumbIssuer CSRF protection](https://github.com/dave-hagedorn/jenkins-runner/issues/5). See `Added` below
- plugin's user settings are again verified at time of use, using schema from package.json.  Warnings for invalid settings JSON shown to user
- Bug where some changes to a host's settings would not be updated until restart
### Added
- Added `useCrumbIssuer` boolean to host entry in settings - allows turning on/off CSRF protection
- Added `rejectUnauthorizedCert` boolean to host entry in settings - allows using unverifible/self-signed SSL certs.  This is a potential fix for [#2 -strictSSL configuration?](https://github.com/dave-hagedorn/jenkins-runner/issues/2)
- Re-adding [.vscode](.vscode) directory with launch configs
### Changed
- Minor formatting tweaks to [README.md](README.md)

## [1.1.0] - April 15 2019
### Fixed
- Anonymous Jenkins users can now run jobs

## [1.0.0] - April 12 2019
### Initial Release