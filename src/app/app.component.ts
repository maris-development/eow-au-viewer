import {Component, OnInit, Inject, AfterViewInit} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import debounce from 'lodash/debounce';
import keyBy from 'lodash/keyBy';
import groupBy from 'lodash/groupBy';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import VectorSource from 'ol/source/Vector';
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
  printStats,
  calculateStats,
  renderUsers,
  recentMeasurements
} from './utils';
import {HttpClient} from '@angular/common/http';
import {PieChart} from './pie-chart';
import {Popup} from './popup';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'ng-eow';
  map: Map;
  popupObject: any;
  measurementStore: any;
  userStore: any;
  dataLayer: any;
  allDataSource: any;
  pieChart: any;
  shapesLayerShape: any;
  shapesLayerFill: any;
  shapesLayerNames: any;
  wofsWMS: any;
  htmlDocument: Document;

  constructor(@Inject(DOCUMENT) private document: Document, private http: HttpClient) {
    this.htmlDocument = document;
    this.pieChart = new PieChart();
    // Fast datastructures to query the data
    this.userStore = {
      users: [],
      userById: {},
      getUserById(userId) {
        return this.userById[userId] || [];
      }
    };
    this.popupObject = new Popup(this.document, this.pieChart, this.userStore);
  }

  ngOnInit() {
    this.popupObject.init();

    // The WFS provided by EyeOnWater.org for Australia data
    const WFS_URL = 'https://geoservice.maris.nl/wms/project/eyeonwater_australia?service=WFS'
      + '&version=1.0.0&request=GetFeature&typeName=eow_australia&maxFeatures=5000&outputFormat=application%2Fjson';
    const USER_SERVICE = 'https://www.eyeonwater.org/api/users';
    const styleCache = {};
    this.allDataSource = new VectorSource({
      format: new GeoJSON(),
      url: WFS_URL
    });

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
      controls: [],
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
    this.map.addOverlay(this.popupObject.getOverlay());

    // EventHandlers cannot be registered until after they are added to the map, since the element temporarily is removed
    this.popupObject.initEventHandlers();

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

      const features = [];

      this.map.forEachFeatureAtPixel(pixel, (feature) => {
        features.push(feature);
      });

      if (features.length) {
        console.log(`Clicked on map at: ${JSON.stringify(coordinate)}`);
        this.popupObject.draw(features, coordinate);
      }
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
      const features = [this.measurementStore.getById(id)];
      this.popupObject.draw(features, coordinate);
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
