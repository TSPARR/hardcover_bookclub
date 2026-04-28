# Changelog

All notable changes to this project will be documented in this file.

## Release 0.6.4
- Dependency update: certifi 2026.4.22
- Dependency update: cryptography 47.0.0
- Dependency update: idna 3.13
- Dependency update: packaging 26.2

## Release 0.6.3
- Added the average rating of each user's picks
- Dependency update: charset-normalizer 3.4.7
- Dependency update: Django 5.2.13
- Dependency update: cryptography 46.0.7

## Release 0.6.2
- Dependency update: djangorestframework 3.17.1
- Dependency update: pywebpush 2.3.0
- Dependency update: django 5.2.12
- Dependency update: requests 2.33.1
- Dependency update: asgiref 3.11.1
- Dependency update: whitenoise 6.12.0
- Dependency update: certifi 2026.2.25
- Dependency update: packaging 26.0
- Dependency update: sqlparse 0.5.5
- Dependency update: python-dotenv 1.2.2
- Dependency update: charset-normalizer 3.4.6
- Dependency update: plexapi 4.18.1
- Dependency update: bleach 6.3.0
- Depenndecy update: pycparser 3.0
- Dependency update: idna 3.11
- Dependency update: cryptography 46.0.6
- Dependency update: django-appconf 1.2.0
- Dependency update: gunicorn 25.3.0
- Dependency update: markdown 3.10.2
- Dependency update: docker/login-action 4
- Dependency update: docker/setup-buildx-action 4
- Dependency update: docker/build-push-action 7
- Dependency update: actions/checkout 6

## Release 0.6.1
- Added Dependabot configuration for automated dependency updates

## Release 0.6.0
- Added optional Meetings feature to schedule and track group meeting attendance
- Dependency updates: sqlparse 0.5.4, markdown 3.8.1

## Release 0.5.2
- Dependency update: cryptography 46.0.5
- Dependency update: cffi 2.0.0

## Release 0.5.1
- Dependency update: urllib3 2.6.3

## Release 0.5.0
- Added basic markdown support to comments (blockquotes and formatting)
- Added seven new emoji reactions to comments
- Enhanced comment display with line break support
- Added configurable session cookie age via environment variable
- Improved pick analytics display
- Fixed book description handling to prevent null values
- Updated screenshots with separate dark and light mode versions
- Dependency updates: Django 5.1.15, urllib3 2.6.0, requests 2.32.4

## Release 0.4.1
- Fixes for the Comment Reactions JS on mobile
- Added ability for end users to change their own passwords

## Release 0.4.0
- Added new Notification Preferences system for opting in to notifications
- Added some enhancements to the Dollar Bet system as well as analytics for bets
- Some further JS/CSS/HTML restructuring and organization
- Added more comprehensive options to the admin page

## Release 0.3.0
- Added optional Push Notification support to allow for updates on activity
- Added optional Dollar Bets feature to allow fun wagers on what will happen in the book
- Major CSS overhaul to make it easier to adjust the site to be mobile responsive

## Release 0.2.0
- Add ability for web page to be a PWA
- Remember comment sorting
- Add Clear Cache button in Profile Settings
- Big CSS/HTML refactor to make pages easier to adjust down the line

## Release 0.1.6
- Adds aggregate rating data to the analytics page
- Always display normalized progress on comments

## Release 0.1.5
- Adds local book ratings that can be used with Hardcover taking precedence
- Redesign of Home Page and Group Details page

## Release 0.1.4
- Adds Book Pick analytics for some fun views into who's picking books.

## Release 0.1.3
- Adds ability to select admin-promoted versions with a quick edition select for users
- Reworks book details page to have less wasted space
- Adds more validation to progress indicators to ensure they make sense

## Release 0.1.2
- Added optional Plex integration to more easily help your users discover the books.

## Release 0.1.1
- Added optional Kavita integration to more easily help your users discover the books.

## Release 0.1.0
- Reworked reactions on comments to work more consistently and properly apply spoiler tags
- Added new nightly builds based on the develop branch

## Release 0.0.9
- Refactor of main javascript and python files into more discrete functions

## Release 0.0.8
- Added functionality to sync ratings from Hardcover and display stars on book detail and group view

## Release 0.0.7
- Added reading status indicator to all previous books

## Release 0.0.6
- Added the ability to attribute the book to a specific member or the group collectively as well as manage the list of books for the group so far

## Release 0.0.5
- Removed legacy registration links

## Release 0.0.4

- Added the ability to push progress from Bookclub to Hardcover

## Release 0.0.3

- Move to invite-based registration system and swap a lot of info messages to the debug level

## Release 0.0.2

- Version bump to test Docker workflow

## Release 0.0.1

- Initial Release
