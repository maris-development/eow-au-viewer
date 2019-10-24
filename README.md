# EyeOnWater: Australia - WFS Viewer

A simple viewer to visualize EOW:AU data.

## Fixes
- Fixed most active user sorting

## New Features
- Sliding side panels with User information and Recent Measurements
- Click on user to see their measurements and statistics
- Click on a recent measurement to see more details
- Retrieve data from EyeOnWater.org Users API

## Features
- Click on map to get features in a popup
- Click on results for more details
- Statistics for the whole feature collection
- Statistics for the result set
- Colors based on FU value

## Installation
- clone this repository
- cd into project folder
- run `npm install`

## Run
- To start development server with live reload run command
  - `npm start`
- To build production ready distribution run command
  - `npm run build`
  
## Distribution (CSIRO)

    cd ng-eow  # this project
    npm run build
    rm dist.tgz
    tar --directory=dist/ng-eow -czvf dist.tgz ./
    scp dist.tgz <user>@research.csiro.au: /tmp
    # type in password - alternatively setup up ssh public/private keys

    ssh -t <user>@research.csiro.au "cd /srv/www/research.csiro.au/html/static/eyeonwater; exec $SHELL -l"
    # type in password - alternatively setup up ssh public/private keys
    research> # You should be in /srv/www/research.csiro.au/html/static/eyeonwater directory - MAKE SURE YOU ARE!
    research> rm -rf *
    research> cp /tmp/dist.tgz .
    research> tar xzvf dist.tgz
    # Open https://research.csiro.au/eyeonwater/observation/ in browswer

# Development

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 8.3.14.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
