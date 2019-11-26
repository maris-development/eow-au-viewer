import {Component, AfterViewInit, OnInit, Inject} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import debounce from 'lodash/debounce';
import keyBy from 'lodash/keyBy';
import groupBy from 'lodash/groupBy';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import VectorSource from 'ol/source/Vector';
import Overlay from 'ol/Overlay';
import VectorLayer from 'ol/layer/Vector';
import {fromLonLat} from 'ol/proj';

import GeoJSON from 'ol/format/GeoJSON';
import CircleStyle from 'ol/style/Circle';
import {
  Style,
  Stroke,
  Fill
} from 'ol/style';
import Icon from 'ol/style/Icon';
import TileWMS from 'ol/source/TileWMS';

import {
  colors,
  printDetails,
  printStats,
  calculateStats,
  renderUsers,
  recentMeasurements
} from './utils';
// import * as Highcharts from 'highcharts';
import {SeriesPieOptions, chart, setOptions, getOptions, map, Color} from 'highcharts';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'ng-eow';
  map: Map;
  popup: any;
  measurementStore: any;
  userStore: any;
  dataLayer: any;
  allDataSource: any;
  pieChart: any;
  highchart: any;
  shapesLayerShape: any;
  shapesLayerFill: any;
  shapesLayerNames: any;
  wofsWMS: any;

  constructor(@Inject(DOCUMENT) private document: Document, private http: HttpClient) {
  }

  ngAfterViewInit() {
    this.map.setTarget('map');
  }

  ngOnInit() {
    // The WFS provided by EyeOnWater.org for Australia data
    const WFS_URL = 'https://geoservice.maris.nl/wms/project/eyeonwater_australia?service=WFS'
      + '&version=1.0.0&request=GetFeature&typeName=eow_australia&maxFeatures=5000&outputFormat=application%2Fjson';
    const USER_SERVICE = 'https://www.eyeonwater.org/api/users';
    const styleCache = {};
    this.allDataSource = new VectorSource({
      format: new GeoJSON(),
      url: WFS_URL
    });

    // console.log(`colors:`);
    // console.table(colors);

    // Fast datastructures to query the data
    this.userStore = {
      users: [],
      userById: {},
      getUserById(userId) {
        return this.userById[userId] || [];
      }
    };
    this.measurementStore = {
      measurements: [],
      measurementsById: {},
      measurementsByOwner: {},
      getByOwner(userId) {
        return this.measurementsByOwner[userId] || [];
      },
      getById(id) {
        return this.measurementsById[id] || [];
      }

    };
    // Get measurements from layer after it's done loading.
    this.allDataSource.on('change', this.initialLoadMeasurements.bind(this));

    this.popup = new Overlay({
      element: this.document.getElementById('popup'),
      position: [0, 0],
      autoPan: true,
      autoPanMargin: 275,
      positioning: 'center-left'
    });

// Style Features using ..... FU values (called for each feature on every render call)
    const basicStyle = (feature, resolution) => {
      const fuValue = feature.get('fu_value');
      const styleKey = `${fuValue}_${resolution}`;
      // Avoid some unnecessary computation
      if (styleCache[styleKey]) {
        return styleCache[styleKey];
      }
      feature.set('visible', true);
      const styleOptions = {
        image: new CircleStyle({
          radius: this.map.getView().getZoom() * Math.log2(5),
          stroke: new Stroke({
            color: 'white'
          }),
          fill: new Fill({
            color: colors[fuValue]
          })
        })
      };

      styleCache[styleKey] = new Style(styleOptions);
      return styleCache[styleKey];
    };

    this.dataLayer = new VectorLayer({
      source: this.allDataSource,
      style: basicStyle
    });
    this.dataLayer.set('name', 'EOW Data');

    this.dataLayer.on('change', debounce(({
                                            target
                                          }) => {
      // Populate datalayer
      const element = this.document.querySelector('.sub-header-stats') as HTMLElement;
      element.innerHTML = printStats(calculateStats(target.getSource().getFeatures()), this.userStore);
    }, 200));

    const mainMap = new TileLayer({
      source: new OSM()
    });
    mainMap.set('name', 'Main map');

    this.map = new Map({
      target: 'map',
      layers: [
        mainMap,
        this.dataLayer
      ],
      view: new View({
        center: fromLonLat([133.945313, -26.431228]),
        zoom: 4
      }),
      controls: []
    });

    async function loadUsers() {
      // TODO I'm curious as to if this is correct under Angular
      const response = await window.fetch(USER_SERVICE);
      const {
        results: {
          users
        }
      } = await response.json();
      return users;
    }

// Attach overlay and hide it
    this.map.addOverlay(this.popup);
    this.popup.setVisible(false);

// Click events for panels
    this.document.getElementById('clearFilterButton').addEventListener('click', (event) => {
      this.clearFilter();
    });

// Show popup with features at certain point on the map
    this.map.on('click', (evt) => {
      const {
        pixel,
        coordinate
      } = evt;

      console.log(`Clicked on map at: ${JSON.stringify(coordinate)}`);
      // clean up old popup and initilize some variables
      this.popup.setVisible(false);
      const element = this.popup.getElement();
      const content = element.querySelector('.content');
      const stats = element.querySelector('.stats');
      content.innerHTML = '';
      element.classList.remove('active');

      const features = [];

      this.map.forEachFeatureAtPixel(pixel, (feature) => {
        features.push(feature);
      });

      if (features.length) {
        content.innerHTML = features.map(printDetails).join('');
        // Draw the pie chart of FU values selected, but this printStats() used in one other place and
        // can only have one id (since we only want one graph)
        stats.innerHTML = (printStats(calculateStats(features), this.userStore) as string)
              .replace('class="pieChart"', 'id="pieChart"');
        element.classList.add('active');
        this.popup.setPosition(coordinate); // [28468637.79432749, 5368841.526355445]);  //
      }
      this.addPieChart(features, coordinate);
    });
// Load users
    loadUsers().then((users) => {
      this.userStore.users = users;
      this.userStore.userById = keyBy(this.userStore.users, 'id');
      renderUsers(this.userStore.users);
    });
    this.addShapeFiles();
    this.addGADEAWOFS();
    this.setupLayerSelectionMenu();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Pull tabs of Most Active Users and Recent Measurements
    this.document.querySelectorAll('.pull-tab').forEach(i => i.addEventListener('click', (event: Event) => {
      const element = (event.target as HTMLElement).closest('.panel');
      element.classList.toggle('pulled');
    }));

    // Popup dialog close button
    this.document.querySelector('#popup').addEventListener('click', (event: Event) => {
      const element = (event.target as HTMLElement);
      if (element.matches('.close')) {
        this.popup.setVisible(false);
        this.popup.getElement().classList.remove('active');
      } else if (element.matches('.more-info-btn')) {
        const popupElement = element.closest('.popup-item');
        popupElement.classList.toggle('active');
      }
    });

    // User List
    document.querySelector('.user-list').addEventListener('click', (event) => {
      const element = (event.target as HTMLElement).closest('.item');
      const userId = element.getAttribute('data-user');

      if (this.showMeasurements(userId)) {
        this.clearSelectedUser();
        element.classList.add('selectedUser', 'box-shadow');
        this.toggleFilterButton(true);
      }
    }, true);

    // Measurement List
    document.querySelector('.measurement-list').addEventListener('click', (event) => {
      const element = (event.target as HTMLElement).closest('.item');
      if (!element) {
        return;
      }

      const coordinate = element.getAttribute('data-coordinate').split(',');
      const id = element.getAttribute('data-key');
      const view = this.map.getView();
      view.cancelAnimations();
      view.animate({
        center: coordinate,
        zoom: 8,
        duration: 1300
      });
      // clean up old popup and initilize some variables
      this.popup.setVisible(false);
      const popupElement = this.popup.getElement();
      const content = popupElement.querySelector('.content');
      const stats = popupElement.querySelector('.stats');
      content.innerHTML = '';
      popupElement.classList.remove('active');

      const features = [this.measurementStore.getById(id)];

      if (features.length) {
        content.innerHTML = features.map(printDetails).join('');
        stats.innerHTML = printStats(calculateStats(features), this.userStore);
        popupElement.classList.add('active');

        this.popup.setPosition(coordinate);
        this.addPieChart(features, coordinate);
      }
    }, true);
  }

  private initialLoadMeasurements(event) {
    const source = event.target;
    if (!source.loading) {
      const features = this.allDataSource.getFeatures();
      // Store the measurements in easy to access data structure
      this.measurementStore.measurements = features;
      this.measurementStore.measurementsById = keyBy(features, f => f.get('n_code'));
      this.measurementStore.measurementsByOwner = groupBy(features, f => f.get('user_n_code'));

      recentMeasurements(this.measurementStore.measurements);
      this.allDataSource.un('change', this.initialLoadMeasurements);
    }
  }


  private showMeasurements(userId = null) {
    const newSource = new VectorSource();
    const selection = this.measurementStore.getByOwner(userId);
    if (!selection.length) {
      return false;
    }
    newSource.addFeatures(selection);
    this.map.getView().fit(newSource.getExtent(), {
      size: this.map.getSize(),
      padding: [100, 100, 100, 100],
      nearest: false,
      duration: 1300
    });
    this.dataLayer.setSource(newSource);
    recentMeasurements(selection);
    return true;
  }

  private clearFilter() {
    this.dataLayer.setSource(this.allDataSource);
    this.clearSelectedUser();
    recentMeasurements(this.measurementStore.measurements);
    this.map.getView().fit(this.dataLayer.getSource().getExtent(), {duration: 1300});
    this.toggleFilterButton(false);
  }

  private toggleFilterButton(state = false) {
    const element = this.document.getElementById('clearFilterButton');
    element.classList.toggle('hidden', !state);
  }

  private clearSelectedUser() {
    this.document.querySelectorAll('.user-list .item').forEach(item => {
      item.classList.remove('selectedUser', 'box-shadow');
    });
  }

  /**
   * If features are passed in (since one or more clicked on) then draw PieChart containing them.  If it is empty then draw chart of all
   * features visible.
   *
   * @param features - EOW Data
   * @param coordinate - the position of the mouse click in the viewport
   */
  private addPieChart(features, coordinate) {
    if (this.highchart) {
      this.highchart.destroy();
      this.highchart = null;
    } else {
      const cArray = Object.keys(colors);
      const theFUColours = cArray.map(c => {
        const index = (parseInt(c, 10)) % cArray.length;
        // console.log(`colors length: ${cArray.length}, c: ${c}, color index: ${index}`);
        return colors[index];
      });
      // console.table(theFUColours);

      setOptions({
        colors: map(theFUColours, (color) => {
          return {
            radialGradient: {
              cx: 0.5,
              cy: 0.3,
              r: 0.7
            },
            stops: [
              [0, color],
              [1, new Color(color).brighten(-0.2).get('rgb')] // darken
            ]
          };
        })
      });
    }

    const aggregateFUValues = (fuValuesInFeatures) => {
      const eowDataReducer = (acc, currentValue) => {
        acc[currentValue.values_.fu_value] = acc.hasOwnProperty(currentValue.values_.fu_value) ? ++acc[currentValue.values_.fu_value] : 1;
        return acc;
      };
      return features.reduce(eowDataReducer, {});
    };
    // Add zeros for all the other FUs since the colours in Highcharts pie charts are from the ordinal number of the data, NOT the value
    // of it's "name" attribute
    const setMissingFUsToZero = (fUValuesObj) => {
      return Object.keys(fUValuesObj).map(i => {
        return parseInt(i, 10);
      });
    };
    const arrayToObject = (array) =>
    array.reduce((obj, item) => {
      obj[item] = item;
      return obj;
    }, {});
    const addMissingFUValues = (existingFUs, missingFUs) => {
      Object.keys(colors).forEach((key, index) => {
        if (! missingFUs.hasOwnProperty(index)) {
          existingFUs[index] = 0;
        }
      });
      return existingFUs;
    };

    let eowDataFUValues = aggregateFUValues(features);
    const arrayFUValues = setMissingFUsToZero(eowDataFUValues);
    const arrayFUValuesObj = arrayToObject(arrayFUValues);

    eowDataFUValues = addMissingFUValues(eowDataFUValues, arrayFUValuesObj);

    const eowData = Object.keys(eowDataFUValues).map(k => {
      return {name: k, y: eowDataFUValues[k]};
    });
    console.log(`EOWData: ${JSON.stringify(eowData)}`);

    // Build the chart
    this.highchart = chart('pieChart', {
      chart: {
        plotBackgroundColor: 'rgba(55, 255, 255, 0)',
        plotBorderWidth: 0,
        plotShadow: false,
        type: 'pie',
        height: '80px',
        width: 90
      },
      title: {
        text: ''  // FUIs on selected markers'
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: false,
            format: '<b>{point.name}</b>: {point.percentage:.1f} %',
            connectorColor: 'brown'
          }
        }
      },
      series: [{
        name: 'Share',
        data: eowData
      } as SeriesPieOptions]
    });
  }

  private addShapeFiles() {
    const iconStyle = new Style({
      image: new Icon({
        anchor: [0.5, 46],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        opacity: 0.75,
        scale: 0.02,
        src: '../assets/icon.png'
      })
    });
    const fillStyle = new Style({
      fill: new Fill({color: 'rgba(224, 255, 255, 0.33)'})
    });
    interface Options {
      style?: any;
      minZoom?: number;
      visible?: boolean;
    }
    const createLayer = (title, url, options: Options = {}) => {
      this.http.get(url).toPromise().then(d => console.log(`url exists: ${url}`)).catch(e => console.log(`URL DOES NOT EXIST: ${url}`));
      const newLayer = new VectorLayer(Object.assign(options, {
        title,
        source: new VectorSource({
          url,
          format: new GeoJSON(),
          projection : 'EPSG:4326'
        })
      }));
      newLayer.set('name', title);
      this.map.addLayer(newLayer);
      newLayer.setVisible(options.hasOwnProperty('visible') ? options.visible : true);
      return newLayer;
    };
    // Original data
    this.shapesLayerShape = createLayer('Waterbodies shape', '../assets/waterbodies/Australia/aus25wgd_l.geojson');
    this.shapesLayerFill = createLayer('Waterbodies fill', '../assets/waterbodies/Australia/aus25wgd_r.geojson',
      {style: fillStyle});
    this.shapesLayerNames = createLayer('Waterbodies name', '../assets/waterbodies/Australia/aus25wgd_p.geojson',
      {style: iconStyle, minZoom: 8});

    // new data but that only covers ACT + ~ 100kms square
    this.shapesLayerShape = createLayer('i5516 flats', '../assets/waterbodies/Canberra/i5516_flats.geojson');
    this.shapesLayerShape = createLayer('i5516 pondages', '../assets/waterbodies/Canberra/i5516_pondageareas.geojson');
    this.shapesLayerShape = createLayer('i5516 waterCourseLines', '../assets/waterbodies/Canberra/i5516_watercourselines.geojson',
      {visible: false});
    this.shapesLayerShape = createLayer('i5516 waterCourseAreas', '../assets/waterbodies/Canberra/i5516_watercourseareas.geojson');
    this.shapesLayerShape = createLayer('i5516 lakes', '../assets/waterbodies/Canberra/i5516_waterholes.geojson');
    this.shapesLayerShape = createLayer('i5516 reservoirs', '../assets/waterbodies/Canberra/i5516_reservoirs.geojson');
  }

  // Water Observations from Space 25m Filtered Summary (WOfS Filtered Statistics)
  // http://terria-cube.terria.io/ > Add data > DEA Production > Water Observations from Space > All time summaries
  // Discussed problem with rendering from DEA server with OpenDataCube slack group and worked out a solution.
  // Feedback also was that https://ows.services.dea.ga.gov.au has caching but https://ows.dea.ga.gov.au doesn't.  Use the later.
  private addGADEAWOFS() {
    this.wofsWMS = new TileLayer({
      opacity: 0.6,
      source: new TileWMS({
        url: 'https://ows.dea.ga.gov.au',
        params: {
          LAYERS: 'wofs_filtered_summary',
          TILED: true
        },
        extent: [ -5687813.782846, 12530995.153909, -15894844.529378, 3585760.291316 ] // -13884991, -7455066, 2870341, 6338219]
      })
    });
    this.wofsWMS.set('name', 'Water Observations from Space');  // 25m Filtered Summary (WOfS Filtered Statistics)');
    this.map.addLayer(this.wofsWMS);
    this.wofsWMS.setVisible(true);
  }

  private setupLayerSelectionMenu() {
    const generateCheckbox = (idCheckbox, labelName, htmlElement) => {
      const checkbox = this.document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = idCheckbox;
      const label = this.document.createElement('label');
      label.htmlFor = idCheckbox;
      label.appendChild(this.document.createTextNode(labelName));
      htmlElement.appendChild(checkbox);
      htmlElement.appendChild(label);
      return checkbox;
    };

    const layers = this.map.getLayers().getArray();
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const layerId = 'layer_id_' + layers[i].get('id');
      const name = layers[i].get('name');
      const checkbox = generateCheckbox( i, name, this.document.querySelector('.layersSwitch'));

      // Manage when checkbox is (un)checked
      checkbox.addEventListener('change', function() {
        if (this.checked !== layer.getVisible()) {
          layer.setVisible(this.checked);
        }
      });

      // Manage when layer visibility changes outside of this
      layer.on('change:visible', function() {
        if (this.getVisible() !== checkbox.checked) {
          checkbox.checked = this.getVisible();
        }
      });

      // Set state the first time
      setTimeout(() => {
        checkbox.checked = layer.getVisible();
      }, 1000);
    }
  }
}
